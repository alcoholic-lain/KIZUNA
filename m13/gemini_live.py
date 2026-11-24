"""Server-side creation of short-lived Gemini Live browser credentials."""
import json
import logging
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings

from kizuna.apiutils import ApiError

LOGGER = logging.getLogger("mieruka")
AUTH_TOKENS_URL = "https://generativelanguage.googleapis.com/v1beta/auth_tokens"


AGENT_INSTRUCTIONS = """You are WATT'FLOW, the voice assistant built into the Mieruka energy app (KIZUNA 2026). You are NOT a general chatbot: you only help with THIS user's household, devices, bill, alerts and rewards inside this app. If asked about unrelated topics, politely say you only help with their energy in Mieruka and steer back.
Automatically detect the language the user is speaking and reply in that same language. Support English, Japanese, and Arabic. For Arabic, understand Tunisian Derja and reply in natural Tunisian Arabic; use Modern Standard Arabic only if the user asks for it. Never force the conversation into English or translate unless asked.
Speak naturally and briefly, usually one to three sentences. Always refer to the user's real devices by their exact names and rooms (for example "your Living-room air conditioner"), with their real numbers (watts now, kWh today, kWh this month). Never give generic energy tips when a specific device of theirs applies: rank by their actual consumption.

WHAT THE APP CONTAINS (guide the user to these screens by name):
- Home: live power, today's energy and cost, the estimated STEG bill, the monthly goal, a score.
- Devices: every appliance with its adapter (NABD QR adapters), live watts, anomalies, add/pair a device by scanning its QR.
- AI Analysis (the page you are on): forecast, 3-day weather-aware mission and peak window, alerts with evidence, recommendations that can be applied after confirmation.
- Rewards: Energy Tokens (virtual rewards, never electricity credits), challenges, solidarity projects. The app rewards savings and never punishes or cuts power.
- Explore: history, energy flows (Sankey), learning, and the Tunisia-Japan comparison.

DATA RULES: You receive a SNAPSHOT of the user's real app data at the start of the session. Call get_energy_context to refresh it whenever the user asks about current usage, a device, an alert, the bill, the forecast, risk, peak, weather, tokens or recommendations, and always before quoting live numbers. Treat that data as the ONLY source of household facts. If a device, number or feature is not in the data, say you cannot see it; never invent devices, usage, weather, prices, confidence or savings. Clearly distinguish measured readings from simulated data and from forecasts or estimates (the data labels each device as measured or simulated). Mention open alerts and the device they concern when relevant, and the suggested action.
SAFETY: Give practical, affordable advice that preserves health and comfort. Never recommend turning off refrigerators, medical devices, safety equipment, or essential systems. You have no device-control tools: never claim an action was executed; explain which button or screen in the app to use (alerts and recommendations are applied by the user after confirmation). If information is missing, say so plainly."""

TOOLS = [{
    "functionDeclarations": [{
        "name": "get_energy_context",
        "description": "Read the signed-in user's live app data: their devices (name, room, watts now, kWh today/month, measured or simulated, anomalies), open alerts, bill estimate, Energy Tokens, forecast, weather, peak risk and recommended actions. Call it whenever a question concerns their own household or any screen of the app.",
        "parameters": {"type": "OBJECT", "properties": {}},
    }],
}]


def build_instructions(snapshot):
    """System prompt with the user's real app data. It must live in the token itself: Gemini ignores
    systemInstruction/tools sent by the browser over a constrained-token connection."""
    return (AGENT_INSTRUCTIONS + "\n\nSNAPSHOT OF THE USER'S APP DATA AT SESSION START (JSON; call get_energy_context for fresh values):\n"
            + json.dumps(snapshot, ensure_ascii=False))


def create_ephemeral_token(snapshot=None):
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise ApiError("Gemini Live voice is not configured. Set GEMINI_API_KEY on the server.", 503)

    payload = json.dumps({
        "uses": 1,
        "bidiGenerateContentSetup": {
            "model": f"models/{settings.GEMINI_LIVE_MODEL}",
            "generationConfig": {
                "responseModalities": ["AUDIO"],
            },
            "systemInstruction": {"parts": [{"text": build_instructions(snapshot or {})}]},
            "tools": TOOLS,
        },
    }).encode("utf-8")
    request = Request(
        AUTH_TOKENS_URL,
        data=payload,
        headers={
            "x-goog-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        LOGGER.warning("Gemini Live token request failed with HTTP %s", exc.code)
        raise ApiError("Gemini could not start a voice session. Check the server API key and project access.", 502) from exc
    except (URLError, TimeoutError, OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        LOGGER.warning("Gemini Live token request could not be completed: %s", exc)
        raise ApiError("Gemini Live service is temporarily unavailable.", 502) from exc

    value = data.get("name") if isinstance(data, dict) else None
    if not isinstance(value, str) or not value:
        LOGGER.warning("Gemini Live token response did not contain an ephemeral token")
        raise ApiError("Gemini returned an invalid voice session credential.", 502)
    return {"value": value, "expires_at": data.get("expireTime"), "model": settings.GEMINI_LIVE_MODEL}
