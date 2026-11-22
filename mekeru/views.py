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


# ---------------------------------------------------------------------------
# Google sign-in from the Android app.
# Google refuses OAuth inside embedded WebViews, so the app opens
# /mekeru/google/?next=/mekeru/app/return/ in the phone's browser. Once signed
# in there, app_return hands a short-lived signed token back to the app through
# mieruka://login, and the app's WebView redeems it at app_handoff.
# The token embeds the user's last_login, and logging in updates last_login,
# so each token works once.
# ---------------------------------------------------------------------------
from django.contrib.auth import get_user_model, login
from django.core import signing
from django.shortcuts import redirect

HANDOFF_SALT = "mekeru.app-handoff"
HANDOFF_MAX_AGE = 300  # seconds


def _stamp(user):
    return user.last_login.isoformat() if user.last_login else ""


def app_return(request):
    """In the phone's browser, after Google: send the session back to the app."""
    next_path = _safe_next(request.GET.get("next"))
    if not request.user.is_authenticated:
        return redirect(f"/mekeru/google/?next={quote('/mekeru/app/return/?next=' + quote(next_path))}")
    token = signing.dumps({"u": request.user.pk, "l": _stamp(request.user), "n": next_path}, salt=HANDOFF_SALT)
    return render(request, "mekeru/app_return.html", {"link": f"mieruka://login?token={quote(token)}"})


def app_handoff(request):
    """In the app's WebView: redeem the token and sign the WebView in."""
    try:
        data = signing.loads(request.GET.get("token", ""), salt=HANDOFF_SALT, max_age=HANDOFF_MAX_AGE)
        user = get_user_model().objects.get(pk=data["u"], is_active=True)
    except (signing.BadSignature, get_user_model().DoesNotExist, KeyError, TypeError):
        return render(request, "mekeru/app_return.html", {"error": "Lien de connexion expiré ou invalide."}, status=400)
    if _stamp(user) != data.get("l"):
        return render(request, "mekeru/app_return.html", {"error": "Ce lien de connexion a déjà été utilisé."}, status=400)
    login(request, user, backend="allauth.account.auth_backends.AuthenticationBackend")
    return redirect(_safe_next(data.get("n")))
