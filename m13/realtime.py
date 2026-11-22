"""Server-side creation of short-lived OpenAI Realtime browser credentials."""
import json
import logging
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings

from kizuna.apiutils import ApiError

LOGGER = logging.getLogger("mieruka")
CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets"


def create_client_secret():
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        raise ApiError("Realtime voice is not configured. Set OPENAI_API_KEY on the server.", 503)

    payload = json.dumps({
        "session": {
            "type": "realtime",
            "model": settings.OPENAI_REALTIME_MODEL,
        },
    }).encode("utf-8")
    request = Request(
        CLIENT_SECRETS_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        LOGGER.warning("OpenAI Realtime token request failed with HTTP %s", exc.code)
        raise ApiError("OpenAI could not start a voice session. Check the server API key and project access.", 502) from exc
    except (URLError, TimeoutError, OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        LOGGER.warning("OpenAI Realtime token request could not be completed: %s", exc)
        raise ApiError("OpenAI voice service is temporarily unavailable.", 502) from exc

    value = data.get("value")
    if not isinstance(value, str) or not value.startswith("ek_"):
        LOGGER.warning("OpenAI Realtime token response did not contain a client secret")
        raise ApiError("OpenAI returned an invalid voice session credential.", 502)
    return {"value": value, "expires_at": data.get("expires_at"), "model": settings.OPENAI_REALTIME_MODEL}
