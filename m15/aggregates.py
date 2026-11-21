"""STEG back-office aggregates (module M5).

Privacy: pseudonyms (FY-xxxx) and appliance categories only; a region with fewer
than 10 households is masked. Collective meters are simulated:
    meter = monitored appliances + other household uses + common areas.
"""
from datetime import datetime, time, timedelta

from django.db.models import Count

from kizuna.apiutils import ApiError
from m11 import model as M
from m11.profiles import TN, cat
from m12.data import CO2_KG_PER_KWH, day_sum, installations, live_power, matrix, pairs, today
from m12.models import Alert, Building, Household, Region, SavingAction

MIN_HOUSEHOLDS = 10
KIND = {"surconsommation": "Surconsommation", "pic": "Pic", "veille": "Veille", "simultane": "Simultané",
        "pointe": "Pointe", "objectif": "Objectif", "ecart_compteur": "Écart compteur"}


_NET: dict = {}


def _signature():
    from django.db.models import Count, Max
    from m12.models import Event, Installation, SimState
    e = Event.objects.aggregate(n=Count("id"), m=Max("id"), x=Max("end"))
    i = Installation.objects.aggregate(n=Count("id"), m=Max("id"), x=Max("end"))
    st = SimState.objects.values_list("version", "offset_minutes").first()
    return (tuple(e.values()), tuple(i.values()), st)


