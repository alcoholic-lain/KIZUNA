"""Household and company read models (module M4)."""
import calendar
import re
from datetime import date, datetime, time, timedelta

from django.db.models import Sum

from kizuna.apiutils import ApiError
from m11 import model as M
from m11.profiles import CATALOG, TN, cat
from m12.data import (CO2_KG_PER_KWH, day_sum, installations, label, live_power, matrix, pairs, today, totals)
from m12.models import Adapter, Alert, Contribution, Event, Installation, SolidarityProject

from . import rewards
from .tariff import monthly_bill

ID_RE = re.compile(r"^NABD-\d{4}$")


def alert_json(a):
    return {
        "id": a.id, "kind": a.kind, "severity": a.severity, "title": a.title, "cause": a.cause, "action": a.action,
        "action_code": a.action_code, "detected_at": a.detected_at.isoformat(), "status": a.status,
        "measured": a.measured, "expected": a.expected, "unit": a.unit, "confidence": a.confidence,
        "kwh_month": a.kwh_month, "installation": a.installation_id,
        "device": label(a.installation) if a.installation_id else None,
        "category": a.installation.category if a.installation_id else None,
        "evidence": a.evidence,
    }


def household_pairs(h, now, days=40):
    since = datetime.combine(today(now) - timedelta(days=days), time(0), tzinfo=TN)
    return pairs(installations([h], since=since))


def device_row(inst, spec, now, today_kwh=0.0, month_kwh=0.0, open_ids=()):
    w = live_power(spec, now) if inst.monitoring and not inst.end else None
    return {
        "id": inst.id, "adapter": inst.adapter_id, "name": label(inst), "category": inst.category, "room": inst.room,
        "power": round(w, 1) if w is not None else None, "on": w is not None and w >= spec.threshold,
        "today_kwh": round(today_kwh, 3), "month_kwh": round(month_kwh, 2), "monitoring": inst.monitoring,
        "source": "reelle" if spec.real else "simulee", "anomaly": inst.id in open_ids, "year": inst.year,
        "fixed": any(k in ("efficiency", "standby_cut") for k, *_ in spec.events),
    }


def live(h, now, scan=True):
    from m13 import engine
    prs = [(i, s) for i, s in household_pairs(h, now, 2) if i.end is None]
    if scan:
        engine.scan(h, now, prs)
    d = today(now)
    mx = matrix(prs, d.replace(day=1), d, now)
    tday = {iid: sum(v) for iid, v in mx[d].items()}
    month = {}
    for row in mx.values():
        for iid, v in row.items():
            month[iid] = month.get(iid, 0) + sum(v)
    open_ids = set(Alert.objects.filter(household=h, status="ouverte").values_list("installation_id", flat=True))
    devices = [device_row(i, s, now, tday.get(i.id, 0), month.get(i.id, 0), open_ids) for i, s in prs]
    # last 15 minutes, one point every 15 s
    t0 = now - timedelta(seconds=now.timestamp() % 15)
    series = []
    for k in range(59, -1, -1):
        t = t0 - timedelta(seconds=15 * k)
        series.append([t.isoformat(), round(sum((live_power(s, t) or 0) for i, s in prs if i.monitoring), 1)])
    sav = rewards.savings(h, now, prs)
    ld = rewards.ledger(h, now, prs, sav)
    today_kwh = sum(tday.values())
    alerts = Alert.objects.filter(household=h, status="ouverte").select_related("installation")[:6]
    return {
        "now": now.isoformat(), "power": round(sum(x["power"] or 0 for x in devices), 1), "today_kwh": round(today_kwh, 3),
        "devices": devices, "series": series, "alerts": [alert_json(a) for a in alerts],
        "open_alerts": Alert.objects.filter(household=h, status="ouverte").count(),
        "tokens": ld["balance"], "tokens_today": ld["today"], "savings": {"kwh": sav["kwh"], "co2_kg": sav["co2_kg"]},
        "source": "reelle" if any(s.real for _, s in prs) else "simulee",
    }


