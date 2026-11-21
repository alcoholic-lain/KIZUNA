from django.test import Client, TestCase
from django.urls import reverse

from .models import Mesure


class MeasurementTests(TestCase):
    reading = {
        "adaptateur_id": "NABD-0004",
        "horodatage": "2026-11-21T20:00:00+01:00",
        "watts": 910.5,
        "source": "simulee",
    }

    def send(self, data):
        return self.client.post(reverse("ingest-measurements"), data, content_type="application/json")

    def test_headless_client_posts_with_django_csrf_enabled(self):
        client = Client(enforce_csrf_checks=True)
        url = reverse("ingest-measurements")
        self.assertEqual(client.post(url, self.reading, content_type="application/json").status_code, 403)
        token = client.get(reverse("measurement-csrf")).json()["csrfToken"]
        result = client.post(url, self.reading, content_type="application/json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(result.json(), {"acquittees": 1})

    def test_replayed_batch_is_idempotent_across_timezones(self):
        batch = [self.reading, {**self.reading, "adaptateur_id": "NABD-0005"}]
        self.assertEqual(self.send(batch).json(), {"acquittees": 2})
        self.assertEqual(self.send(batch).status_code, 200)
        self.assertEqual(self.send({**self.reading, "horodatage": "2026-11-21T19:00:00Z"}).status_code, 200)
        self.assertEqual(Mesure.objects.count(), 2)
        ac = Mesure.objects.get(adaptateur_id="NABD-0004")
        self.assertEqual((ac.source, ac.watts), ("simulee", 910.5))

    def test_invalid_batch_is_rejected_before_storage(self):
        for field, value in [
            ("adaptateur_id", "NABD-9999"), ("watts", -12), ("watts", True),
            ("watts", "10"), ("watts", float("nan")), ("source", "unknown"),
            ("horodatage", "2026-11-21"), ("horodatage", "bad"),
        ]:
            with self.subTest(field=field, value=value):
                response = self.send([self.reading, {**self.reading, field: value}])
                self.assertEqual(response.status_code, 400)
                self.assertIn("erreur", response.json())
                self.assertFalse(Mesure.objects.exists())
