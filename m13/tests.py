from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from m11.seed import reset_demo
from m12.models import Alert, Event, Household, Installation
from m13 import engine


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
