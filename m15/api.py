"""STEG back-office endpoints (module M5). Aggregated and pseudonymised."""
from kizuna.apiutils import api, require_steg
from m11 import model as M

from . import aggregates as A
from .receiver import receiver_readings


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


@api()
def telemetry(request):
    require_steg(request)
    return receiver_readings()
