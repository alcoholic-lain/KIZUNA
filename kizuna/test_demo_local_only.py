"""MIERUKA_DEMO_LOCAL_ONLY: demo accounts and demo controls answer only this machine."""
import json

from django.test import TestCase, override_settings

from m11.seed import DEMO_PASSWORD, reset_demo

LAN = "192.168.1.50"
SECRET = "steg-test-secret"


@override_settings(MIERUKA_STEG_PASSWORD=SECRET)
class DemoLocalOnlyTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        reset_demo()

    def post(self, url, data=None, ip="127.0.0.1"):
        return self.client.post(url, data=json.dumps(data or {}), content_type="application/json", REMOTE_ADDR=ip)

    def get(self, url, ip="127.0.0.1"):
        return self.client.get(url, REMOTE_ADDR=ip)

    def test_off_by_default_lan_one_click_still_works(self):
        self.assertEqual(self.post("/api/auth/demo", {"role": "foyer"}, ip=LAN).status_code, 200)
        self.assertEqual(self.get("/api/home", ip=LAN).status_code, 200)

    @override_settings(MIERUKA_DEMO_LOCAL_ONLY=True)
    def test_presenter_machine_keeps_the_full_demo(self):
        for ip in ("127.0.0.1", "::1", "::ffff:127.0.0.1"):
            self.assertEqual(self.post("/api/auth/demo", {"role": "foyer"}, ip=ip).status_code, 200, ip)
            self.assertEqual(self.get("/api/home", ip=ip).status_code, 200, ip)
        self.assertEqual(self.post("/api/sim", {"action": "realtime"}).status_code, 200)
        self.assertEqual(self.post("/api/auth/login", {"email": "analyste@demo.steg.tn", "password": SECRET}).status_code, 200)
        self.assertEqual(self.get("/api/steg/overview").status_code, 200)
        self.assertEqual(self.post("/api/auth/demo", {"role": "foyer"}).status_code, 200)
        self.assertEqual(self.post("/api/auth/demo", {"role": "steg"}).status_code, 200)

    @override_settings(MIERUKA_DEMO_LOCAL_ONLY=True)
    def test_lan_client_cannot_open_a_demo_account(self):
        self.assertEqual(self.post("/api/auth/demo", {"role": "foyer"}, ip=LAN).status_code, 403)
        r = self.post("/api/auth/login", {"email": "amira@demo.mieruka.tn", "password": DEMO_PASSWORD}, ip=LAN)
        self.assertEqual(r.status_code, 403)
        self.assertEqual(self.post("/api/auth/login", {"email": "analyste@demo.steg.tn", "password": SECRET}, ip=LAN).status_code, 403)
        self.assertNotIn("user", self.get("/api/auth/me", ip=LAN).json())

    @override_settings(MIERUKA_DEMO_LOCAL_ONLY=True)
    def test_a_demo_session_cannot_be_used_from_the_lan(self):
        # e.g. a session obtained through another login path, or a copied cookie
        self.assertEqual(self.post("/api/auth/demo", {"role": "foyer"}).status_code, 200)
        for url in ("/api/home", "/api/live", "/api/devices", "/api/history"):
            self.assertEqual(self.get(url, ip=LAN).status_code, 403, url)
        self.assertEqual(self.post("/api/sim", {"action": "reset"}, ip=LAN).status_code, 403)
        self.assertEqual(self.get("/api/home").status_code, 200)  # still fine on the presenter machine

    @override_settings(MIERUKA_DEMO_LOCAL_ONLY=True)
    def test_lan_visitor_can_register_but_not_reset_the_demo(self):
        r = self.post("/api/auth/register", {"name": "Visiteur", "email": "v@example.tn", "password": "longpassword1"}, ip=LAN)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.get("/api/home", ip=LAN).status_code, 200)  # their own household
        self.assertEqual(self.post("/api/sim", {"action": "reset"}, ip=LAN).status_code, 403)
