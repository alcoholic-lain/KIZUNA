"""Login rules for Mieruka (django-allauth).

- Accounts are only created through Google; there is no email/password sign-up.
- A Google account whose verified email is listed in MIERUKA_STAFF_EMAILS
  becomes staff, which opens the M5 back office.
"""

from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.conf import settings


def is_staff_email(email):
    return bool(email) and email.strip().lower() in settings.MIERUKA_STAFF_EMAILS


def _verified_email(sociallogin):
    for address in sociallogin.email_addresses:
        if address.verified and address.email:
            return address.email
    data = sociallogin.account.extra_data or {}
    if data.get("email_verified") and data.get("email"):
        return data["email"]
    return None


def grant_staff_if_listed(user, email):
    """Make `user` staff when `email` is listed. Never removes staff rights."""
    if is_staff_email(email) and not user.is_staff:
        user.is_staff = True
        if user.pk:
            user.save(update_fields=["is_staff"])
        return True
    return False


class AccountAdapter(DefaultAccountAdapter):
    def is_open_for_signup(self, request):
        return False  # local sign-up is closed; Google creates accounts


class SocialAccountAdapter(DefaultSocialAccountAdapter):
    def is_open_for_signup(self, request, sociallogin):
        return True

    def pre_social_login(self, request, sociallogin):
        if sociallogin.is_existing:
            grant_staff_if_listed(sociallogin.user, _verified_email(sociallogin))

    def save_user(self, request, sociallogin, form=None):
        user = super().save_user(request, sociallogin, form)
        grant_staff_if_listed(user, _verified_email(sociallogin))
        return user
