"""Explainable energy AI (module M3).

Rules (no deep learning: little data, and every alert must be explainable):
* Overconsumption: 3 consecutive readings (one every 5 s) more than 35 % above the
  appliance's sliding median while in use (last 3 days). A single spike is ignored.
* Standby: average power between 01:00 and 06:00 above 5 W on an idle appliance.
* Simultaneous use: at least two appliances above 800 W and more than 2.5 kW in total.
* Peak: shiftable appliance using more than 0.3 kWh in an hour between 18:00 and 22:00.
* Goal: month forecast more than 5 % above the goal.
"""
import calendar
import threading
import time as _time
from datetime import datetime, time, timedelta

from m11 import model as M
from m11.profiles import PEAK_HOURS, TN, cat
from m12.data import CO2_KG_PER_KWH, day_sum, fr, installations, label, live_power, matrix, pairs, today, totals
from m12.models import Alert, Installation, SavingAction

RATIO = 1.35
STREAK = 3
_LAST_SCAN: dict = {}
_SCAN_LOCK = threading.Lock()

CAUSES = {
    "climatisation": ("Consigne trop basse ou filtre encrassé", "Consigne à {temp} °C, nettoyer le filtre", "clim_consigne"),
    "radiateur": ("Thermostat trop élevé, pièce mal isolée", "Baisser le thermostat de 2 °C", "clim_consigne"),
    "refrigerateur": ("Porte mal fermée ou joint usé", "Vérifier le joint, dégivrer", "verifier_appareil"),
    "ordinateur": ("Tâche lourde en arrière-plan", "Activer le mode économie", "mode_eco"),
    "chauffe_eau": ("Thermostat trop haut ou entartrage", "Thermostat à 55 °C", "thermostat"),
    "compresseur": ("Fuite d'air comprimé", "Chercher les fuites, maintenance", "verifier_appareil"),
}


def season_temp(t):
    return 26 if t.astimezone(TN).month in range(5, 11) else 20


def _cause(inst, t):
    c, a, code = CAUSES.get(inst.category, ("Usage inhabituel ou défaut", "Vérifier l'appareil", "verifier_appareil"))
    return c, a.format(temp=season_temp(t)), code


def readings(spec, now, n=STREAK, step=M.STEP_S):
    t0 = now - timedelta(seconds=now.timestamp() % step)
    out = []
    for k in range(n - 1, -1, -1):
        t = t0 - timedelta(seconds=k * step)
        out.append([t.isoformat(), live_power(spec, t)])
    return out


def scan(household, now, prs=None, force=False):
    """Run the live rules for one household (throttled, one scan at a time)."""
    with _SCAN_LOCK:
        last = _LAST_SCAN.get(household.id, 0)
        if not force and _time.monotonic() - last < 3:
            return []
        _LAST_SCAN[household.id] = _time.monotonic()
        return _scan(household, now, prs)


