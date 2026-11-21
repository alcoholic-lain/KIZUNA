from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from m12.models import Profile

from .adapters import ensure_profile


class GoogleStartTests(TestCase):
    @override_settings(GOOGLE_LOGIN_CONFIGURED=True)
    def test_page_posts_to_allauth_with_csrf_and_default_next(self):
        response = self.client.get("/mekeru/google/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'action="/accounts/google/login/?process=login&amp;next=/app/"')
        self.assertContains(response, "csrfmiddlewaretoken")

    @override_settings(GOOGLE_LOGIN_CONFIGURED=False)
    def test_reports_when_google_is_not_configured(self):
        response = self.client.get("/mekeru/google/")
        self.assertEqual(response.status_code, 503)
        self.assertContains(response, "pas configurée", status_code=503)

    @override_settings(GOOGLE_LOGIN_CONFIGURED=True)
    def test_next_cannot_leave_the_site(self):
        for bad in ["//evil.example", "https://evil.example", "/\\evil.example"]:
            response = self.client.get("/mekeru/google/", {"next": bad})
            self.assertNotContains(response, "evil.example")
            self.assertContains(response, "next=/app/")


class ProfileProvisioningTests(TestCase):
    def test_new_google_user_gets_a_foyer_profile_once(self):
        user = get_user_model().objects.create_user(username="a@example.tn", email="a@example.tn")
        first = ensure_profile(user, "Amal")
        second = ensure_profile(user, "ignored")
        self.assertEqual(first.pk, second.pk)
        self.assertEqual((first.role, first.display_name), ("foyer", "Amal"))
        self.assertEqual(Profile.objects.filter(user=user).count(), 1)

    @override_settings(MIERUKA_STAFF_EMAILS={"staff@example.tn"})
    def test_staff_user_gets_steg_profile(self):
        user = get_user_model().objects.create_user(username="staff@example.tn", email="staff@example.tn", is_staff=True)
        profile = ensure_profile(user, "")
        self.assertEqual(profile.role, "steg")
        self.assertEqual(profile.display_name, "staff@example.tn")
