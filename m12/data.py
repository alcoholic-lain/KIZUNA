"""Energy read helpers shared by every module (M2)."""
from collections import defaultdict
from datetime import timedelta

from django.db.models import Prefetch, Q

from m11 import model as M
from m11.profiles import TN, cat

from .models import Event, Installation, Reading

CO2_KG_PER_KWH = 0.468  # IEA screening average for Tunisia's grid
CO2_SOURCE = "Facteur d'émission du réseau tunisien : 0,468 kg CO₂/kWh (moyenne IEA)"


def fr(x, d=0):
    if x is None:
        return "–"
    return f"{x:,.{d}f}".replace(",", " ").replace(".", ",")


def real_adapters():
    return set(Reading.objects.values_list("adapter_id", flat=True).distinct())


def installations(households=None, since=None, active=False):
    qs = Installation.objects.select_related("adapter", "household", "household__building", "household__building__region") \
        .prefetch_related(Prefetch("events", queryset=Event.objects.order_by("start")))
    if households is not None:
        qs = qs.filter(household__in=households)
    if active:
        qs = qs.filter(end__isnull=True)
    elif since is not None:
        qs = qs.filter(Q(end__isnull=True) | Q(end__gte=since))
    return list(qs)


def pairs(insts, real=None):
    real = real_adapters() if real is None else real
    return [(i, M.spec_of(i, list(i.events.all()), real=i.adapter_id in real)) for i in insts]


def matrix(prs, d0, d1, now, measured=True):
    """{date: {installation_id: [24 kWh]}}"""
    out = {}
    d = d0
    while d <= d1:
        out[d] = {i.id: M.day_hourly(s, d, now, measured) for i, s in prs}
        d += timedelta(days=1)
    return out


def day_sum(row):
    h = [0.0] * 24
    for v in row.values():
        for k in range(24):
            h[k] += v[k]
    return h


def totals(mx):
    return {d: sum(sum(v) for v in row.values()) for d, row in mx.items()}


def today(now):
    return now.astimezone(TN).date()


def live_power(spec, now):
    if spec.real:
        return M.real_live(spec, now)
    return M.measured_power(spec, now - timedelta(seconds=now.timestamp() % M.STEP_S))


def label(inst):
    return inst.name or cat(inst.category)["label"]
