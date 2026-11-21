from django.test import SimpleTestCase
from django.urls import reverse


class SimulatorTests(SimpleTestCase):
    def test_simulator_supplies_the_csrf_cookie_for_telemetry(self):
        response = self.client.get(reverse("m1:index"))
        self.assertContains(response, "Données simulées")
        self.assertContains(response, "Démo guidée")
        self.assertIn("csrftoken", response.cookies)
