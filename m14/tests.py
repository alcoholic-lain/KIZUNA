import json
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from m11.seed import reset_demo
from m12.data import pairs
from m12.models import Alert, Event, Household, Installation, SavingAction, TokenTx
from m13 import engine
from m14 import rewards
from m14.tariff import monthly_bill


class TariffTests(TestCase):
    def test_steg_bands(self):
        self.assertAlmostEqual(monthly_bill(80, 2)["energy"], 50 * 0.062 + 30 * 0.096, places=3)
        self.assertEqual(monthly_bill(150)["band_price"], 0.176)
        self.assertEqual(monthly_bill(250)["band_price"], 0.218)
        self.assertEqual(monthly_bill(400)["vat_rate"], 0.13)
        self.assertGreater(monthly_bill(400)["total"], monthly_bill(250)["total"])


class RewardTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        reset_demo()

    def setUp(self):
        self.h = Household.objects.get(label="Foyer Ben Salah")
        self.ac = Installation.objects.get(adapter_id="NABD-0002")

    def test_fix_produces_verified_savings_and_tokens(self):
        now = timezone.now()
        Event.objects.create(installation=self.ac, kind="anomaly", start=now - timedelta(minutes=40), end=now + timedelta(hours=2),
                             factor=1.7, data={"type": "surcharge", "forced": True})
        engine.scan(self.h, now - timedelta(minutes=30), force=True)
        alert = Alert.objects.get(installation=self.ac, kind__in=("surconsommation", "pic"))
        before = rewards.ledger(self.h, now - timedelta(minutes=30))["balance"]
        rewards.apply_alert(alert, now - timedelta(minutes=30))
        sav = rewards.savings(self.h, now)
        self.assertGreater(sav["kwh"], 0.2)  # ~0.9 kW avoided for 30 minutes
        after = rewards.ledger(self.h, now)["balance"]
        self.assertGreater(after, before)

    def test_daily_cap(self):
        now = timezone.now()
        rewards.fixed_grant(self.h, 10_000, "defi", "test", now)
        self.assertLessEqual(rewards.ledger(self.h, now)["today"], rewards.DAILY_CAP)

    def test_score_bounds(self):
        s = rewards.score_bundle(self.h, timezone.now(), pairs(list(self.h.installations.all())))
        self.assertTrue(0 <= s["score"] <= 100)
        self.assertEqual(sum(p["max"] for p in s["parts"]), 100)

    def test_zero_tokens_changes_nothing_for_power(self):
        TokenTx.objects.filter(household=self.h).delete()
        SavingAction.objects.filter(household=self.h).delete()
        self.client.post("/api/auth/demo", data=json.dumps({"role": "foyer"}), content_type="application/json")
        live = self.client.get("/api/live").json()
        self.assertEqual(live["tokens"], 0)
        self.assertTrue(all(d["monitoring"] for d in live["devices"]))

    def test_household_eco_mode_only_updates_tracked_computers_after_confirmation(self):
        computer = Installation.objects.filter(household=self.h, end__isnull=True).first()
        computer.category = "ordinateur"
        computer.save(update_fields=["category"])
        now = timezone.now()
        alert = Alert.objects.create(
            household=self.h, building=self.h.building, kind="daily_limit", title="Seuil quotidien atteint",
            action="Confirmer le mode éco", action_code="household_mode_eco", detected_at=now,
            measured=24.1, expected=24, unit="kWh",
        )

        message = rewards.apply_alert(alert, now)

        computer.refresh_from_db()
        alert.refresh_from_db()
        eco_event = Event.objects.get(installation=computer, kind="efficiency", end__isnull=True)
        self.assertEqual(eco_event.factor, rewards.EFFECTS["mode_eco"])
        self.assertIn("Aucun appareil n’a été commandé", message)
        self.assertEqual(alert.status, "appliquee")
        self.assertFalse(Event.objects.filter(installation=computer, kind="forced_on").exists())