def _scan(household, now, prs):
    prs = prs if prs is not None else pairs(installations([household], active=True))
    open_keys = set(Alert.objects.filter(household=household, status="ouverte").values_list("installation_id", "kind"))
    created, high = [], []
    for inst, spec in prs:
        if not inst.monitoring or inst.end is not None:
            continue
        rs = readings(spec, now)
        vals = [w for _, w in rs]
        if vals and vals[-1] is not None and vals[-1] >= 800:
            high.append((inst, vals[-1]))
        if any(v is None for v in vals) or (now - inst.start).total_seconds() < 60:
            continue
        base, n = M.baseline(spec, now)
        if all(v >= spec.threshold and v > base * RATIO and v - base > max(10, 0.08 * base) for v in vals):
            if (inst.id, "surconsommation") in open_keys or (inst.id, "pic") in open_keys:
                continue
            if Alert.objects.filter(installation=inst, kind__in=("surconsommation", "pic"),
                                    resolved_at__gte=now - timedelta(minutes=2)).exists():
                continue  # just corrected: readings from before the fix must not re-raise it
            w = sum(vals) / len(vals)
            pct = (w / base - 1) * 100
            cause, action, code = _cause(inst, now)
            hours = max(0.5, sum(sum(M.day_hourly(spec, (now - timedelta(days=k)).astimezone(TN).date(), now)) for k in range(1, 4)) / 3 / (base / 1000))
            evidence = readings(spec, now, n=36)
            created.append(Alert.objects.create(
                household=household, installation=inst, building=household.building,
                kind="pic" if w >= 2 * base else "surconsommation",
                severity="critique" if pct >= 150 and w >= 1500 else "elevee" if pct >= 60 else "attention",
                title=f"{label(inst)} +{fr(pct)} %", cause=cause, action=action, action_code=code, detected_at=now,
                measured=round(w, 1), expected=round(base, 1), confidence=round(min(0.97, 0.7 + min(0.25, (pct - 35) / 200)), 2),
                kwh_month=round(max(0, (w - base) / 1000 * min(hours, 12) * 30), 1),
                evidence={"rule": f"3 mesures > médiane +35 % ({fr(base * RATIO)} W)", "baseline": round(base, 1),
                          "threshold": round(base * RATIO, 1), "samples": n, "readings": evidence},
            ))
            open_keys.add((inst.id, "surconsommation"))
    if len(high) >= 2 and sum(w for _, w in high) >= 2500 and not Alert.objects.filter(
            household=household, kind="simultane", detected_at__gte=now - timedelta(hours=3)).exists():
        total = sum(w for _, w in high)
        created.append(Alert.objects.create(
            household=household, building=household.building, kind="simultane", severity="attention",
            title=f"{len(high)} gros appareils en même temps", cause=", ".join(label(i) for i, _ in high),
            action="Décaler l'appareil le plus flexible", action_code="decaler", detected_at=now,
            measured=round(total), expected=2500, confidence=0.9,
            evidence={"rule": "≥ 2 appareils > 800 W et > 2,5 kW au total", "devices": [[label(i), round(w)] for i, w in high]},
        ))
    created += _daily_rules(household, now, prs)
    return created


def _daily_rules(household, now, prs):
    lt = now.astimezone(TN)
    d = lt.date()
    created = []
    day0 = datetime.combine(d, time(0), tzinfo=TN)
    if lt.hour >= 7:
        for inst, spec in prs:
            if not spec.info["standby_prone"] or inst.end is not None:
                continue
            night = M.day_hourly(spec, d, now)[1:6]
            avg_w = sum(night) / 5 * 1000
            if avg_w >= 5 and not Alert.objects.filter(installation=inst, kind="veille", detected_at__gte=day0).exists() \
                    and not any(k == "standby_cut" for k, *_ in spec.events):
                kwh = (avg_w - 0.3) * 20 * 30 / 1000
                created.append(Alert.objects.create(
                    household=household, installation=inst, building=household.building, kind="veille",
                    severity="attention" if avg_w >= 8 else "info", title=f"{label(inst)} : veille {fr(avg_w, 1)} W",
                    cause="Reste en veille la nuit", action="Multiprise à interrupteur", action_code="veille_off",
                    detected_at=now, measured=round(avg_w, 1), expected=0.3, confidence=0.86, kwh_month=round(kwh, 1),
                    evidence={"rule": "Moyenne 1 h – 6 h > 5 W", "night": [round(x * 1000, 1) for x in night]},
                ))
    if lt.hour - 1 in PEAK_HOURS and not Alert.objects.filter(household=household, kind="pointe", detected_at__gte=day0).exists():
        for inst, spec in prs:
            if cat(inst.category).get("shiftable") and M.day_hourly(spec, d, now)[lt.hour - 1] >= 0.3:
                created.append(Alert.objects.create(
                    household=household, installation=inst, building=household.building, kind="pointe", severity="info",
                    title=f"{label(inst)} en heure de pointe", cause="Lancé entre 18 h et 22 h",
                    action="Programmer après 22 h", action_code="decaler", detected_at=now, confidence=0.95,
                    evidence={"rule": "Appareil décalable > 0,3 kWh entre 18 h et 22 h"},
                ))
                break
    if not Alert.objects.filter(household=household, kind="objectif", detected_at__gte=now - timedelta(days=3)).exists():
        f = forecast(household, now)
        if f["ratio"] >= 1.05:
            created.append(Alert.objects.create(
                household=household, building=household.building, kind="objectif", severity="attention",
                title=f"Objectif : {fr(f['month_kwh'])} / {fr(household.monthly_goal_kwh)} kWh",
                cause="Rythme des 7 derniers jours", action="Voir les conseils", action_code="voir_conseils",
                detected_at=now, measured=f["month_kwh"], expected=household.monthly_goal_kwh, unit="kWh", confidence=0.7,
                evidence={"rule": "Prévision > objectif + 5 %"},
            ))
    return created


