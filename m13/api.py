"""AI analysis, alerts and recommendations (module M3)."""
from kizuna.apiutils import ApiError, api, body, household_of
from m11 import model as M
from m12.models import Alert, Installation
from m14 import rewards
from m14.services import alert_json, household_pairs, live as live_snapshot
from m14.tariff import monthly_bill

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
    snap = live_snapshot(h, now, scan=False)
    other_month = h.unmonitored_base_w * 24 * forecast_data["days_in_month"] / 1000
    bill = monthly_bill(forecast_data["month_kwh"] + other_month, h.subscribed_kva)
    devices = sorted(snap["devices"], key=lambda x: -(x["month_kwh"] or 0))
    return {
        "app_state": {
            "household_type": h.category, "region": h.building.region.name, "subscribed_kva": h.subscribed_kva,
            "device_count": len(devices), "current_total_watts": snap["power"],
            "open_alerts_count": snap["open_alerts"], "energy_tokens_balance": snap["tokens"],
            "tokens_earned_today": snap["tokens_today"], "savings_kwh": snap["savings"]["kwh"],
            "savings_co2_kg": snap["savings"]["co2_kg"],
            "estimated_month_bill_dt": bill["total"], "tariff_price_dt_per_kwh": bill["avg_price"],
        },
        "devices": [{
            "id": d["id"], "name": d["name"], "category": d["category"], "room": d["room"],
            "is_on_now": d["on"], "watts_now": d["power"], "today_kwh": d["today_kwh"], "month_kwh": d["month_kwh"],
            "monitored_by_adapter": d["monitoring"], "data_source": "measured" if d["source"] == "reelle" else "simulated",
            "has_open_anomaly": d["anomaly"],
        } for d in devices],
        "open_alerts": [{
            "id": a["id"], "device": a["device"], "severity": a["severity"], "title": a["title"], "cause": a["cause"],
            "suggested_action": a["action"], "extra_kwh_per_month": a["kwh_month"],
        } for a in snap["alerts"]],
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
