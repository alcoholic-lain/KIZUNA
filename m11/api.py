"""Live feed, demo controls, adapter registry and measurement contract (module M1)."""
from datetime import datetime, timedelta

from django.conf import settings
from django.views.decorators.csrf import csrf_exempt

from kizuna.apiutils import ApiError, api, body, household_of, profile_of
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


@csrf_exempt
@api(("POST",))
def mesures(request):
    """Frozen contract: {adaptateur_id, horodatage, watts, source}."""
    key = getattr(settings, "MIERUKA_ADAPTER_KEY", "")
    if key and request.headers.get("X-Adapter-Key") != key:
        raise ApiError("Clé d'adaptateur invalide", 403)
    d = body(request)
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
    source = d.get("source") or "reelle"
    if source not in ("reelle", "simulee"):
        raise ApiError("source : reelle ou simulee")
    try:
        ts = datetime.fromisoformat(d["horodatage"]) if d.get("horodatage") else M.now()
    except (TypeError, ValueError):
        raise ApiError("horodatage ISO 8601 attendu")
    if ts.tzinfo is None:
        raise ApiError("horodatage sans fuseau horaire")
    ts = ts.replace(microsecond=0)
    _, created = Reading.objects.get_or_create(adapter=adapter, ts=ts, defaults={"watts": watts, "source": source})
    return {"ok": True, "stored": created, "duplicate": not created,
            "paired": Installation.objects.filter(adapter=adapter, end__isnull=True).exists()}


@api()
def adapter_check(request):
    a = services.validate(request.GET.get("id"), household_of(request))
    return {"id": a.id}


@api()
def registry(request):
    used = set(Installation.objects.filter(end__isnull=True).values_list("adapter_id", flat=True))
    return {"stock": [a for a in Adapter.objects.filter(id__startswith="NABD-0").values_list("id", flat=True) if a not in used]}
