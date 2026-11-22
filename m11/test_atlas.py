import json
from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone

from m11 import atlas
from m11.models import AtlasLocation
from m11.seed import reset_demo
from m12.models import Installation


class AtlasTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        reset_demo()

    def login(self, role):
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

    def test_posted_readings_drive_the_atlas(self):
        """The simulator's /mesures feed is the same adapter state the map shows."""
        from m12.models import Adapter, Reading
        self.login("steg")
        aid = next(d["adaptateur_id"] for d in atlas.registry() if not Installation.objects.filter(adapter_id=d["adaptateur_id"]).exists())
        Adapter.objects.get_or_create(id=aid, defaults={"seed": int(aid[5:])})
        Reading.objects.create(adapter_id=aid, ts=timezone.now() - timedelta(seconds=5), watts=1234.5, source="simulee")
        region = next(d["region_id"] for d in atlas.registry() if d["adaptateur_id"] == aid)
        dev = next(d for d in self.client.get(f"/api/atlas?region={region}").json()["devices"] if d["adaptateur_id"] == aid)
        self.assertEqual(dev["watts"], 1234.5)
        self.assertTrue(dev["active"])
        Reading.objects.all().update(ts=timezone.now() - timedelta(minutes=10))  # stale: back to the synthetic wave
        dev = next(d for d in self.client.get(f"/api/atlas?region={region}").json()["devices"] if d["adaptateur_id"] == aid)
        self.assertNotEqual(dev["watts"], 1234.5)

    @override_settings(MIERUKA_ADAPTER_KEY="k3y", DEBUG=False)
    def test_simulated_scan_creates_a_named_device_visible_to_steg(self):
        import re
        r = self.client.post("/api/atlas/provision", content_type="application/json")
        self.assertEqual(r.status_code, 403)
        r = self.client.post("/api/atlas/provision", content_type="application/json", headers={"X-Adapter-Key": "k3y"})
        self.assertEqual(r.status_code, 200)
        made = r.json()
        self.assertRegex(made["name"], r"^LAC-\d{3}$")
        self.assertTrue(re.fullmatch(r"NABD-\d{4}", made["id"]))
        self.post_reading = self.client.post("/api/mesures", json.dumps({"adaptateur_id": made["id"], "watts": 321.0, "source": "simulee"}),
                                             content_type="application/json", headers={"X-Adapter-Key": "k3y"})
        self.assertEqual(self.post_reading.status_code, 200)
        self.login("steg")
        dev = next(d for d in self.client.get(f"/api/atlas?region={made['region']}").json()["devices"] if d["adaptateur_id"] == made["id"])
        self.assertEqual(dev["name"], made["name"])
        self.assertEqual(dev["watts"], 321.0)
        self.assertEqual(dev["location"]["source"], "phone_gps")

    @override_settings(MIERUKA_ADAPTER_KEY="")
    def test_simulated_scan_needs_no_key_when_none_is_configured(self):
        r = self.client.post("/api/atlas/provision", content_type="application/json")
        self.assertEqual(r.status_code, 200)

    def test_recent_devices_can_be_tracked_and_cut_off(self):
        made = [self.client.post("/api/atlas/provision", content_type="application/json").json() for _ in range(2)]
        self.assertEqual(self.client.get("/api/atlas/recent").status_code, 401)  # STEG only
        self.login("steg")
        rows = self.client.get("/api/atlas/recent").json()
        self.assertEqual([r["adaptateur_id"] for r in rows[:2]], [made[1]["id"], made[0]["id"]])  # newest first
        self.assertTrue(rows[0]["power_on"])
        aid = made[0]["id"]
        self.assertEqual(self.client.get(f"/api/atlas/power/{aid}").json(), {"on": True})
        r = self.post("/api/atlas/power", {"adaptateur_id": aid, "on": False})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.client.get(f"/api/atlas/power/{aid}").json(), {"on": False})
        dev = next(d for d in self.client.get(f"/api/atlas?region={made[0]['region']}").json()["devices"] if d["adaptateur_id"] == aid)
        self.assertFalse(dev["power_on"])
        self.assertEqual(self.post("/api/atlas/power", {"adaptateur_id": aid, "on": "no"}).status_code, 400)
        self.assertEqual(self.post("/api/atlas/power", {"adaptateur_id": "NABD-9998", "on": False}).status_code, 404)

    def test_login_survives_without_database_sessions(self):
        from django.contrib.sessions.models import Session
        self.login("steg")
        self.assertEqual(Session.objects.count(), 0)  # signed cookie: nothing to lose between serverless instances
        for _ in range(3):
            self.assertTrue(self.client.get("/api/auth/me").json()["authenticated"])
