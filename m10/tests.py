from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse

from .adapters import AccountAdapter, grant_staff_if_listed, is_staff_email


class SignInPageTests(TestCase):
    @override_settings(GOOGLE_LOGIN_CONFIGURED=True)
    def test_shows_google_button_when_configured(self):
        response = self.client.get(reverse("m10:index"))
        self.assertContains(response, "Continue with Google")

    @override_settings(GOOGLE_LOGIN_CONFIGURED=False)
    def test_explains_missing_configuration(self):
        response = self.client.get(reverse("m10:index"))
        self.assertContains(response, "not configured")
        self.assertNotContains(response, "Continue with Google")

    def test_ignores_external_next(self):
        response = self.client.get(reverse("m10:index"), {"next": "https://evil.example/"})
        self.assertEqual(response.context["next"], "")

    def test_staff_sees_back_office_link(self):
        staff = get_user_model().objects.create_user("s", email="s@example.com", is_staff=True)
        self.client.force_login(staff)
        self.assertContains(self.client.get(reverse("m10:index")), "Open the back office")


@override_settings(MIERUKA_STAFF_EMAILS={"boss@example.com"})
class StaffRuleTests(TestCase):
    def test_listed_email_is_case_insensitive(self):
        self.assertTrue(is_staff_email("Boss@Example.com "))
        self.assertFalse(is_staff_email("someone@example.com"))
        self.assertFalse(is_staff_email(None))

    def test_listed_account_becomes_staff(self):
        user = get_user_model().objects.create_user("boss", email="boss@example.com")
        self.assertTrue(grant_staff_if_listed(user, "boss@example.com"))
        user.refresh_from_db()
        self.assertTrue(user.is_staff)

    def test_unlisted_account_stays_regular(self):
        user = get_user_model().objects.create_user("guest", email="guest@example.com")
        self.assertFalse(grant_staff_if_listed(user, "guest@example.com"))
        user.refresh_from_db()
        self.assertFalse(user.is_staff)

    def test_password_sign_up_is_closed(self):
        self.assertFalse(AccountAdapter().is_open_for_signup(None))


@override_settings(
    GOOGLE_LOGIN_CONFIGURED=True,
    SECURE_PROXY_SSL_HEADER=("HTTP_X_FORWARDED_PROTO", "https"),
    ACCOUNT_DEFAULT_HTTP_PROTOCOL="https",
    ALLOWED_HOSTS=["kizuna-temp.vercel.app"],
    SOCIALACCOUNT_PROVIDERS={"google": {"APP": {"client_id": "id", "secret": "s"}}},
)
class GoogleRedirectTests(TestCase):
    def test_callback_uses_https_behind_vercel_proxy(self):
        response = self.client.post(
            "/accounts/google/login/",
            HTTP_HOST="kizuna-temp.vercel.app",
            HTTP_X_FORWARDED_PROTO="https",
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("accounts.google.com", response["Location"])
        self.assertIn(
            "redirect_uri=https%3A%2F%2Fkizuna-temp.vercel.app%2Faccounts%2Fgoogle%2Flogin%2Fcallback%2F",
            response["Location"],
        )
