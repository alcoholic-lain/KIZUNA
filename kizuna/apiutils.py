"""Small helpers shared by the JSON API of every module."""
import json
import logging
from functools import wraps

from django.conf import settings
from django.http import JsonResponse

log = logging.getLogger("mieruka")


class ApiError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def body(request):
    if not request.body:
        return {}
    try:
        data = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        raise ApiError("Requête illisible : JSON attendu.")
    if not isinstance(data, dict):
        raise ApiError("Requête illisible : objet JSON attendu.")
    return data


def demo_reset_allowed():
    return bool(getattr(settings, "MIERUKA_DEMO_RESET", False))


def ensure_seeded():
    """Seed an empty demo database. Never wipes existing data unless the reset flag is on."""
    from m12.models import SimState
    if SimState.objects.filter(pk=1).exists() or not demo_reset_allowed():
        return
    from m11.seed import reset_demo
    reset_demo()


def profile_of(request):
    if not request.user.is_authenticated:
        raise ApiError("Connectez-vous pour continuer.", 401)
    profile = getattr(request.user, "profile", None)
    if profile is None:
        raise ApiError("Profil introuvable pour ce compte.", 403)
    return profile


def household_of(request):
    profile = profile_of(request)
    if profile.role == "steg":
        raise ApiError("Cet espace est réservé aux foyers et aux entreprises.", 403)
    if profile.household is None:
        from m11.seed import create_household_for
        profile.household = create_household_for(profile)
        profile.save(update_fields=["household"])
    return profile.household


def require_steg(request):
    profile = profile_of(request)
    if profile.role != "steg":
        raise ApiError("Espace réservé aux administrateurs STEG.", 403)
    return profile


def api(methods=("GET",)):
    """Decorator: JSON in/out, French error messages, demo data seeded."""

    def deco(fn):
        @wraps(fn)
        def wrapper(request, *args, **kwargs):
            if request.method not in methods:
                return JsonResponse({"error": "Méthode non autorisée."}, status=405)
            try:
                ensure_seeded()
                result = fn(request, *args, **kwargs)
            except ApiError as e:
                return JsonResponse({"error": e.message}, status=e.status)
            except Exception:  # pragma: no cover - last-resort message for the demo
                log.exception("API error")
                return JsonResponse({"error": "Erreur interne. Réessayez ou réinitialisez la démo."}, status=500)
            if isinstance(result, JsonResponse):
                return result
            return JsonResponse(result, safe=False, json_dumps_params={"ensure_ascii": False})

        return wrapper

    return deco