def home(h, now):
    from m13 import engine
    prs = household_pairs(h, now, 40)
    d = today(now)
    f = engine.forecast(h, now, prs)
    mx = matrix(prs, d - timedelta(days=13), d, now)
    tot = totals(mx)
    week = sum(tot.get(d - timedelta(days=i), 0) for i in range(7))
    prev_week = sum(tot.get(d - timedelta(days=i), 0) for i in range(7, 14))
    lt = now.astimezone(TN)
    y = day_sum(mx[d - timedelta(days=1)])
    y_same = sum(y[:lt.hour]) + y[lt.hour] * lt.minute / 60
    # STEG bill: meter = measured appliances + other uses (lighting, cooking...)
    other_month = h.unmonitored_base_w * 24 * f["days_in_month"] / 1000
    bill = monthly_bill(f["month_kwh"] + other_month, h.subscribed_kva)
    # previous month, computed from the same model
    pm_end = d.replace(day=1) - timedelta(days=1)
    pm = matrix(prs, pm_end.replace(day=1), pm_end, now)
    pm_kwh = sum(totals(pm).values())
    score = rewards.score_bundle(h, now, prs)
    return {
        "household": {"label": h.label, "building": h.building.name, "region": h.building.region.name, "goal": h.monthly_goal_kwh,
                      "kva": h.subscribed_kva, "code": h.code, "category": h.category},
        "forecast": f, "week_kwh": round(week, 2), "prev_week_kwh": round(prev_week, 2), "yesterday_same": round(y_same, 3),
        "hourly_today": [round(x, 4) for x in day_sum(mx[d])], "hourly_yesterday": [round(x, 4) for x in y],
        "bill": bill, "other_kwh_month": round(other_month, 1), "prev_month": {"label": pm_end.strftime("%m/%Y"), "kwh": round(pm_kwh, 1)},
        "score": score, "co2_factor": CO2_KG_PER_KWH,
    }


# ---------------------------------------------------------------------------
# Devices
# ---------------------------------------------------------------------------

def normalize(raw):
    s = (raw or "").strip().upper().replace(" ", "")
    if s.startswith("NABD") and not s.startswith("NABD-"):
        s = "NABD-" + s[4:]
    return s


def validate(raw, h):
    aid = normalize(raw)
    if not ID_RE.match(aid):
        raise ApiError("Format invalide (ex. NABD-0003)")
    a = Adapter.objects.filter(id=aid).first()
    if not a:
        raise ApiError("Adaptateur inconnu", 404)
    cur = Installation.objects.filter(adapter=a, end__isnull=True).first()
    if cur and cur.household_id == h.id:
        raise ApiError(f"Déjà associé : {cur.name}", 409)
    if cur:
        raise ApiError("Associé à un autre foyer", 409)
    return a


def pair(h, data, now):
    a = validate(data.get("id"), h)
    category = data.get("category")
    if category not in CATALOG:
        raise ApiError("Choisissez un type d'appareil")
    name = (data.get("name") or "").strip()[:60] or cat(category)["label"]
    return Installation.objects.create(adapter=a, household=h, name=name, category=category,
                                       room=(data.get("room") or cat(category)["room"])[:40], start=now)


def device_detail(h, iid, now):
    inst = Installation.objects.select_related("adapter", "household").filter(household=h, id=iid).first()
    if not inst:
        raise ApiError("Appareil introuvable", 404)
    (inst, spec), = pairs([inst])
    d = today(now)
    mx = matrix([(inst, spec)], d - timedelta(days=29), d, now)
    base, n = M.baseline(spec, now)
    t0 = now - timedelta(seconds=now.timestamp() % 30)
    readings = [[(t0 - timedelta(seconds=30 * k)).isoformat(), live_power(spec, t0 - timedelta(seconds=30 * k))] for k in range(119, -1, -1)]
    readings = [r for r in readings if r[1] is not None and datetime.fromisoformat(r[0]) >= inst.start]
    row = device_row(inst, spec, now, sum(mx[d][inst.id]), sum(sum(r[inst.id]) for k, r in mx.items() if k.month == d.month))
    row.update({
        "daily": [[k.isoformat(), round(sum(r[inst.id]), 3)] for k, r in sorted(mx.items()) if datetime.combine(k, time(23, 59), tzinfo=TN) >= inst.start],
        "readings": readings, "baseline": round(base, 1), "threshold": round(base * 1.35, 1),
        "nominal": cat(inst.category)["on_w"], "since": inst.start.isoformat(),
        "alerts": [alert_json(a) for a in Alert.objects.filter(installation=inst).select_related("installation")[:10]],
    })
    return row


