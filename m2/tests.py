from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from .models import Adaptateur, Mesure, Recompense, Utilisateur


class ContractTests(TestCase):
    def test_duplicate_reading_is_rejected(self):
        adapter = Adaptateur.objects.create(id="MIERUKA-0001")
        now = timezone.now()
        Mesure.objects.create(adaptateur=adapter, horodatage=now, watts=100, source="simulee")
        with self.assertRaises(IntegrityError), transaction.atomic():
            Mesure.objects.create(adaptateur=adapter, horodatage=now, watts=120, source="simulee")

    def test_adapter_id_format(self):
        with self.assertRaises(ValidationError):
            Adaptateur(id="NABD-0001").full_clean()
        Adaptateur(id="MIERUKA-0042").full_clean()

    def test_deleting_household_keeps_adapters(self):
        household = Utilisateur.objects.create(nom="Foyer test", nb_personnes=2, type_logement="maison", region="tunis")
        Adaptateur.objects.create(id="MIERUKA-0002", utilisateur=household, statut="actif")
        household.delete()
        self.assertIsNone(Adaptateur.objects.get(pk="MIERUKA-0002").utilisateur)


class SeedDemoTests(TestCase):
    def test_seed_creates_simulated_data_only(self):
        call_command("seed_demo", hours=2, step=30, verbosity=0)
        self.assertGreater(Utilisateur.objects.count(), 0)
        self.assertFalse(Mesure.objects.exclude(source="simulee").exists())
        for reward in Recompense.objects.all():
            self.assertEqual(reward.points, int(reward.kwh_evites * 500))

    def test_seed_refuses_to_overwrite_without_reset(self):
        call_command("seed_demo", hours=1, step=30, verbosity=0)
        with self.assertRaises(CommandError):
            call_command("seed_demo", hours=1, step=30, verbosity=0)

    def test_if_empty_skips_existing_data(self):
        call_command("seed_demo", hours=1, step=30, verbosity=0)
        before = Mesure.objects.count()
        call_command("seed_demo", "--if-empty", hours=1, step=30, verbosity=0)
        self.assertEqual(Mesure.objects.count(), before)
