import json

from django.test import TestCase
from django.utils import timezone

from m11.seed import reset_demo
from m15 import aggregates as A


class StegTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        reset_demo()

    def test_masked_region(self):
        regions = {r["code"]: r for r in A.regions(timezone.now())}
        self.assertTrue(regions["tozeur"]["masked"])
        self.assertNotIn("today", regions["tozeur"])
        self.assertFalse(regions["tunis"]["masked"])

    def test_meter_equation(self):
        eq = A.building(timezone.now(), "BAT-TUN-01")["equation"]
        self.assertAlmostEqual(eq["meter"], eq["monitored"] + eq["untracked"], delta=0.2)
        self.assertGreater(eq["untracked"], 0)

    def test_fault_building_drifts(self):
        b = {x["code"]: x for x in A.buildings(timezone.now())}["BAT-TUN-02"]
        self.assertGreater(b["untracked"], b["untracked_ref"])

    def test_no_names_and_role_guard(self):
        self.client.post("/api/auth/demo", data=json.dumps({"role": "foyer"}), content_type="application/json")
        self.assertEqual(self.client.get("/api/steg/overview").status_code, 403)
        self.client.post("/api/auth/demo", data=json.dumps({"role": "steg"}), content_type="application/json")
        for url in ["/api/steg/overview", "/api/steg/buildings/BAT-TUN-01", "/api/steg/incidents?status=toutes"]:
            body = self.client.get(url).content.decode()
            for secret in ("Ben Salah", "Amira", "Gharbi", "Youssef", "@demo"):
                self.assertNotIn(secret, body)
