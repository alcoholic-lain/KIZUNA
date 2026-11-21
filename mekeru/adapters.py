"""Google sign-in for the React app.

A Google account gets a Profile the first time it signs in, so the React API
can serve it. Staff emails (MIERUKA_STAFF_EMAILS) get the STEG role.
"""

from m10.adapters import SocialAccountAdapter as M10SocialAccountAdapter
from m12.models import Profile


def ensure_profile(user, name=""):
    """Create the user's Profile once. Returns the profile."""
    profile = Profile.objects.filter(user=user).first()
    if profile:
        return profile
    display = (name or user.email or user.username or "Foyer").strip()[:80]
    return Profile.objects.create(
        user=user,
        role="steg" if user.is_staff else "foyer",
        display_name=display,
        onboarded=True,
    )


def _name_from(sociallogin):
    data = sociallogin.account.extra_data or {}
    return data.get("name") or data.get("given_name") or ""


class SocialAccountAdapter(M10SocialAccountAdapter):
    def pre_social_login(self, request, sociallogin):
        super().pre_social_login(request, sociallogin)
        if sociallogin.is_existing:
            ensure_profile(sociallogin.user, _name_from(sociallogin))

    def save_user(self, request, sociallogin, form=None):
        user = super().save_user(request, sociallogin, form)
        ensure_profile(user, _name_from(sociallogin))
        return user