def update_device(h, iid, data, now):
    inst = Installation.objects.filter(household=h, id=iid, end__isnull=True).first()
    if not inst:
        raise ApiError("Appareil introuvable", 404)
    if "name" in data and (data["name"] or "").strip():
        inst.name = data["name"].strip()[:60]
    if "room" in data:
        inst.room = (data["room"] or "").strip()[:40]
    if "category" in data and data["category"] in CATALOG:
        inst.category = data["category"]
    if "monitoring" in data and bool(data["monitoring"]) != inst.monitoring:
        inst.monitoring = bool(data["monitoring"])
        if inst.monitoring:
            Event.objects.filter(installation=inst, kind="pause", end__isnull=True).update(end=now)
        else:
            Event.objects.create(installation=inst, kind="pause", start=now)
    inst.save()
    return inst


def unpair(h, iid, now):
    inst = Installation.objects.filter(household=h, id=iid, end__isnull=True).first()
    if not inst:
        raise ApiError("Appareil introuvable", 404)
    inst.end = now
    inst.save(update_fields=["end"])
    Alert.objects.filter(installation=inst, status="ouverte").update(status="resolue", resolved_at=now, resolved_by="utilisateur")
    return inst


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------

def history(h, now, period="semaine", start=None, end=None):
    d = today(now)
    if period == "jour":
        d0 = d1 = d
    elif period == "mois":
        d0, d1 = d.replace(day=1), d
    elif period == "annee":
        d0, d1 = (d.replace(day=1) - timedelta(days=150)).replace(day=1), d
    elif period == "perso":
        try:
            d0, d1 = sorted([date.fromisoformat(start), date.fromisoformat(end)])
        except (TypeError, ValueError):
            raise ApiError("Dates invalides")
        d1 = min(d1, d)
        if (d1 - d0).days > 92:
            raise ApiError("92 jours maximum")
    else:
        d0, d1 = d - timedelta(days=6), d
    span = (d1 - d0).days + 1
    p1 = d0 - timedelta(days=1)
    p0 = p1 - timedelta(days=span - 1)
    prs = pairs(installations([h], since=datetime.combine(p0, time(0), tzinfo=TN)))
    mx = matrix(prs, p0, d1, now)
    names = {i.id: (label(i), i.category) for i, _ in prs}
    cur = {k: v for k, v in mx.items() if k >= d0}
    prev = {k: v for k, v in mx.items() if k < d0}
    if period == "jour":
        labels = [f"{x} h" for x in range(24)]
        stacks = {iid: v for iid, v in cur[d0].items()}
        prev_series = day_sum(prev[p1])
    elif period == "annee":
        months = sorted({(k.year, k.month) for k in cur})
        labels = [f"{m:02d}/{str(y)[2:]}" for y, m in months]
        stacks = {}
        for k, row in cur.items():
            idx = months.index((k.year, k.month))
            for iid, v in row.items():
                stacks.setdefault(iid, [0.0] * len(months))[idx] += sum(v)
        prev_series = []
    else:
        days = sorted(cur)
        labels = [k.isoformat() for k in days]
        stacks = {}
        for i, k in enumerate(days):
            for iid, v in cur[k].items():
                stacks.setdefault(iid, [0.0] * len(days))[i] += sum(v)
        prev_series = [sum(sum(v) for v in prev[k].values()) for k in sorted(prev)]
    series = [{"id": iid, "name": names[iid][0], "category": names[iid][1], "values": [round(x, 4) for x in vals]}
              for iid, vals in stacks.items() if sum(vals) > 0]
    series.sort(key=lambda s: -sum(s["values"]))
    total = sum(sum(s["values"]) for s in series)
    prev_total = sum(totals(prev).values())
    return {
        "period": period, "labels": labels, "series": series, "previous": [round(x, 4) for x in prev_series],
        "total": round(total, 3), "previous_total": round(prev_total, 3), "range": [d0.isoformat(), d1.isoformat()],
        "co2_kg": round(total * CO2_KG_PER_KWH, 1),
    }


# ---------------------------------------------------------------------------
# Flows, solidarity, company
# ---------------------------------------------------------------------------

