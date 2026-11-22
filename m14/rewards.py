"""Tokens, eco-score, challenges and recommendation effects (module M4).

* Savings tokens: 500 per kWh avoided, measured against the power recorded before
  the action, during its window (24 h, 72 h for standby). Computed, not stored.
* Fixed tokens: challenges, learning, collective actions (TokenTx rows).
* At most 400 tokens earned per day. Tokens are rewards: a zero balance never
  limits electricity, and no code path can switch power off.
"""
import math
from collections import defaultdict
from datetime import datetime, time, timedelta

from kizuna.apiutils import ApiError
from m11 import model as M
from m11.profiles import TN, cat
from m12.data import CO2_KG_PER_KWH, day_sum, installations, label, matrix, pairs, today, totals
from m12.models import Alert, ChallengeEntry, Event, LearningProgress, SavingAction, TokenTx

TOKENS_PER_KWH = 500
DAILY_CAP = 400
EFFECTS = {"clim_consigne": 0.82, "mode_eco": 0.85, "thermostat": 0.9}
CATALOG = [
    {"code": "led", "title": "−20 % ampoules LED", "cost": 300},
    {"code": "multiprise", "title": "Multiprise à interrupteur", "cost": 800},
    {"code": "diagnostic", "title": "Diagnostic énergie", "cost": 1500},
]


# ---------------------------------------------------------------------------
# Verified savings
# ---------------------------------------------------------------------------

_SAV_CACHE: dict = {}