def scan_background(now):
    """Network-wide incidents for the STEG view (households without the app)."""
    last = _LAST_SCAN.get("bg", 0)
    if _time.monotonic() - last < 20:
        return
    _LAST_SCAN["bg"] = _time.monotonic()
    prs = pairs([i for i in installations(active=True) if not i.household.is_live], real=set())
    open_alerts = {a.installation_id: a for a in Alert.objects.filter(status="ouverte", household__is_live=False, installation__isnull=False)}
    for inst, spec in prs:
        st = M.state_at(spec, now)
        a = open_alerts.get(inst.id)
        if st[4] and not a:
            w, on = M.power(spec, now, st)
            base = spec.on_w
            if on and w > base * RATIO:
                Alert.objects.create(
                    household=inst.household, installation=inst, building=inst.household.building, kind="surconsommation",
                    severity="elevee", title=f"{label(inst)} +{fr((w / base - 1) * 100)} %", cause="Surconsommation détectée",
                    action="Notification envoyée au foyer", detected_at=now, measured=round(w), expected=round(base),
                    confidence=0.85, kwh_month=round((w - base) / 1000 * 4 * 30, 1), evidence={"rule": "3 mesures > médiane +35 %"})
        elif a and not st[4]:
            a.status, a.resolved_at, a.resolved_by = "resolue", now, "auto"
            a.save(update_fields=["status", "resolved_at", "resolved_by"])


# ---------------------------------------------------------------------------
# Analyses
# ---------------------------------------------------------------------------

def forecast(household, now, prs=None):
    lt = now.astimezone(TN)
    d = lt.date()
    prs = prs if prs is not None else pairs(installations([household], since=datetime.combine(d.replace(day=1), time(0), tzinfo=TN) - timedelta(days=8)))
    mx = matrix(prs, min(d.replace(day=1), d - timedelta(days=7)), d, now)
    tot = totals(mx)
    hb = {k: day_sum(v) for k, v in mx.items()}
    past = [d - timedelta(days=i) for i in range(1, 8)]
    d7 = [tot[x] for x in past if x in tot]
    avg7 = sum(d7) / len(d7) if d7 else 0
    avg3 = sum(d7[:3]) / 3 if len(d7) >= 3 else avg7
    trend = max(0.85, min(1.15, avg3 / avg7)) if avg7 else 1.0
    remaining_today = 0.0
    if d7:
        for h in range(lt.hour, 24):
            avg_h = sum(hb[x][h] for x in past if x in hb) / len(d7)
            remaining_today += avg_h * (1 - lt.minute / 60 if h == lt.hour else 1)
    today_kwh = tot.get(d, 0)
    mtd = sum(v for k, v in tot.items() if k.month == d.month and k.year == d.year)
    dim = calendar.monthrange(d.year, d.month)[1]
    left = dim - d.day
    month = mtd + remaining_today + left * avg7 * trend
    spread = (max(d7) - min(d7)) / 2 * left ** 0.5 if len(d7) > 1 else 0
    goal = household.monthly_goal_kwh or 1
    return {
        "today_kwh": round(today_kwh, 3), "today_expected": round(today_kwh + remaining_today, 2), "avg_daily": round(avg7, 2),
        "trend": round(trend, 3), "mtd_kwh": round(mtd, 2), "month_kwh": round(month, 1),
        "low": round(max(mtd, month - spread), 1), "high": round(month + spread, 1),
        "goal_kwh": goal, "ratio": round(month / goal, 3), "days_left": left, "days_in_month": dim,
        "daily": [[k.isoformat(), round(v, 3)] for k, v in sorted(tot.items()) if k.month == d.month],
    }


