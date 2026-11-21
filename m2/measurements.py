import json
import math
from datetime import timezone

from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils.dateparse import parse_datetime
from django.utils.timezone import is_aware
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_POST

from .models import Mesure

ADAPTER_IDS = tuple(f"NABD-{number:04d}" for number in range(1, 6))


def parse_reading(data):
    if not isinstance(data, dict) or data.get("adaptateur_id") not in ADAPTER_IDS:
        raise ValueError("Identifiant d’adaptateur inconnu.")
    watts = data.get("watts")
    if type(watts) not in (int, float) or watts < 0 or not math.isfinite(watts):
        raise ValueError("La puissance doit être un nombre positif ou nul.")
    if data.get("source") not in ("simulee", "reelle"):
        raise ValueError("Source de mesure inconnue.")
    try:
        timestamp = parse_datetime(str(data.get("horodatage", "")))
        if timestamp is None or not is_aware(timestamp):
            raise ValueError
        timestamp = timestamp.astimezone(timezone.utc)
    except (ValueError, OverflowError):
        raise ValueError("Indiquez un horodatage ISO avec son fuseau horaire.") from None
    return Mesure(
        adaptateur_id=data["adaptateur_id"],
        horodatage=timestamp,
        watts=watts,
        source=data["source"],
    )


@require_GET
@never_cache
def csrf_token(request):
    """Issue Django's cookie/token pair to a headless telemetry producer."""
    return JsonResponse({"csrfToken": get_token(request)})


@require_POST
def ingest(request):
    try:
        data = json.loads(request.body)
        batch = data if isinstance(data, list) else [data]
        if not 1 <= len(batch) <= 100:
            raise ValueError("Envoyez entre 1 et 100 mesures.")
        readings = [parse_reading(item) for item in batch]
    except (UnicodeError, json.JSONDecodeError):
        return JsonResponse({"erreur": "Le contenu doit être un document JSON valide."}, status=400)
    except OverflowError:
        return JsonResponse({"erreur": "La puissance dépasse la plage acceptée."}, status=400)
    except ValueError as exc:
        return JsonResponse({"erreur": str(exc)}, status=400)

    # A lost acknowledgement can cause a whole batch to be replayed.
    Mesure.objects.bulk_create(readings, ignore_conflicts=True)
    return JsonResponse({"acquittees": len(readings)})
