"""STEG back-office endpoints (module M5). Aggregated and pseudonymised."""
import json
import os
from urllib.request import HTTPRedirectHandler, Request, build_opener

from kizuna.apiutils import ApiError, api, require_steg
from m11 import model as M

from . import aggregates as A


@api()
def overview(request):
    require_steg(request)
    return A.overview(M.now())


@api()
def buildings(request):
    require_steg(request)
    return {"items": A.buildings(M.now())}


@api()
def building(request, code):
    require_steg(request)
    return A.building(M.now(), code)


@api()
def household(request, code):
    require_steg(request)
    return A.household(M.now(), code)


@api()
def peak(request):
    require_steg(request)
    return A.peak(M.now())


@api()
def incidents(request):
    require_steg(request)
    return A.incidents(request.GET)


@api(("POST",))
def resolve(request, aid):
    require_steg(request)
    A.resolve(aid, M.now())
    return {"ok": True}


class ReceiverRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


@api()
def telemetry(request):
    """Read the standalone receiver using a server-side credential."""
    require_steg(request)
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