def habits(household, now, prs):
    d = today(now)
    mx = matrix(prs, d - timedelta(days=14), d - timedelta(days=1), now)
    profile = [0.0] * 24
    for row in mx.values():
        for k, v in enumerate(day_sum(row)):
            profile[k] += v / len(mx)
    tot = sum(profile) or 1
    per = {}
    for row in mx.values():
        for iid, h in row.items():
            per[iid] = per.get(iid, 0) + sum(h) / len(mx)
    names = {i.id: (label(i), i.category) for i, _ in prs}
    devices = sorted(({"id": k, "name": names[k][0], "category": names[k][1], "kwh": round(v, 3), "share": round(v / tot, 3)}
                      for k, v in per.items() if v > 0 and k in names), key=lambda x: -x["kwh"])
    evening = sum(profile[18:23]) / tot
    wd = [sum(sum(v) for v in row.values()) for k, row in mx.items() if k.weekday() < 5]
    we = [sum(sum(v) for v in row.values()) for k, row in mx.items() if k.weekday() >= 5]
    return {"profile": [round(x, 4) for x in profile], "peak_hour": max(range(24), key=lambda h: profile[h]),
            "evening_share": round(evening, 3), "night_share": round((sum(profile[0:7]) + profile[23]) / tot, 3),
            "weekday": round(sum(wd) / len(wd), 2) if wd else None, "weekend": round(sum(we) / len(we), 2) if we else None,
            "devices": devices}


def recommendations(household, now, prs):
    from m14.tariff import monthly_bill
    d = today(now)
    mx = matrix(prs, d - timedelta(days=7), d - timedelta(days=1), now)
    per = {}
    for row in mx.values():
        for iid, h in row.items():
            per.setdefault(iid, []).append(h)
    applied = set(SavingAction.objects.filter(household=household).values_list("code", "installation_id"))
    f = forecast(household, now, prs)
    month_total = f["month_kwh"] + household.unmonitored_base_w * 0.72
    price = monthly_bill(month_total, household.subscribed_kva)["avg_price"]
    recos = []

    def add(code, title, why, kwh, insts, grid=None, prio=0):
        recos.append({"code": code, "title": title, "why": why, "kwh_month": round(kwh, 1), "tnd_month": round(kwh * price, 2),
                      "co2_month": round(kwh * CO2_KG_PER_KWH, 1), "installations": [i.id for i in insts],
                      "applied": all((code, i.id) in applied for i in insts) if insts else False, "grid": grid, "priority": prio})

    standby = []
    for inst, spec in prs:
        lists = per.get(inst.id)
        if not lists or inst.end:
            continue
        month = sum(sum(l) for l in lists) / len(lists) * 30
        if spec.info["standby_prone"] and not any(k == "standby_cut" for k, *_ in spec.events):
            night = sum(sum(l[1:6]) / 5 for l in lists) / len(lists) * 1000
            if night >= 2.5:
                standby.append((inst, night))
        has_eff = any(k == "efficiency" for k, *_ in spec.events)
        if inst.category in ("climatisation", "radiateur") and not has_eff and month > 5:
            add("clim_consigne", f"{label(inst)} à {season_temp(now)} °C", f"{fr(month)} kWh/mois", month * 0.12, [inst], prio=4)
        if inst.category == "chauffe_eau" and not has_eff:
            peak = sum(sum(l[18:22]) for l in lists) / len(lists) * 30
            add("thermostat", "Chauffe-eau à 55 °C, hors pointe", f"{fr(month)} kWh/mois", month * 0.08, [inst],
                grid=round(peak, 1), prio=3)
        if inst.category == "ordinateur" and not has_eff:
            night = sum(sum(l[0:7]) for l in lists) / len(lists) * 30
            if night > 0.3:
                add("mode_eco", "PC : veille auto 15 min", f"{fr(night, 1)} kWh/mois la nuit", night * 0.7, [inst], prio=2)
    if standby:
        kwh = sum((w - 0.3) * 20 * 30 / 1000 for _, w in standby)
        add("veille_off", "Couper les veilles", " · ".join(f"{label(i)} {fr(w, 1)} W" for i, w in standby), kwh,
            [i for i, _ in standby], prio=3)
    recos.sort(key=lambda r: (r["applied"], -r["priority"], -r["kwh_month"]))
    return recos, price
