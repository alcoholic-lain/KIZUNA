"""STEG back-office access (jury-readiness security fix).

One-click demo login stays open for the fictional households, but a STEG session
needs the configured STEG password. The public demo password never opens STEG.
"""
import importlib
import json

from django.apps import apps
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from m11.seed import DEMO_PASSWORD, reset_demo
from m12.models import Household

STEG_EMAIL = "analyste@demo.steg.tn"
SECRET = "steg-test-secret"
STEG_URLS = ["/api/steg/overview", "/api/steg/buildings", "/api/steg/incidents", "/api/steg/peak",
             "/api/steg/households/{household}", "/api/atlas"]


@override_settings(MIERUKA_STEG_PASSWORD=SECRET)
class StegAccessTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        reset_demo()

    def post(self, url, data=None):
        return self.client.post(url, data=json.dumps(data or {}), content_type="application/json")

    def demo(self, role):
        return self.post("/api/auth/demo", {"role": role})

    def password_login(self, pw):
        return self.post("/api/auth/login", {"email": STEG_EMAIL, "password": pw})

    def urls(self):
        code = Household.objects.filter(is_live=True).first().code
        return [u.format(household=code) for u in STEG_URLS]

    def assert_no_steg(self, status):
        for url in self.urls():
            self.assertEqual(self.client.get(url).status_code, status, url)

    def test_auth_me_never_publishes_a_password(self):
        for prep in (lambda: None, lambda: self.demo("foyer")):
            prep()
            r = self.client.get("/api/auth/me")
            self.assertNotIn("password", r.json())
            self.assertNotIn(DEMO_PASSWORD, r.content.decode())

    def test_anonymous_demo_login_cannot_open_steg(self):
        r = self.demo("steg")
        self.assertEqual(r.status_code, 403)
        self.assertNotIn("user", self.client.get("/api/auth/me").json())
        self.assert_no_steg(401)

    def test_household_session_cannot_switch_to_steg(self):
        self.assertEqual(self.demo("foyer").status_code, 200)
        self.assertEqual(self.demo("steg").status_code, 403)
        self.assertEqual(self.client.get("/api/auth/me").json()["user"]["role"], "foyer")
        self.assert_no_steg(403)

    def test_household_demo_accounts_still_one_click(self):
        for role in ("foyer", "etudiant", "famille", "entreprise"):
            r = self.demo(role)
            self.assertEqual(r.status_code, 200, role)
            self.assertEqual(r.json()["user"]["role"], role)
            self.assertEqual(self.client.get("/api/home").status_code, 200, role)

    def test_public_demo_password_never_opens_steg(self):
        user = get_user_model().objects.get(username="steg")
        self.assertFalse(user.has_usable_password())  # seed no longer gives it the public password
        user.set_password(DEMO_PASSWORD)  # a database seeded before the fix
        user.save()
        self.assertEqual(self.password_login(DEMO_PASSWORD).status_code, 401)
        self.assertEqual(self.password_login("wrong").status_code, 401)
        self.assertFalse(self.client.login(username="steg", password="wrong"))
        self.assert_no_steg(401)

    @override_settings(MIERUKA_STEG_PASSWORD="")
    def test_steg_login_is_closed_when_no_password_is_configured(self):
        self.assertEqual(self.password_login("").status_code, 401)
        self.assertEqual(self.password_login(DEMO_PASSWORD).status_code, 401)

    def test_presenter_unlocks_steg_then_switches_freely(self):
        r = self.password_login(SECRET)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["user"]["role"], "steg")
        for url in self.urls():
            self.assertEqual(self.client.get(url).status_code, 200, url)
        # Guided demo: household, then back to STEG with one click, same browser session.
        self.assertEqual(self.demo("foyer").status_code, 200)
        self.assert_no_steg(403)
        self.assertEqual(self.demo("steg").status_code, 200)
        self.assertEqual(self.client.get("/api/steg/overview").status_code, 200)
        # Logging out ends the unlock.
        self.post("/api/auth/logout")
        self.assertEqual(self.demo("steg").status_code, 403)

    def test_demo_controls_need_a_signed_in_account(self):
        self.assertEqual(self.post("/api/sim", {"action": "realtime"}).status_code, 401)
        self.demo("foyer")
        self.assertEqual(self.post("/api/sim", {"action": "realtime"}).status_code, 200)

    def test_migration_revokes_the_public_password(self):
        user = get_user_model().objects.get(username="steg")
        user.set_password(DEMO_PASSWORD)
        user.save()
        importlib.import_module("m12.migrations.0002_revoke_steg_demo_password").revoke(apps, None)
        user.refresh_from_db()
        self.assertFalse(user.has_usable_password())
        self.assertFalse(user.check_password(DEMO_PASSWORD))
