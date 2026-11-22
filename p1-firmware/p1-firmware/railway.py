"""Shared configuration for the simulator's Railway uplink."""
import os
from urllib.parse import urlsplit

DEFAULT_RECEIVER = "https://mieruka-endpoint-production.up.railway.app"


def railway_settings(endpoint, token=None):
    endpoint = endpoint.strip().rstrip("/")
    url = urlsplit(endpoint)
    local = url.hostname in {"localhost", "127.0.0.1", "::1"}
    if not url.hostname or url.username or url.password or url.query or url.fragment:
        raise ValueError("MIERUKA_ENDPOINT must be the Railway base URL or its /mesures URL.")
    if url.hostname == "vercel.app" or url.hostname.endswith(".vercel.app"):
        raise ValueError("MIERUKA_ENDPOINT must point to Railway. Set MIERUKA_WEB for the Vercel app.")
    if url.scheme != "https" and not (local and url.scheme == "http"):
        raise ValueError("MIERUKA_ENDPOINT must use HTTPS outside localhost.")
    if url.path not in {"", "/mesures"}:
        raise ValueError("MIERUKA_ENDPOINT must be the Railway base URL or its /mesures URL.")
    if token is None:
        token = os.environ.get("MIERUKA_API_TOKEN") or os.environ.get("API_TOKEN", "")
    token = token.strip()
    if not token and not local:
        raise ValueError("Set MIERUKA_API_TOKEN to the Railway service's API_TOKEN before starting.")
    if token.lower().startswith("bearer "):
        raise ValueError("Use the raw Railway token value. The simulator adds the Bearer prefix.")
    return endpoint.removesuffix("/mesures"), token