def action_savings(action, spec, now):
    """kWh avoided per local day since the action, integrated minute by minute."""
    end = min(now, action.applied_at + timedelta(hours=action.window_hours))
    key = (action.id, spec.key if spec else None, int(end.timestamp() // 60))
    if key in _SAV_CACHE:
        return _SAV_CACHE[key]
    out = defaultdict(float)
    if spec and action.reference_w > 0:
        t = action.applied_at
        step = timedelta(minutes=1)
        while t < end:
            w, _ = M.power(spec, t)
            in_use = w >= spec.threshold
            if (action.mode == "actif" and in_use) or (action.mode == "veille" and not in_use):
                out[t.astimezone(TN).date()] += max(0.0, action.reference_w - w) / 60000
            t += step
    res = dict(out)
    _SAV_CACHE[key] = res
    return res


def savings(household, now, prs=None):
    specs = {i.id: s for i, s in (prs or pairs(installations([household])))}
    rows = []
    for a in SavingAction.objects.filter(household=household):
        per_day = action_savings(a, specs.get(a.installation_id), now)
        rows.append((a, per_day))
    total = sum(sum(p.values()) for _, p in rows)
    return {
        "kwh": round(total, 3), "co2_kg": round(total * CO2_KG_PER_KWH, 2),
        "active": [{"title": a.title, "kwh": round(sum(p.values()), 3), "until": (a.applied_at + timedelta(hours=a.window_hours)).isoformat()}
                   for a, p in rows if now < a.applied_at + timedelta(hours=a.window_hours)],
        "rows": rows,
    }


def ledger(household, now, prs=None, sav=None):
    sav = sav or savings(household, now, prs)
    items = [{"ts": t.ts, "amount": t.amount, "kind": t.kind, "label": t.label} for t in TokenTx.objects.filter(household=household)]
    for a, per_day in sav["rows"]:
        for d, kwh in per_day.items():
            tokens = int(math.floor(kwh * TOKENS_PER_KWH))
            if tokens > 0:
                ts = min(now, datetime.combine(d, time(23, 59), tzinfo=TN))
                items.append({"ts": ts, "amount": tokens, "kind": "economie", "label": a.title})
    by_day = defaultdict(list)
    for it in items:
        if it["amount"] > 0:
            by_day[it["ts"].astimezone(TN).date()].append(it)
    for d, its in by_day.items():
        room = DAILY_CAP
        for it in sorted(its, key=lambda x: x["kind"] == "economie"):
            it["amount"] = min(it["amount"], room)
            room -= it["amount"]
    items = [i for i in items if i["amount"] != 0]
    items.sort(key=lambda x: x["ts"], reverse=True)
    d0 = today(now)
    earned_today = sum(i["amount"] for i in by_day.get(d0, []))
    return {
        "balance": sum(i["amount"] for i in items), "earned": sum(i["amount"] for i in items if i["amount"] > 0),
        "spent": -sum(i["amount"] for i in items if i["amount"] < 0), "today": earned_today,
        "left_today": max(0, DAILY_CAP - earned_today), "cap": DAILY_CAP, "rate": TOKENS_PER_KWH,
        "renewal": datetime.combine(d0 + timedelta(days=1), time(0), tzinfo=TN).isoformat(),
        "items": [{**i, "ts": i["ts"].isoformat()} for i in items[:30]],
        "daily": [[(d0 - timedelta(days=k)).isoformat(), sum(i["amount"] for i in by_day.get(d0 - timedelta(days=k), []))] for k in range(13, -1, -1)],
    }


def fixed_grant(household, amount, kind, title, now):
    ld = ledger(household, now)
    amount = min(amount, ld["left_today"])
    if amount > 0:
        TokenTx.objects.create(household=household, ts=now, amount=amount, kind=kind, label=title)
    return amount


# ---------------------------------------------------------------------------
# Eco-score
# ---------------------------------------------------------------------------

def eco_score(household, now, prs, offset=0, mx=None):
    d = today(now)
    end = d - timedelta(days=1 + offset)
    mx = mx or matrix(prs, d - timedelta(days=30), d - timedelta(days=1), now)
    tot = totals(mx)
    last7 = [tot.get(end - timedelta(days=i), 0) for i in range(7)]
    prev = [tot.get(end - timedelta(days=i), 0) for i in range(7, 28)]
    ref = sum(prev) / 3 if any(prev) else sum(last7)
    ratio = sum(last7) / ref if ref else 1
    a = max(0, min(40, 20 + (1 - ratio) * 200))
    standby_ids = {i.id for i, s in prs if s.info["standby_prone"]}
    stand = sum(sum(h[1:6]) * 24 / 5 * 0.83 for k, row in mx.items() if end - timedelta(days=6) <= k <= end
                for iid, h in row.items() if iid in standby_ids)
    share = stand / max(0.001, sum(last7))
    b = max(0, min(25, 25 * (1 - share / 0.08)))
    limit = now - timedelta(days=offset)
    n_act = SavingAction.objects.filter(household=household, applied_at__gte=limit - timedelta(days=30), applied_at__lte=limit).count()
    n_ch = ChallengeEntry.objects.filter(household=household, completed_at__lte=limit, completed_at__gte=limit - timedelta(days=30)).count()
    n_learn = LearningProgress.objects.filter(user__profile__household=household).count()
    c = min(20, 4 * n_act + 5 * n_ch + 2 * n_learn)
    import calendar
    target = household.monthly_goal_kwh / calendar.monthrange(end.year, end.month)[1]
    good = sum(1 for v in last7 if 0 < v <= target)
    dd = good * 15 / 7
    return {
        "score": round(a + b + c + dd),
        "parts": [
            {"key": "progres", "label": "Progrès", "points": round(a), "max": 40, "hint": f"{'−' if ratio < 1 else '+'}{abs(ratio - 1) * 100:.0f} % vs vos 3 semaines précédentes"},
            {"key": "veille", "label": "Veilles", "points": round(b), "max": 25, "hint": f"{share * 100:.1f} % de veille"},
            {"key": "actions", "label": "Actions", "points": round(c), "max": 20, "hint": f"{n_act} actions, {n_ch} défis, {n_learn} quiz"},
            {"key": "regularite", "label": "Régularité", "points": round(dd), "max": 15, "hint": f"{good}/7 jours sous {target:.1f} kWh"},
        ],
    }, mx


def score_bundle(household, now, prs):
    cur, mx = eco_score(household, now, prs)
    prev, _ = eco_score(household, now, prs, 1, mx)
    hist = [[(today(now) - timedelta(days=1 + k)).isoformat(), eco_score(household, now, prs, k, mx)[0]["score"]] for k in range(9, 0, -1)]
    hist.append([today(now).isoformat(), cur["score"]])
    return {"score": cur["score"], "previous": prev["score"], "parts": cur["parts"], "history": hist}


# ---------------------------------------------------------------------------
# Applying recommendations (simulated effects only)
# ---------------------------------------------------------------------------

def _end_events(inst, now, kinds):
    ended = []
    for e in inst.events.filter(kind__in=kinds, start__lte=now):
        if e.end is None or e.end > now:
            ended.append(e.end)
            e.end = now
            e.save(update_fields=["end"])
    return ended


def apply_code(household, code, inst, now, alert=None):
    measured = alert.measured if alert and alert.unit == "W" else None
    if code in EFFECTS and inst:
        spec = M.spec_of(inst, list(inst.events.all()))
        ref = measured or M.baseline(spec, now)[0]
        ends = [e for e in _end_events(inst, now, ["anomaly"]) if e]
        if ends:  # the appliance keeps running as before, but correctly set
            Event.objects.create(installation=inst, kind="forced_on", start=now, end=max(ends))
        Event.objects.create(installation=inst, kind="efficiency", start=now, factor=EFFECTS[code])
        SavingAction.objects.create(household=household, installation=inst, alert=alert, code=code,
                                    title=f"{label(inst)} réglé", applied_at=now, reference_w=ref)
        return "Réglage appliqué : économies mesurées en continu."
    if code == "verifier_appareil" and inst:
        _end_events(inst, now, ["anomaly", "forced_on"])
        if measured:
            SavingAction.objects.create(household=household, installation=inst, alert=alert, code=code,
                                        title=f"{label(inst)} vérifié", applied_at=now, reference_w=measured)
        return "Appareil vérifié."
    if code == "veille_off" and inst:
        spec = M.spec_of(inst, list(inst.events.all()))
        ref = measured or max(1.0, sum(M.day_hourly(spec, today(now), now)[1:6]) / 5 * 1000)
        _end_events(inst, now, ["anomaly"])
        Event.objects.create(installation=inst, kind="standby_cut", start=now)
        SavingAction.objects.create(household=household, installation=inst, alert=alert, code=code,
                                    title=f"{label(inst)} : veille coupée", applied_at=now, reference_w=ref, mode="veille", window_hours=72)
        return "Veille coupée."
    if code == "decaler":
        for i in installations([household], active=True):
            _end_events(i, now, ["forced_on"])
        day0 = datetime.combine(today(now), time(0), tzinfo=TN)
        if not SavingAction.objects.filter(household=household, code="decaler", applied_at__gte=day0).exists():
            SavingAction.objects.create(household=household, code="decaler", title="Usage décalé", applied_at=now, window_hours=0)
            got = fixed_grant(household, 20, "communaute", "Effort de pointe", now)
            return f"Usage décalé : +{got} jetons."
        return "Usage décalé."
    return "Noté."


def apply_household_mode_eco(alert, now):
    computers = [
        inst for inst in installations([alert.household], active=True)
        if inst.category == "ordinateur" and inst.monitoring
    ]
    if not computers:
        raise ApiError("Aucun ordinateur suivi compatible n’est associé à ce foyer.", 409)

    activated = 0
    for inst in computers:
        if inst.events.filter(kind="efficiency", end__isnull=True).exists():
            continue
        apply_code(alert.household, "mode_eco", inst, now, alert)
        activated += 1

    if activated:
        device_label = "ordinateur suivi" if activated == 1 else "ordinateurs suivis"
        return f"Mode éco activé en simulation sur {activated} {device_label}. Aucun appareil n’a été commandé."
    return "Le mode éco était déjà actif sur les ordinateurs suivis."


def apply_alert(alert, now):
    if alert.action_code == "household_mode_eco":
        msg = apply_household_mode_eco(alert, now)
    else:
        msg = apply_code(alert.household, alert.action_code, alert.installation, now, alert)
    alert.status = "resolue" if alert.action_code == "voir_conseils" else "appliquee"
    alert.resolved_at, alert.resolved_by = now, "utilisateur"
    alert.save(update_fields=["status", "resolved_at", "resolved_by"])
    if alert.installation_id:
        Alert.objects.filter(installation_id=alert.installation_id, status="ouverte",
                             kind__in=("surconsommation", "pic")).update(status="appliquee", resolved_at=now, resolved_by="utilisateur")
    return msg


# ---------------------------------------------------------------------------
# Challenges (verified on measurements)
# ---------------------------------------------------------------------------

def _yesterday(household, now, prs, days=8):
    d = today(now)
    return matrix(prs, d - timedelta(days=days), d - timedelta(days=1), now), d - timedelta(days=1)


def ch_veille(h, now, prs):
    mx, y = _yesterday(h, now, prs, 1)
    ids = {i.id for i, s in prs if s.info["standby_prone"]}
    worst = max((sum(v[1:6]) / 5 * 1000 for iid, v in mx[y].items() if iid in ids), default=0)
    return worst <= 3, f"{worst:.1f} W max cette nuit"


def ch_reference(h, now, prs):
    mx, y = _yesterday(h, now, prs)
    tot = totals(mx)
    ref = sum(v for k, v in tot.items() if k != y) / max(1, len(tot) - 1)
    return 0 < tot[y] < ref, f"{tot[y]:.1f} / {ref:.1f} kWh"


def ch_soiree(h, now, prs):
    mx, y = _yesterday(h, now, prs, 1)
    s = day_sum(mx[y])
    share = sum(s[18:23]) / max(0.001, sum(s))
    return share < 0.35, f"{share * 100:.0f} % le soir"


def ch_atelier(h, now, prs):
    mx, y = _yesterday(h, now, prs, 1)
    heavy = {i.id for i, s in prs if s.info["on_w"] >= 2000}
    late = sum(sum(v[18:]) for iid, v in mx[y].items() if iid in heavy)
    return late < 0.5, f"{late:.2f} kWh après 18 h"


CHALLENGES = [
    {"code": "veille-zero", "title": "Nuit sans veille", "reward": 60, "for": ["foyer", "etudiant", "famille"], "check": ch_veille},
    {"code": "sous-reference", "title": "Journée sous ma référence", "reward": 80, "for": ["foyer", "etudiant", "famille", "entreprise"], "check": ch_reference},
    {"code": "soiree-douce", "title": "Soirée douce", "reward": 50, "for": ["foyer", "etudiant", "famille"], "check": ch_soiree},
    {"code": "atelier-pointe", "title": "Atelier hors pointe", "reward": 120, "for": ["entreprise"], "check": ch_atelier},
]


def challenges(household, role, now, prs):
    done = {c.code: c.completed_at for c in ChallengeEntry.objects.filter(household=household)}
    out = []
    for c in CHALLENGES:
        if role not in c["for"]:
            continue
        ok, detail = c["check"](household, now, prs)
        out.append({"code": c["code"], "title": c["title"], "reward": c["reward"], "ready": ok, "detail": detail,
                    "done": c["code"] in done})
    return out


def claim(household, code, now, prs):
    c = next((x for x in CHALLENGES if x["code"] == code), None)
    if not c:
        return False, "Défi inconnu."
    if ChallengeEntry.objects.filter(household=household, code=code).exists():
        return True, "Déjà réussi."
    ok, detail = c["check"](household, now, prs)
    if not ok:
        return False, f"Pas encore : {detail}"
    ChallengeEntry.objects.create(household=household, code=code, completed_at=now)
    got = fixed_grant(household, c["reward"], "defi", c["title"], now)
    return True, f"+{got} jetons"
