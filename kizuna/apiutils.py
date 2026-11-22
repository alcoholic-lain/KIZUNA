"""Small helpers shared by the JSON API of every module."""
import ipaddress
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
        raise ApiError("Unreadable request: JSON expected.")
    if not isinstance(data, dict):
        raise ApiError("Unreadable request: JSON object expected.")
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


LOCAL_ONLY_MESSAGE = "Demo reserved for the presentation computer."


def is_local_request(request):
    """True when the client is this machine (loopback). X-Forwarded-For is deliberately ignored."""
    try:
        ip = ipaddress.ip_address(request.META.get("REMOTE_ADDR", ""))
    except ValueError:
        return False
    if getattr(ip, "ipv4_mapped", None):
        ip = ip.ipv4_mapped
    return ip.is_loopback


def require_local_demo(request):
    """With MIERUKA_DEMO_LOCAL_ONLY on, demo accounts and demo controls only answer this machine."""
    if getattr(settings, "MIERUKA_DEMO_LOCAL_ONLY", False) and not is_local_request(request):
        raise ApiError(LOCAL_ONLY_MESSAGE, 403)


def profile_of(request):
    if not request.user.is_authenticated:
        raise ApiError("Connectez-vous pour continuer.", 401)
    profile = getattr(request.user, "profile", None)
    if profile is None:
        raise ApiError("Profil introuvable pour ce compte.", 403)
    if profile.is_demo:
        # Covers every way a demo session can exist: one-click, password or allauth login.
        require_local_demo(request)
    return profile


def household_of(request):
    profile = profile_of(request)
    if profile.role == "steg":
        raise ApiError("This area is reserved for households and businesses.", 403)
    if profile.household is None:
        from m11.seed import create_household_for
        profile.household = create_household_for(profile)
        profile.save(update_fields=["household"])
    return profile.household


def require_steg(request):
    profile = profile_of(request)
    if profile.role != "steg":
        raise ApiError("Area reserved for STEG administrators.", 403)
    return profile


def api(methods=("GET",)):
    """Decorator: JSON in/out, French error messages, demo data seeded."""

    def deco(fn):
        @wraps(fn)
        def wrapper(request, *args, **kwargs):
            if request.method not in methods:
                return JsonResponse({"error": "Method not allowed."}, status=405)
            try:
                ensure_seeded()
                result = fn(request, *args, **kwargs)
            except ApiError as e:
                return JsonResponse({"error": e.message}, status=e.status)
            except Exception:  # pragma: no cover - last-resort message for the demo
                log.exception("API error")
                return JsonResponse({"error": "Internal error. Retry or reset the demo."}, status=500)
            if not isinstance(result, JsonResponse):
                result = JsonResponse(result, safe=False, json_dumps_params={"ensure_ascii": False})
            result["Cache-Control"] = "no-store"
            return result

        return wrapper

    return deco
