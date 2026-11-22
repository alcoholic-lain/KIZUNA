"""AI analysis, alerts and recommendations (module M3)."""
from kizuna.apiutils import ApiError, api, body, household_of
from m11 import model as M
from m12.models import Alert, Installation
from m14 import rewards
from m14.services import alert_json, household_pairs

from . import engine, gemini_live


@api()
def analysis(request):
    h = household_of(request)
    now = M.now()
    prs = household_pairs(h, now, 40)
    recos, price = engine.recommendations(h, now, prs)
    forecast_data = engine.forecast(h, now, prs)
    habits_data = engine.habits(h, now, prs)
    return {
        "alerts": [alert_json(a) for a in Alert.objects.filter(household=h).select_related("installation")[:25]],
        "forecast": forecast_data, "habits": habits_data,
        "mission": engine.preventive_mission(h, now, prs, forecast_data, habits_data, recos),
        "recommendations": recos, "price": price,
    }


@api(("POST",))
def gemini_live_token(request):
    household_of(request)
    if body(request).get("consent") is not True:
        raise ApiError("Consent is required before starting a Gemini Live voice session.", 400)
    return gemini_live.create_ephemeral_token()


@api()
def voice_context(request):
    h = household_of(request)
    now = M.now()
    prs = household_pairs(h, now, 40)
    forecast_data = engine.forecast(h, now, prs)
    habits_data = engine.habits(h, now, prs)
    recos, _ = engine.recommendations(h, now, prs)
    mission = engine.preventive_mission(h, now, prs, forecast_data, habits_data, recos)
    return {
        "source": "measured" if any(spec.real for _, spec in prs) else "simulated",
        "today_kwh": forecast_data["today_kwh"],
        "today_expected_kwh": forecast_data["today_expected"],
        "month_forecast_kwh": forecast_data["month_kwh"],
        "monthly_goal_kwh": forecast_data["goal_kwh"],
        "risk": mission["risk_label"],
        "predicted_peak": {
            "date": mission["date"],
            "from": mission["peak_start"],
            "to": mission["peak_end"],
            "confidence": mission["confidence"],
        },
        "weather": {
            key: mission["weather"].get(key)
            for key in ("available", "date", "condition", "max_c", "min_c", "apparent_max_c", "humidity_max",
                        "precipitation_probability", "detail")
        },
        "factors": mission["factors"],
        "actions": [{"title": action["title"], "reason": action["reason"]} for action in mission["actions"][:3]],
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
