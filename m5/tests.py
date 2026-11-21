from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from m2.models import Adaptateur, Appareil, Mesure, Utilisateur
from m5.views import _energy_by_adapter

PAGES = ["m5:index", "m5:devices", "m5:users", "m5:alerts", "m5:credits"]


class AccessTests(TestCase):
    def test_anonymous_is_sent_to_google_sign_in(self):
        for name in PAGES:
            response = self.client.get(reverse(name))
            self.assertEqual(response.status_code, 302, name)
            self.assertTrue(response["Location"].startswith(reverse("m10:index") + "?next="), name)

    def test_non_staff_gets_403(self):
        user = get_user_model().objects.create_user("foyer", email="foyer@example.com", password="x")
        self.client.force_login(user)
        response = self.client.get(reverse("m5:index"))
        self.assertEqual(response.status_code, 403)
        self.assertContains(response, "No back-office access", status_code=403)


class BackOfficeTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", hours=6, step=30, verbosity=0)
        cls.staff = get_user_model().objects.create_user("staff", password="x", is_staff=True)

    def setUp(self):
        self.client.force_login(self.staff)

    def test_every_page_renders(self):
        for name in PAGES:
            response = self.client.get(reverse(name))
            self.assertEqual(response.status_code, 200, name)
            self.assertContains(response, "Simulated data")

    def test_user_detail_renders(self):
        household = Utilisateur.objects.first()
        response = self.client.get(reverse("m5:user_detail", args=[household.pk]))
        self.assertContains(response, household.nom)

    def test_overview_counts_households(self):
        response = self.client.get(reverse("m5:index"))
        self.assertEqual(response.context["kpis"]["households"], Utilisateur.objects.count())

    def test_device_filters(self):
        response = self.client.get(reverse("m5:devices"), {"status": "non_associe"})
        statuses = {d.statut for d in response.context["page"]}
        self.assertEqual(statuses, {"non_associe"})

    def test_unknown_filter_values_are_ignored(self):
        response = self.client.get(reverse("m5:devices"), {"status": "nope", "region": "mars"})
        self.assertEqual(response.context["total"], Adaptateur.objects.count())

    def test_alert_states(self):
        open_page = self.client.get(reverse("m5:alerts"), {"state": "open"})
        self.assertTrue(all(not a.resolue for a in open_page.context["page"]))
        resolved = self.client.get(reverse("m5:alerts"), {"state": "resolved"})
        self.assertTrue(all(a.resolue for a in resolved.context["page"]))


class EnergyTests(TestCase):
    def test_kwh_is_average_power_times_span(self):
        appareil = Appareil.objects.create(nom="Climatisation", type="clim", puissance_nominale_w=900)
        adapter = Adaptateur.objects.create(id="MIERUKA-0001", appareil=appareil, statut="actif")
        start = timezone.now() - timedelta(hours=3)
        for i, watts in enumerate([1000, 1000, 1000]):  # 1 kW held for 2 hours
            Mesure.objects.create(
                adaptateur=adapter, horodatage=start + timedelta(hours=i), watts=watts, source="simulee"
            )
        energy = _energy_by_adapter(start, timezone.now())
        self.assertAlmostEqual(energy["MIERUKA-0001"], 2.0)
