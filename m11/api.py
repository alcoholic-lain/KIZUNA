"""Live feed, demo controls, adapter registry and measurement contract (module M1)."""
import json
from datetime import datetime, timedelta

from django.conf import settings
from django.db import transaction
from django.views.decorators.csrf import csrf_exempt

from kizuna.apiutils import ApiError, api, body, household_of, profile_of, require_local_demo
from m12.data import installations
from m12.models import Adapter, Alert, Event, Installation, Reading, SimState
from m14 import services
from m15 import aggregates

from . import model as M
from .seed import STOCK, reset_demo

SCENARIOS = {
    "clim": ("climatisation", "radiateur", "chauffe_eau", "compresseur"),
    "veille": ("television", "console", "ordinateur"),
    "simultane": None,
}


@api()
def live(request):
    now = M.now()
    if not request.user.is_authenticated:
        return {"now": now.isoformat()}
    p = profile_of(request)
    if p.role == "steg":
        return {"now": now.isoformat(), **aggregates.ticker(now)}
    return services.live(household_of(request), now)


@api(("GET", "POST"))
def sim(request):
    st = SimState.get()
    if request.method == "GET":
        return {"now": M.now().isoformat(), "offset": st.offset_minutes, "version": st.version}
    if not getattr(settings, "MIERUKA_DEMO_CONTROLS", True):
        raise ApiError("Contrôles de démo désactivés", 403)
    require_local_demo(request)  # also blocks accounts registered from the LAN
    profile_of(request)  # demo controls (reset, clock, scenarios) need a signed-in account
    d = body(request)
    action = d.get("action")
    if action == "reset":
        reset_demo()
        return {"ok": True, "message": "Démo réinitialisée"}
    if action == "forward":
        minutes = int(d.get("minutes") or 60)
        if minutes not in (60, 360, 1440):
            raise ApiError("Durée invalide")
        st.offset_minutes += minutes
        st.save(update_fields=["offset_minutes"])
        return {"ok": True, "message": f"+{minutes // 60} h"}
    if action == "realtime":
        st.offset_minutes = 0
        st.save(update_fields=["offset_minutes"])
        return {"ok": True, "message": "Heure réelle"}
    if action == "scenario":
        h = household_of(request)
        now = M.now()
        code = d.get("code")
        active = [i for i in installations([h], active=True)]
        if code == "clim":
            inst = next((i for c in SCENARIOS["clim"] for i in active if i.category == c), None)
            if not inst:
                raise ApiError("Aucun climatiseur ou appareil chauffant")
            Event.objects.create(installation=inst, kind="anomaly", start=now - timedelta(seconds=1), end=now + timedelta(hours=3),
                                 factor=1.7, data={"type": "surcharge", "forced": True})
            return {"ok": True, "message": f"{inst.name} force à +70 %", "installation": inst.id}
        if code == "veille":
            inst = next((i for c in SCENARIOS["veille"] for i in active if i.category == c), None)
            if not inst:
                raise ApiError("Aucun appareil avec veille")
            Event.objects.create(installation=inst, kind="anomaly", start=now - timedelta(seconds=1), end=now + timedelta(hours=12),
                                 factor=24 / max(1, inst and M.cat(inst.category)["standby_w"]), data={"type": "veille"})
            Alert.objects.create(household=h, installation=inst, building=h.building, kind="veille", severity="attention",
                                 title=f"{inst.name} : veille 24 W", cause="Veille active anormale", action="Multiprise à interrupteur",
                                 action_code="veille_off", detected_at=now, measured=24, expected=M.cat(inst.category)["standby_w"],
                                 confidence=0.82, kwh_month=17.1, evidence={"rule": "Au repos > 5 W et > 2 × la veille normale"})
            return {"ok": True, "message": f"{inst.name} en veille anormale"}
        if code == "simultane":
            heavy = [i for i in active if M.cat(i.category)["high"]][:3]
            if len(heavy) < 2:
                raise ApiError("Il faut 2 appareils puissants")
            for i in heavy:
                Event.objects.create(installation=i, kind="forced_on", start=now - timedelta(seconds=1), end=now + timedelta(minutes=40))
            return {"ok": True, "message": "Appareils lancés en même temps"}
        raise ApiError("Scénario inconnu")
    raise ApiError("Action inconnue")


MAX_BATCH = 100


def _store_reading(d):
    """Validate one reading and store it. Returns True when it is new."""
    if not isinstance(d, dict):
        raise ApiError("Chaque mesure doit être un objet JSON.")
    aid = services.normalize(d.get("adaptateur_id"))
    adapter = Adapter.objects.filter(id=aid).first()
    if not adapter:
        raise ApiError(f"Adaptateur inconnu : {aid or '?'}", 404)
    try:
        watts = float(d.get("watts"))
    except (TypeError, ValueError):
        raise ApiError("watts doit être un nombre")
    if not 0 <= watts <= 10000:
        raise ApiError("watts entre 0 et 10 000")
    # Unlabelled readings are never presented as real consumption.
    source = d.get("source") or "simulee"
    if source not in ("reelle", "simulee"):
        raise ApiError("source : reelle ou simulee")
    if source == "reelle" and not getattr(settings, "MIERUKA_ADAPTER_KEY", ""):
        # Anyone can reach this endpoint; only a producer holding the adapter key may claim a real measurement.
        raise ApiError("Mesure réelle refusée : configurez MIERUKA_ADAPTER_KEY pour les adaptateurs réels.", 403)
    try:
        ts = datetime.fromisoformat(d["horodatage"]) if d.get("horodatage") else M.now()
    except (TypeError, ValueError):
        raise ApiError("horodatage ISO 8601 attendu")
    if ts.tzinfo is None:
        raise ApiError("horodatage sans fuseau horaire")
    ts = ts.replace(microsecond=0)
    _, created = Reading.objects.get_or_create(adapter=adapter, ts=ts, defaults={"watts": watts, "source": source})
    return created


@csrf_exempt
@api(("POST",))
def mesures(request):
    """Frozen contract: one reading, or a JSON list of readings (the simulator's batch).

    A batch is acknowledged with `acquittees` (how many readings were received).
    Any invalid reading rejects the whole batch, so nothing is half-stored.
    """
    key = getattr(settings, "MIERUKA_ADAPTER_KEY", "")
    if key and request.headers.get("X-Adapter-Key") != key:
        raise ApiError("Clé d'adaptateur invalide", 403)
    try:
        data = json.loads(request.body.decode("utf-8") or "null")
    except (ValueError, UnicodeDecodeError):
        raise ApiError("Requête illisible : JSON attendu.")
    if isinstance(data, list):
        if not data or len(data) > MAX_BATCH:
            raise ApiError(f"Lot de 1 à {MAX_BATCH} mesures attendu.")
        with transaction.atomic():
            created = [_store_reading(item) for item in data]
        return {"acquittees": len(data), "stored": sum(created), "duplicate": created.count(False)}
    created = _store_reading(data)
    return {"ok": True, "acquittees": 1, "stored": created, "duplicate": not created,
            "paired": Installation.objects.filter(adapter_id=services.normalize(data.get("adaptateur_id")), end__isnull=True).exists()}


@api()
def adapter_check(request):
    a = services.validate(request.GET.get("id"), household_of(request))
    return {"id": a.id}


@api()
def registry(request):
    used = set(Installation.objects.filter(end__isnull=True).values_list("adapter_id", flat=True))
    return {"stock": [a for a in Adapter.objects.filter(id__startswith="NABD-0").values_list("id", flat=True) if a not in used]}
