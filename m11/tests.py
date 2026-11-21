import json
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from m11 import model as M
from m11.seed import reset_demo
from m12.data import pairs, installations
from m12.models import Event, Installation, Reading


class ModelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        reset_demo()

    def test_energy_is_power_times_time(self):
        """A constant ~850 W server rack: hourly energy ≈ 0.85 kWh."""
        (inst, spec), = pairs([Installation.objects.get(adapter_id="NABD-5004")])
        d = (timezone.now() - timedelta(days=2)).astimezone(M.TN).date()
        hourly = M.day_hourly(spec, d, timezone.now())
        self.assertAlmostEqual(sum(hourly) / 24, spec.on_w / 1000, delta=0.05)

    def test_history_is_deterministic(self):
        (inst, spec), = pairs([Installation.objects.get(adapter_id="NABD-0002")])
        d = (timezone.now() - timedelta(days=5)).astimezone(M.TN).date()
        M._DAY_CACHE.clear()
        a = M.day_hourly(spec, d, timezone.now())
        M._DAY_CACHE.clear()
        self.assertEqual(a, M.day_hourly(spec, d, timezone.now()))

    def test_anomaly_event_raises_power(self):
        inst = Installation.objects.get(adapter_id="NABD-0002")
        now = timezone.now()
        (_, before), = pairs([inst])
        Event.objects.create(installation=inst, kind="anomaly", start=now - timedelta(minutes=1), end=now + timedelta(hours=1),
                             factor=1.7, data={"type": "surcharge", "forced": True})
        (_, after), = pairs([Installation.objects.get(pk=inst.pk)])
        self.assertGreater(M.power(after, now)[0], 1.5 * before.on_w)

    def test_pause_stops_measurement_not_consumption(self):
        inst = Installation.objects.get(adapter_id="NABD-0001")
        now = timezone.now()
        Event.objects.create(installation=inst, kind="pause", start=now - timedelta(hours=1))
        (_, spec), = pairs([Installation.objects.get(pk=inst.pk)])
        self.assertIsNone(M.measured_power(spec, now))
        d = now.astimezone(M.TN).date()
        self.assertGreaterEqual(sum(M.day_hourly(spec, d, now, measured=False)), sum(M.day_hourly(spec, d, now)))


class ContractTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        reset_demo()

    def post(self, data):
        return self.client.post("/api/mesures", data=json.dumps(data), content_type="application/json")

    def test_contract(self):
        ok = {"adaptateur_id": "NABD-0004", "horodatage": "2026-11-21T20:00:00+01:00", "watts": 110.4, "source": "reelle"}
        self.assertEqual(self.post(ok).status_code, 200)
        self.assertTrue(self.post(ok).json()["duplicate"])
        self.assertEqual(Reading.objects.filter(adapter_id="NABD-0004").count(), 1)
        self.assertEqual(self.post({"adaptateur_id": "NABD-7777", "watts": 1}).status_code, 404)
        self.assertEqual(self.post({"adaptateur_id": "NABD-0004", "watts": -1}).status_code, 400)
        self.assertEqual(self.post({"adaptateur_id": "NABD-0004", "watts": "x"}).status_code, 400)

    def test_pairing_errors_and_flow(self):
        self.client.post("/api/auth/demo", data=json.dumps({"role": "foyer"}), content_type="application/json")
        check = lambda raw: self.client.get(f"/api/adapters/check?id={raw}").status_code
        self.assertEqual(check("ABC"), 400)
        self.assertEqual(check("NABD-9999"), 404)
        self.assertEqual(check("NABD-0001"), 409)
        self.assertEqual(check("nabd0003"), 200)
        r = self.client.post("/api/devices", data=json.dumps({"id": "NABD-0003", "category": "ordinateur", "name": "PC"}), content_type="application/json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.client.delete(f"/api/devices/{r.json()['id']}").status_code, 200)
        self.assertEqual(check("NABD-0003"), 200)
