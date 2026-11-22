import json
from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone

from m11 import atlas
from m11.models import AtlasLocation
from m11.seed import reset_demo
from m12.models import Installation


@override_settings(MIERUKA_STEG_PASSWORD="steg-test-secret")
class AtlasTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        reset_demo()

    def login(self, role):
        if role == "steg":  # STEG is password-only; one-click demo login is refused
            self.client.post("/api/auth/login", data=json.dumps({"email": "analyste@demo.steg.tn", "password": "steg-test-secret"}),
                             content_type="application/json")
            return
        self.client.post("/api/auth/demo", data=json.dumps({"role": role}), content_type="application/json")

    def post(self, url, data):
        return self.client.post(url, data=json.dumps(data), content_type="application/json")

    def fix(self, aid, **extra):
        return {"adaptateur_id": aid, "x": 10.1801, "y": 36.8065, "z": 12.0, "accuracy_m": 8,
                "captured_at": timezone.now().isoformat(), **extra}

    def test_fleet_matches_the_mapped_homes(self):
        fleet = atlas.registry()
        self.assertEqual(len(fleet), sum(s[4] for s in atlas.SITES))
        self.assertEqual(len({d["adaptateur_id"] for d in fleet}), len(fleet))

    def test_national_view_counts_every_region(self):
        self.login("steg")
        data = self.client.get("/api/atlas").json()
        self.assertEqual(sum(r["count"] for r in data["regions"]), len(atlas.registry()))
        self.assertEqual(data["devices"], [])

    def test_region_view_lists_devices_with_states(self):
        self.login("steg")
        devices = self.client.get("/api/atlas?region=kef").json()["devices"]
        self.assertEqual(len(devices), 85)
        self.assertTrue({d["state"] for d in devices} <= {"economic", "elevated", "high", "offline"})

    def test_unknown_region_is_404(self):
        self.login("steg")
        self.assertEqual(self.client.get("/api/atlas?region=mars").status_code, 404)

    def test_households_cannot_read_the_atlas(self):
        self.login("foyer")
        self.assertEqual(self.client.get("/api/atlas").status_code, 403)

    def test_scan_moves_the_device_to_its_gps_fix(self):
        self.login("steg")
        device = self.post("/api/atlas/locate", self.fix("NABD-0500")).json()
        self.assertEqual(device["region_id"], "tunis")
        self.assertEqual(device["location"]["source"], "phone_gps")
        self.assertEqual(AtlasLocation.objects.get(pk="NABD-0500").recorded_by.profile.role, "steg")

    def test_altitude_is_optional(self):
        self.login("steg")
        response = self.post("/api/atlas/locate", self.fix("NABD-0501", z=None))
        self.assertEqual(response.status_code, 200)

    def test_older_fix_is_rejected(self):
        self.login("steg")
        self.post("/api/atlas/locate", self.fix("NABD-0502"))
        old = (timezone.now() - timedelta(hours=1)).isoformat()
        self.assertEqual(self.post("/api/atlas/locate", self.fix("NABD-0502", captured_at=old)).status_code, 409)

    def test_invalid_coordinates_are_rejected(self):
        self.login("steg")
        self.assertEqual(self.post("/api/atlas/locate", self.fix("NABD-0503", x=500)).status_code, 400)

    def test_far_away_fix_lands_outside_sectors(self):
        self.login("steg")
        device = self.post("/api/atlas/locate", self.fix("NABD-0504", x=2.35, y=48.85)).json()
        self.assertEqual(device["region_id"], "outside")

    def test_roof_must_be_near_the_fix(self):
        self.login("steg")
        device = self.post("/api/atlas/locate", self.fix("NABD-0505")).json()
        captured = device["location"]["captured_at"]
        near = self.post("/api/atlas/roof", {"adaptateur_id": "NABD-0505", "captured_at": captured, "x": 10.1802, "y": 36.8066})
        self.assertEqual(near.json()["location"]["roof"], {"x": 10.1802, "y": 36.8066})
        far = self.post("/api/atlas/roof", {"adaptateur_id": "NABD-0505", "captured_at": captured, "x": 10.3, "y": 36.9})
        self.assertEqual(far.status_code, 400)

    def test_household_can_only_locate_its_own_adapter(self):
        self.login("foyer")
        self.assertEqual(self.post("/api/atlas/locate", self.fix("NABD-0900")).status_code, 403)
        own = Installation.objects.filter(household__members__role="foyer", household__members__is_demo=True,
                                          end__isnull=True).first()
        self.assertEqual(self.post("/api/atlas/locate", self.fix(own.adapter_id)).status_code, 200)

    def test_generated_demo_adapter_can_be_scanned(self):
        self.login("steg")
        first = self.post("/api/atlas/demo-adapter", {}).json()["id"]
        second = self.post("/api/atlas/demo-adapter", {}).json()["id"]
        self.assertEqual((first, second), ("NABD-7001", "NABD-7002"))
        self.assertFalse(self.client.get(f"/api/atlas/device/{first}").json()["located"])
        self.post("/api/atlas/locate", self.fix(first))
        found = self.client.get(f"/api/atlas/device/{first}").json()
        self.assertTrue(found["located"])
        self.assertTrue(found["device"]["active"])
        self.assertEqual(found["device"]["region_id"], "tunis")

    def test_households_cannot_generate_adapters(self):
        self.login("foyer")
        self.assertEqual(self.post("/api/atlas/demo-adapter", {}).status_code, 403)
