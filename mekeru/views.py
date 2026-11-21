from urllib.parse import quote

from django.conf import settings
from django.shortcuts import render

GOOGLE_LOGIN = "/accounts/google/login/"


def _safe_next(path):
    """Only allow same-site paths, so the redirect can't leave the site."""
    if path and path.startswith("/") and not path.startswith("//") and "\\" not in path:
        return path
    return "/app/"


def google_start(request):
    """Auto-submitting POST to allauth's Google login (allauth needs POST + CSRF)."""
    configured = bool(getattr(settings, "GOOGLE_LOGIN_CONFIGURED", False))
    action = f"{GOOGLE_LOGIN}?process=login&next={quote(_safe_next(request.GET.get('next')))}"
    return render(request, "mekeru/google_start.html", {"configured": configured, "action": action}, status=200 if configured else 503)
