"""AI analysis, alerts and recommendations (module M3)."""
from kizuna.apiutils import ApiError, api, body, household_of
from m11 import model as M
from m12.models import Alert, Installation
from m14 import rewards
from m14.services import alert_json, household_pairs

from . import engine


@api()
def analysis(request):
    h = household_of(request)
    now = M.now()
    prs = household_pairs(h, now, 40)
    recos, price = engine.recommendations(h, now, prs)
    return {
        "alerts": [alert_json(a) for a in Alert.objects.filter(household=h).select_related("installation")[:25]],
        "forecast": engine.forecast(h, now, prs), "habits": engine.habits(h, now, prs),
        "recommendations": recos, "price": price,
    }


@api()
def alert_detail(request, aid):
    h = household_of(request)
    a = Alert.objects.select_related("installation").filter(household=h, id=aid).first()
    if not a:
        raise ApiError("Alerte introuvable", 404)
    return alert_json(a)


@api(("POST",))
def alert_apply(request, aid):
    h = household_of(request)
    a = Alert.objects.select_related("installation").filter(household=h, id=aid).first()
    if not a:
        raise ApiError("Alerte introuvable", 404)
    if a.status != "ouverte":
        raise ApiError("Déjà traitée", 409)
    return {"ok": True, "message": rewards.apply_alert(a, M.now())}


@api(("POST",))
def alert_ignore(request, aid):
    h = household_of(request)
    updated = Alert.objects.filter(household=h, id=aid, status="ouverte").update(status="ignoree", resolved_at=M.now(), resolved_by="utilisateur")
    if not updated:
        raise ApiError("Alerte introuvable", 404)
    return {"ok": True}


@api(("POST",))
def reco_apply(request):
    h = household_of(request)
    d = body(request)
    code = d.get("code")
    now = M.now()
    if code not in ("veille_off", "clim_consigne", "mode_eco", "thermostat"):
        raise ApiError("Recommandation inconnue")
    insts = list(Installation.objects.filter(household=h, id__in=d.get("installations") or [], end__isnull=True))
    if not insts:
        raise ApiError("Aucun appareil concerné")
    msg = ""
    for i in insts:
        msg = rewards.apply_code(h, code, i, now)
    return {"ok": True, "message": msg}
