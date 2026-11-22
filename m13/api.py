"""AI analysis, alerts and recommendations (module M3)."""
from kizuna.apiutils import ApiError, api, body, household_of
from m11 import model as M
from m12.models import Alert, Installation
from m14 import rewards
from m14.services import alert_json, household_pairs

from . import chat as energy_chat, engine


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
def chat(request):
    h = household_of(request)
    messages = body(request).get("messages")
    if not isinstance(messages, list) or not messages or len(messages) > 12:
        raise ApiError("Send between 1 and 12 chat messages.")
    valid_messages = []
    for message in messages:
        if not isinstance(message, dict) or message.get("role") not in ("user", "assistant"):
            raise ApiError("Each message must have a user or assistant role.")
        content = message.get("content")
        if not isinstance(content, str) or not content.strip() or len(content) > 500:
            raise ApiError("Each message must contain 1 to 500 characters.")
        valid_messages.append({"role": message["role"], "content": content.strip()})
    if valid_messages[-1]["role"] != "user":
        raise ApiError("The last chat message must be from the user.")

    now = M.now()
    prs = household_pairs(h, now, 40)
    forecast_data = engine.forecast(h, now, prs)
    habits_data = engine.habits(h, now, prs)
    recos, _ = engine.recommendations(h, now, prs)
    mission = engine.preventive_mission(h, now, prs, forecast_data, habits_data, recos)
    source = "real" if any(spec.real for _, spec in prs) else "simulated"
    facts = {"forecast": forecast_data, "mission": mission, "source": source}
    return {"reply": energy_chat.reply(valid_messages, facts), "language": "en", "provider": "local"}


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