def flows(h, now, scope="foyer"):
    d = today(now)
    b = h.building
    if scope == "immeuble":
        prs = pairs(installations(list(b.households.all()), since=datetime.combine(d, time(0), tzinfo=TN)))
        consumers = {}
        for i, s in prs:
            consumers[cat(i.category)["label"]] = consumers.get(cat(i.category)["label"], 0) + sum(M.day_hourly(s, d, now, False))
        other = sum(sum(M.unmonitored_hourly(x, d, now)) for x in b.households.all()) + sum(M.common_hourly(b, d, now))
        consumers["Non suivi"] = other
        title = b.name
    else:
        prs = household_pairs(h, now, 1)
        consumers = {}
        for i, s in prs:
            consumers[label(i)] = consumers.get(label(i), 0) + sum(M.day_hourly(s, d, now))
        consumers["Autres usages (estimés)"] = sum(M.unmonitored_hourly(h, d, now))
        title = h.label
    total = sum(consumers.values())
    solar = sum(M.solar_hourly(b, d, now))
    if scope != "immeuble":
        n = max(1, b.households.count())
        solar /= n
    solar = min(solar, total * 0.6)
    return {"title": title, "total": round(total, 3), "solar": round(solar, 3), "grid": round(total - solar, 3),
            "consumers": [{"label": k, "kwh": round(v, 3)} for k, v in sorted(consumers.items(), key=lambda kv: -kv[1]) if v > 0.001],
            "co2_kg": round((total - solar) * CO2_KG_PER_KWH, 2), "solar_simulated": bool(b.solar_kwc)}


def solidarity(h=None):
    projects = []
    for p in SolidarityProject.objects.select_related("region"):
        funded = p.contributions.aggregate(s=Sum("amount_tnd"))["s"] or 0
        projects.append({"code": p.code, "title": p.title, "kind": p.kind, "region": p.region.name, "partner": p.partner,
                         "goal": p.goal_tnd, "funded": round(funded, 1), "beneficiaries": int(funded // p.unit_cost_tnd),
                         "target": int(p.goal_tnd // p.unit_cost_tnd)})
    ledger = [{"ts": c.ts.isoformat(), "who": c.contributor, "project": c.project.title, "tnd": c.amount_tnd, "tokens": c.tokens,
               "mine": bool(h) and c.household_id == h.id} for c in Contribution.objects.select_related("project")[:20]]
    return {"projects": projects, "ledger": ledger, "total": round(sum(p["funded"] for p in projects), 1),
            "beneficiaries": sum(p["beneficiaries"] for p in projects)}


def donate(h, code, tokens, now):
    p = SolidarityProject.objects.filter(code=code).first()
    if not p:
        raise ApiError("Projet introuvable", 404)
    try:
        tokens = int(tokens)
    except (TypeError, ValueError):
        raise ApiError("Montant invalide")
    if tokens < 100 or tokens % 100:
        raise ApiError("Par tranches de 100 jetons")
    if tokens > rewards.ledger(h, now)["balance"]:
        raise ApiError("Solde insuffisant")
    from m12.models import TokenTx
    TokenTx.objects.create(household=h, ts=now, amount=-tokens, kind="don", label=f"Don : {p.title}")
    Contribution.objects.create(project=p, household=h, contributor="Membre Mieruka", tokens=tokens, amount_tnd=tokens / 100, ts=now)
    return p


def contribute(h, who, code, amount, now):
    p = SolidarityProject.objects.filter(code=code).first()
    if not p:
        raise ApiError("Projet introuvable", 404)
    try:
        amount = float(amount)
    except (TypeError, ValueError):
        raise ApiError("Montant invalide")
    if not 10 <= amount <= 100000:
        raise ApiError("Entre 10 et 100 000 TND")
    Contribution.objects.create(project=p, household=h, contributor=who, amount_tnd=round(amount, 2), ts=now)
    return p


def company(h, now):
    prs = household_pairs(h, now, 31)
    d = today(now)
    mx = matrix(prs, d - timedelta(days=29), d, now)
    tot = totals(mx)
    total = sum(tot.values())
    peak = sum(sum(day_sum(r)[18:22]) for r in mx.values())
    sav = rewards.savings(h, now, prs)
    contrib = Contribution.objects.filter(household=h, tokens=0).select_related("project")
    sponsored = sum(c.amount_tnd for c in contrib)
    return {
        "daily": [[k.isoformat(), round(v, 1)] for k, v in sorted(tot.items())], "total30": round(total, 1),
        "co2_30": round(total * CO2_KG_PER_KWH), "peak_share": round(peak / total, 3) if total else 0,
        "savings": {"kwh": sav["kwh"], "co2_kg": sav["co2_kg"]}, "sponsored": round(sponsored, 1),
        "beneficiaries": int(sum(c.amount_tnd / c.project.unit_cost_tnd for c in contrib)),
    }
