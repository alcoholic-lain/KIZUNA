import json

from django.test import TestCase, override_settings

from m11.seed import reset_demo
from m12.models import Reading

URL = "/api/mesures"


def reading(adapter="NABD-0001", minute=0, watts=100.0, source="simulee"):
    return {"adaptateur_id": adapter, "horodatage": f"2026-11-21T23:{minute:02d}:00+01:00", "watts": watts, "source": source}


class MesuresBatchTests(TestCase):
    def setUp(self):
        reset_demo()
        self.before = Reading.objects.count()

    def post(self, data, **headers):
        return self.client.post(URL, json.dumps(data), content_type="application/json", **headers)

    def test_single_reading_still_works(self):
        r = self.post(reading())
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["acquittees"], 1)
        self.assertEqual(Reading.objects.count(), self.before + 1)

    def test_batch_is_acknowledged_with_its_length(self):
        r = self.post([reading(minute=1), reading(adapter="NABD-0002", minute=1)])
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"acquittees": 2, "stored": 2, "duplicate": 0})

    def test_replayed_batch_is_idempotent(self):
        batch = [reading(minute=2), reading(adapter="NABD-0002", minute=2)]
        self.post(batch)
        r = self.post(batch)
        self.assertEqual(r.json(), {"acquittees": 2, "stored": 0, "duplicate": 2})
        self.assertEqual(Reading.objects.count(), self.before + 2)

    def test_invalid_reading_rejects_the_whole_batch(self):
        r = self.post([reading(minute=3), reading(adapter="NABD-9999", minute=3)])
        self.assertEqual(r.status_code, 404)
        self.assertEqual(Reading.objects.count(), self.before)

    def test_empty_or_oversized_batch_is_refused(self):
        self.assertEqual(self.post([]).status_code, 400)
        self.assertEqual(self.post([reading()] * 101).status_code, 400)

    @override_settings(MIERUKA_ADAPTER_KEY="secret")
    def test_adapter_key_is_required_when_configured(self):
        self.assertEqual(self.post(reading(minute=4)).status_code, 403)
        ok = self.post(reading(minute=4), HTTP_X_ADAPTER_KEY="secret")
        self.assertEqual(ok.status_code, 200)
