import json
import os
from urllib.request import HTTPRedirectHandler, Request, build_opener

from kizuna.apiutils import ApiError


class ReceiverRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def receiver_readings():
    """Read the standalone receiver using a server-side credential."""
    token = os.environ.get("MIERUKA_RECEIVER_TOKEN")
    if not token:
        return {"configured": False, "readings": []}

    url = "https://mieruka-endpoint-production.up.railway.app/readings"
    req = Request(url, headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
    try:
        with build_opener(ReceiverRedirectHandler()).open(req, timeout=3) as response:
            readings = json.load(response)
        if not isinstance(readings, list):
            raise ValueError("Unexpected receiver response")
    except (OSError, ValueError) as exc:
        raise ApiError("Le récepteur Railway est indisponible.", 502) from exc
    return {"configured": True, "readings": readings}
