from django.test import TestCase, override_settings

from m11.seed import reset_demo
from m12.models import Installation, SimState

from .apiutils import ensure_seeded


class DemoResetGuardTests(TestCase):
    def setUp(self):
        reset_demo()
        self.readings = Installation.objects.count()
        self.assertGreater(self.readings, 0)
        SimState.objects.filter(pk=1).delete()

    @override_settings(MIERUKA_DEMO_RESET=False)
    def test_seeding_does_not_wipe_existing_data_when_reset_is_off(self):
        ensure_seeded()
        self.assertEqual(Installation.objects.count(), self.readings)
        self.assertFalse(SimState.objects.filter(pk=1).exists())

    @override_settings(MIERUKA_DEMO_RESET=True)
    def test_seeding_resets_when_explicitly_enabled(self):
        ensure_seeded()
        self.assertTrue(SimState.objects.filter(pk=1).exists())
