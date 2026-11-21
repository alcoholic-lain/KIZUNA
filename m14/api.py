"""Household, rewards, solidarity and company endpoints (module M4)."""
from kizuna.apiutils import ApiError, api, body, household_of, profile_of
from m11 import model as M
from m12.models import TokenTx

from . import rewards, services


@api()
def home(request):
    return services.home(household_of(request), M.now())


@api(("GET", "POST"))
def devices(request):
    h = household_of(request)
    now = M.now()
    if request.method == "POST":
        inst = services.pair(h, body(request), now)
        return {"ok": True, "id": inst.id, "message": f"{inst.name} connecté"}
    return services.live(h, now, scan=False)


@api(("GET", "POST", "DELETE"))
def device(request, iid):
    h = household_of(request)
    now = M.now()
    if request.method == "POST":
        services.update_device(h, iid, body(request), now)
        return {"ok": True}
    if request.method == "DELETE":
        services.unpair(h, iid, now)
        return {"ok": True}
    return services.device_detail(h, iid, now)


@api()
def history(request):
    g = request.GET
    return services.history(household_of(request), M.now(), g.get("period", "semaine"), g.get("start"), g.get("end"))


@api()
def rewards_view(request):
    p = profile_of(request)
    h = household_of(request)
    now = M.now()
    prs = services.household_pairs(h, now, 40)
    sav = rewards.savings(h, now, prs)
    return {"ledger": rewards.ledger(h, now, prs, sav), "score": rewards.score_bundle(h, now, prs),
            "challenges": rewards.challenges(h, p.role, now, prs), "catalog": rewards.CATALOG,
            "savings": {"kwh": sav["kwh"], "co2_kg": sav["co2_kg"], "active": sav["active"]}}


@api(("POST",))
def redeem(request):
    h = household_of(request)
    now = M.now()
    item = next((x for x in rewards.CATALOG if x["code"] == body(request).get("code")), None)
    if not item:
        raise ApiError("Récompense inconnue")
    if rewards.ledger(h, now)["balance"] < item["cost"]:
        raise ApiError("Solde insuffisant")
    TokenTx.objects.create(household=h, ts=now, amount=-item["cost"], kind="depense", label=item["title"])
    return {"ok": True, "message": item["title"]}


@api(("POST",))
def challenge(request, code):
    h = household_of(request)
    now = M.now()
    ok, msg = rewards.claim(h, code, now, services.household_pairs(h, now, 10))
    return {"ok": ok, "message": msg}


@api(("GET", "POST"))
def solidarity(request):
    p = profile_of(request)
    h = household_of(request) if p.role != "steg" else None
    if request.method == "POST":
        d = body(request)
        now = M.now()
        if p.role == "steg":
            raise ApiError("Réservé aux foyers et entreprises", 403)
        if d.get("tokens"):
            services.donate(h, d.get("project"), d.get("tokens"), now)
        elif p.role == "entreprise":
            services.contribute(h, p.display_name, d.get("project"), d.get("amount"), now)
        else:
            raise ApiError("Dons en dinars réservés aux entreprises", 403)
        return {"ok": True}
    data = services.solidarity(h)
    if h:
        data["balance"] = rewards.ledger(h, M.now())["balance"]
    return data


@api()
def company(request):
    if profile_of(request).role != "entreprise":
        raise ApiError("Réservé aux entreprises", 403)
    return services.company(household_of(request), M.now())


@api()
def flows(request):
    return services.flows(household_of(request), M.now(), request.GET.get("scope", "foyer"))
