import json
from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone

from m11.seed import reset_demo
from m12.models import Alert, Event, Household, Installation
from m13 import engine, weather


class AnomalyRuleTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        reset_demo()

    def setUp(self):
        self.h = Household.objects.get(label="Foyer Ben Salah")
        self.ac = Installation.objects.get(adapter_id="NABD-0002")
        Alert.objects.filter(household=self.h).delete()

    def anomaly(self, seconds_ago, factor=1.7):
        now = timezone.now()
        Event.objects.create(installation=self.ac, kind="anomaly", start=now - timedelta(seconds=seconds_ago),
                             end=now + timedelta(hours=1), factor=factor, data={"type": "surcharge", "forced": True})
        return now

    def ac_alerts(self):
        return Alert.objects.filter(installation=self.ac, kind__in=("surconsommation", "pic"))

    def test_three_readings_raise_one_alert(self):
        now = self.anomaly(30)
        engine.scan(self.h, now, force=True)
        engine.scan(self.h, now, force=True)
        self.assertEqual(self.ac_alerts().count(), 1)
        a = self.ac_alerts().get()
        self.assertGreater(a.measured, a.expected * 1.35)
        self.assertTrue(a.cause and a.action and a.evidence["readings"])

    def test_two_readings_do_not(self):
        now = self.anomaly(7)  # only the last 2 readings (every 5 s) are above
        engine.scan(self.h, now, force=True)
        self.assertEqual(self.ac_alerts().count(), 0)

    def test_moderate_increase_is_ignored(self):
        now = self.anomaly(60, factor=1.2)
        engine.scan(self.h, now, force=True)
        self.assertEqual(self.ac_alerts().count(), 0)

    def test_forecast_is_consistent(self):
        f = engine.forecast(self.h, timezone.now())
        self.assertGreaterEqual(f["month_kwh"], f["mtd_kwh"])
        self.assertLessEqual(f["low"], f["month_kwh"])

    def test_preventive_mission_is_grounded_and_labeled(self):
        now = timezone.now()
        prs = engine.pairs(engine.installations([self.h], active=True))
        with patch("m13.engine.weather_forecast", return_value={
            "available": False, "label": "Prévisions météo indisponibles", "detail": "Météo indisponible.",
        }):
            mission = engine.preventive_mission(self.h, now, prs)
        self.assertIn("peak_start", mission)
        self.assertIn("actions", mission)
        self.assertFalse(mission["weather"]["available"])

    def test_open_meteo_forecast_parses_daily_and_hourly_values(self):
        today = timezone.localdate().isoformat()
        payload = {
            "daily": {
                "time": [today], "temperature_2m_max": [36.2], "temperature_2m_min": [22.0],
                "weather_code": [1], "precipitation_probability_max": [10],
            },
            "hourly": {
                "time": [f"{today}T13:00", f"{today}T15:00"],
                "temperature_2m": [34.0, 36.2], "apparent_temperature": [35.0, 39.0],
                "relative_humidity_2m": [45, 50], "weather_code": [1, 2],
            },
        }
        with patch.dict(weather._CACHE, {}, clear=True), patch(
            "m13.weather.urlopen", return_value=BytesIO(json.dumps(payload).encode())
        ):
            result = weather.forecast(36.8, 10.2)
        self.assertTrue(result["available"])
        self.assertEqual(result["days"][0]["max_c"], 36.2)
        self.assertEqual(result["days"][0]["hottest_hour"], 15)
        self.assertEqual(result["days"][0]["humidity_max"], 50)

    def test_hot_weather_adds_comfort_actions_without_claiming_savings(self):
        now = timezone.now()
        prs = engine.pairs(engine.installations([self.h], active=True))
        habit_data = engine.habits(self.h, now, prs)
        local_now = now.astimezone(engine.TN)
        mission_date = local_now.date()
        if habit_data["peak_hour"] <= local_now.hour:
            mission_date += timedelta(days=1)
        weather_data = {
            "available": True,
            "label": "Ciel dégagé",
            "source": "Open-Meteo",
            "days": [{
                "date": mission_date.isoformat(), "max_c": 38.0, "min_c": 26.0,
                "apparent_max_c": 41.0, "humidity_max": 70, "precipitation_probability": 0,
                "weather_code": 0, "condition": "Ciel dégagé", "hottest_hour": 14,
            }],
        }
        with patch("m13.engine.weather_forecast", return_value=weather_data):
            mission = engine.preventive_mission(self.h, now, prs, habits_data=habit_data)
        titles = [action["title"] for action in mission["actions"]]
        self.assertIn("Fermer les volets avant les heures les plus chaudes", titles)
        self.assertEqual(mission["weather"]["max_c"], 38.0)
        self.assertEqual(mission["daily_saving_kwh"], round(sum(
            action["expected_kwh"] for action in mission["actions"]
        ), 2))

    def test_gemini_live_session_requires_explicit_consent(self):
        from django.contrib.auth import get_user_model

        self.client.force_login(get_user_model().objects.get(username="amira"))
        response = self.client.post(
            "/api/ai/gemini-live-token",
            data=json.dumps({"consent": False}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    @override_settings(GEMINI_API_KEY="")
    def test_gemini_live_session_reports_missing_server_key(self):
        from django.contrib.auth import get_user_model

        self.client.force_login(get_user_model().objects.get(username="amira"))
        response = self.client.post(
            "/api/ai/gemini-live-token",
            data=json.dumps({"consent": True}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 503)
        self.assertIn("GEMINI_API_KEY", response.json()["error"])

    @override_settings(GEMINI_API_KEY="server-test-key", GEMINI_LIVE_MODEL="gemini-3.8-live")
    def test_gemini_live_session_returns_only_ephemeral_token(self):
        from django.contrib.auth import get_user_model

        self.client.force_login(get_user_model().objects.get(username="amira"))
        with patch("m13.gemini_live.urlopen", return_value=BytesIO(json.dumps({
            "name": "auth_tokens/test_ephemeral",
            "expireTime": "2026-11-22T09:00:00Z",
        }).encode())) as open_url:
            response = self.client.post(
                "/api/ai/gemini-live-token",
                data=json.dumps({"consent": True}),
                content_type="application/json",
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["value"], "auth_tokens/test_ephemeral")
        self.assertNotIn("server-test-key", response.content.decode())
        request = open_url.call_args.args[0]
        self.assertEqual(request.get_header("X-goog-api-key"), "server-test-key")
        self.assertEqual(json.loads(request.data.decode())["uses"], 1)
        self.assertEqual(
            json.loads(request.data.decode())["liveConnectConstraints"]["model"],
            "models/gemini-3.8-live",
        )

    def test_voice_context_exposes_only_allowlisted_energy_summary(self):
        from django.contrib.auth import get_user_model

        self.client.force_login(get_user_model().objects.get(username="amira"))
        with patch("m13.engine.weather_forecast", return_value={
            "available": False,
            "label": "Prévisions météo indisponibles",
            "detail": "Météo indisponible.",
        }):
            response = self.client.get("/api/ai/voice-context")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.json()), {
            "source", "today_kwh", "today_expected_kwh", "month_forecast_kwh", "monthly_goal_kwh",
            "risk", "predicted_peak", "weather", "factors", "actions",
        })
        self.assertNotIn("latitude", response.content.decode())
