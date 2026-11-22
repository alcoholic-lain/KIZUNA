"""Server-side creation of short-lived Gemini Live browser credentials."""
import json
import logging
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings

from kizuna.apiutils import ApiError

LOGGER = logging.getLogger("mieruka")
AUTH_TOKENS_URL = "https://generativelanguage.googleapis.com/v1beta/auth_tokens"


def create_ephemeral_token():
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise ApiError("Gemini Live voice is not configured. Set GEMINI_API_KEY on the server.", 503)

    payload = json.dumps({
        "uses": 1,
        "liveConnectConstraints": {
            "model": f"models/{settings.GEMINI_LIVE_MODEL}",
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