def network(now, days=30):
    key = (days, _signature(), int(now.timestamp() // 120))
    if key in _NET:
        return _NET[key]
    d = today(now)
    d0 = d - timedelta(days=days - 1)
    prs = pairs(installations(since=datetime.combine(d0, time(0), tzinfo=TN)), real=set())
    households = {h.id: h for h in Household.objects.select_related("building__region")}
    buildings = {b.id: b for b in Building.objects.select_related("region")}
    bld_of = {i.id: i.household.building_id for i, _ in prs}
    mon = matrix(prs, d0, d, now)
    true = matrix(prs, d0, d, now, measured=False)
    bmeter, bmon = {}, {}
    for k in mon:
        for b in buildings.values():
            bmeter[(b.id, k)] = list(M.common_hourly(b, k, now))
            bmon[(b.id, k)] = 0.0
        for h in households.values():
            acc = bmeter[(h.building_id, k)]
            for x, v in enumerate(M.unmonitored_hourly(h, k, now)):
                acc[x] += v
        for iid, v in true[k].items():
            acc = bmeter[(bld_of[iid], k)]
            for x in range(24):
                acc[x] += v[x]
        for iid, v in mon[k].items():
            bmon[(bld_of[iid], k)] += sum(v)
    net = {"d0": d0, "d": d, "prs": prs, "idx": {i.id: i for i, _ in prs}, "households": households, "buildings": buildings,
           "mon": mon, "bmeter": bmeter, "bmon": bmon}
    if len(_NET) > 8:
        _NET.clear()
    _NET[key] = net
    return net


def _meter_day(net, b, day, now):
    return net["bmeter"][(b.id, day)]


def _bmon(net, b, day):
    return net["bmon"][(b.id, day)]


def _monitored(net, day, pred):
    return sum(sum(v) for iid, v in net["mon"][day].items() if pred(net["idx"][iid]))


def overview(now):
    from m13 import engine
    from m14.rewards import action_savings
    engine.scan_background(now)
    net = network(now)
    d = net["d"]
    daily = []
    for k in sorted(net["mon"]):
        mon = sum(_bmon(net, b, k) for b in net["buildings"].values())
        meter = sum(sum(_meter_day(net, b, k, now)) for b in net["buildings"].values())
        daily.append([k.isoformat(), round(mon, 1), round(meter, 1)])
    month = [x for x in daily if x[0][:7] == d.isoformat()[:7]]
    w7, w14 = sum(x[1] for x in daily[-8:-1]), sum(x[1] for x in daily[-15:-8])
    specs = {i.id: s for i, s in net["prs"]}
    saved = sum(sum(action_savings(a, specs.get(a.installation_id), now).values()) for a in SavingAction.objects.all())
    return {
        "counts": {"households": len(net["households"]), "buildings": len(net["buildings"]),
                   "adapters": sum(1 for i, _ in net["prs"] if i.end is None), "regions": Region.objects.count()},
        "live_w": round(sum((live_power(s, now) or 0) for i, s in net["prs"] if i.end is None)),
        "today": daily[-1][1], "today_meter": daily[-1][2],
        "month": round(sum(x[1] for x in month), 1), "month_meter": round(sum(x[2] for x in month), 1),
        "trend": round((w7 / w14 - 1) * 100, 1) if w14 else None, "daily": daily,
        "hourly": [round(x, 2) for x in day_sum(net["mon"][d])], "savings_kwh": round(saved, 2),
        "open": Alert.objects.filter(status="ouverte").count(), "regions": regions(now, net),
        "co2_month_t": round(sum(x[2] for x in month) * CO2_KG_PER_KWH / 1000, 1),
    }


def ticker(now):
    prs = pairs(installations(active=True), real=set())
    return {"live_w": round(sum((live_power(s, now) or 0) for _, s in prs)), "open": Alert.objects.filter(status="ouverte").count()}


def buildings(now):
    net = network(now, 15)
    d = net["d"]
    days = sorted(net["mon"])
    opened = dict(Alert.objects.filter(status="ouverte", building__isnull=False).values_list("building_id").annotate(n=Count("id")))
    out = []
    for b in net["buildings"].values():
        mon = [_bmon(net, b, k) for k in days]
        meter = [sum(_meter_day(net, b, k, now)) for k in days]
        untracked = [(mt - mo) / mt if mt else 0 for mo, mt in zip(mon, meter)]
        out.append({
            "code": b.code, "name": b.name, "district": b.district, "region": b.region.name, "kind": b.get_kind_display(),
            "households": sum(1 for h in net["households"].values() if h.building_id == b.id),
            "adapters": sum(1 for i, _ in net["prs"] if i.household.building_id == b.id and i.end is None),
            "today_meter": round(meter[-1], 1), "today_mon": round(mon[-1], 1),
            "untracked": round(sum(untracked[-4:-1]) / 3, 3), "untracked_ref": round(sum(untracked[:-4]) / max(1, len(untracked) - 4), 3),
            "spark": [round(x, 1) for x in meter[:-1]], "alerts": opened.get(b.id, 0),
            "live": any(h.is_live and h.building_id == b.id for h in net["households"].values()),
        })
    out.sort(key=lambda x: (-x["alerts"], x["code"]))
    return out


def building(now, code):
    b = Building.objects.select_related("region").filter(code=code).first()
    if not b:
        raise ApiError("Bâtiment introuvable", 404)
    net = network(now)
    d = net["d"]
    days = sorted(net["mon"])
    inb = lambda i: i.household.building_id == b.id
    daily = [[k.isoformat(), round(_bmon(net, b, k), 2), round(sum(_meter_day(net, b, k, now)), 2)] for k in days]
    month = [x for x in daily if x[0][:7] == d.isoformat()[:7]]
    meter_m, mon_m = sum(x[2] for x in month), sum(x[1] for x in month)
    hhs = [h for h in net["households"].values() if h.building_id == b.id]
    per_h, per_cat = {}, {}
    hourly = [0.0] * 24
    for i, _ in net["prs"]:
        if not inb(i):
            continue
        v = sum(sum(net["mon"][k].get(i.id, [])) for k in days if k.month == d.month)
        per_h[i.household_id] = per_h.get(i.household_id, 0) + v
        lab = cat(i.category)["label"]
        per_cat[lab] = per_cat.get(lab, 0) + v
        hourly = [a + x for a, x in zip(hourly, net["mon"][d][i.id])]
    opened = dict(Alert.objects.filter(status="ouverte", household__in=hhs).values_list("household_id").annotate(n=Count("id")))
    return {
        "code": b.code, "name": b.name, "district": b.district, "region": b.region.name, "meter_id": b.meter_id,
        "equation": {"meter": round(meter_m, 1), "monitored": round(mon_m, 1), "untracked": round(meter_m - mon_m, 1)},
        "today": {"meter": daily[-1][2], "monitored": daily[-1][1]}, "daily": daily,
        "hourly": {"monitored": [round(x, 3) for x in hourly], "meter": [round(x, 3) for x in _meter_day(net, b, d, now)]},
        "households": sorted([{"code": h.code, "category": h.get_category_display(), "occupants": h.occupants,
                               "kwh": round(per_h.get(h.id, 0), 1), "share": round(per_h.get(h.id, 0) / mon_m, 3) if mon_m else 0,
                               "alerts": opened.get(h.id, 0), "live": h.is_live} for h in hhs], key=lambda x: -x["kwh"]),
        "categories": sorted([{"label": k, "kwh": round(v, 1)} for k, v in per_cat.items()], key=lambda x: -x["kwh"]),
        "incidents": [incident_json(a) for a in Alert.objects.filter(building=b).select_related("household", "building__region", "installation")[:8]],
    }


def household(now, code):
    h = Household.objects.select_related("building__region").filter(code=code).first()
    if not h:
        raise ApiError("Foyer introuvable", 404)
    d = today(now)
    prs = pairs(installations([h], since=datetime.combine(d - timedelta(days=29), time(0), tzinfo=TN)), real=set())
    mx = matrix(prs, d - timedelta(days=29), d, now)
    apps = sorted([{"category": cat(i.category)["label"], "code": i.category, "adapter": i.adapter_id,
                    "kwh": round(sum(sum(r[i.id]) for r in mx.values()), 1)} for i, _ in prs], key=lambda x: -x["kwh"])
    return {"code": h.code, "category": h.get_category_display(), "occupants": h.occupants, "building": h.building.name,
            "building_code": h.building.code, "region": h.building.region.name, "appliances": apps,
            "daily": [[k.isoformat(), round(sum(sum(v) for v in r.values()), 2)] for k, r in sorted(mx.items())]}


def regions(now, net=None):
    net = net or network(now, 15)
    days = sorted(net["mon"])
    out = []
    for r in Region.objects.all():
        ids = {h.id for h in net["households"].values() if h.building.region_id == r.id}
        item = {"code": r.code, "name": r.name, "lat": r.lat, "lon": r.lon, "households": len(ids), "masked": len(ids) < MIN_HOUSEHOLDS}
        if not item["masked"]:
            inr = lambda i: i.household_id in ids
            daily = [_monitored(net, k, inr) for k in days]
            prof = [0.0] * 24
            for k in days[-8:-1]:
                for iid, v in net["mon"][k].items():
                    if inr(net["idx"][iid]):
                        prof = [a + x / 7 for a, x in zip(prof, v)]
            w7, w14 = sum(daily[-8:-1]), sum(daily[-15:-8])
            item.update({
                "buildings": r.buildings.count(), "adapters": sum(1 for i, _ in net["prs"] if inr(i) and i.end is None),
                "today": round(daily[-1], 1), "daily": [round(x, 1) for x in daily[:-1]],
                "trend": round((w7 / w14 - 1) * 100, 1) if w14 else None, "profile": [round(x, 2) for x in prof],
                "peak_share": round(sum(prof[18:22]) / sum(prof), 3) if sum(prof) else 0,
                "alerts": Alert.objects.filter(status="ouverte", building__region=r).count(),
            })
        out.append(item)
    return out


def peak(now):
    net = network(now, 8)
    d = net["d"]
    days = sorted(net["mon"])
    past = days[:-1]
    avg = [sum(day_sum(net["mon"][k])[h] for k in past) / len(past) for h in range(24)]
    shift = sum(sum(v[18:22]) for k in past for iid, v in net["mon"][k].items()
                if cat(net["idx"][iid].category).get("shiftable")) / len(past)
    return {"heat": [[k.isoformat(), [round(x, 1) for x in day_sum(net["mon"][k])]] for k in days[-7:]],
            "avg": [round(x, 2) for x in avg], "today": [round(x, 2) for x in day_sum(net["mon"][d])],
            "now_hour": now.astimezone(TN).hour, "peak_hour": max(range(24), key=lambda h: avg[h]),
            "peak_share": round(sum(avg[18:22]) / sum(avg), 3) if sum(avg) else 0, "shiftable": round(shift, 1)}


def incident_json(a):
    h = a.household
    device = cat(a.installation.category)["label"] if a.installation_id else "Parties communes"
    return {"id": a.id, "kind": a.kind, "kind_label": KIND.get(a.kind, a.kind), "severity": a.severity,
            "device": device, "household": h.code if h else None,
            "building": a.building.name if a.building else None, "building_code": a.building.code if a.building else None,
            "region": a.building.region.name if a.building else None, "detected_at": a.detected_at.isoformat(),
            "status": a.status, "measured": a.measured, "expected": a.expected, "unit": a.unit,
            "confidence": a.confidence, "kwh_month": a.kwh_month, "cause": "" if a.cause == "Historique" else a.cause,
            "rule": (a.evidence or {}).get("rule", ""), "readings": (a.evidence or {}).get("readings", [])}


def incidents(params):
    qs = Alert.objects.select_related("household", "building__region", "installation")
    st = params.get("status") or "ouverte"
    if st == "historique":
        qs = qs.exclude(status="ouverte")
    elif st != "toutes":
        qs = qs.filter(status=st)
    if params.get("severity"):
        qs = qs.filter(severity=params["severity"])
    if params.get("region"):
        qs = qs.filter(building__region__code=params["region"])
    return {"items": [incident_json(a) for a in qs[:60]], "total": qs.count(),
            "counts": {s: Alert.objects.filter(status="ouverte", severity=s).count() for s in ("critique", "elevee", "attention", "info")}}


def resolve(aid, now):
    a = Alert.objects.filter(id=aid).first()
    if not a:
        raise ApiError("Incident introuvable", 404)
    if a.status == "ouverte":
        a.status, a.resolved_at, a.resolved_by = "resolue", now, "steg"
        a.save(update_fields=["status", "resolved_at", "resolved_by"])
    return a
