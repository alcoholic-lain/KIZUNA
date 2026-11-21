"""Energy model (module M1): power and energy computed on demand.

* ``power(spec, t)``: instantaneous power of an installation, every 5 seconds.
* ``day_hourly(spec, day, now)``: 24 hourly kWh values (energy = power × time).
* Events (anomaly, fix, standby cut, forced on, pause) are intervals applied
  on top of the appliance profile, so the past stays reproducible.
* Installations whose adapter posted real measurements use those instead.

Past days are immutable, so they are cached in memory.
"""
import math
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta

from django.utils import timezone

from .profiles import COMMON_SHAPE, PEAK_HOURS, TN, UNMONITORED_SHAPE, cat, noise, weather_factor

STEP_S = 5          # one live reading every 5 seconds
SAMPLE_MIN = 5      # energy integration step for partial days
WEATHER_CATS = {"climatisation", "radiateur"}
BACKGROUND_ANOMALY_CATS = {"climatisation", "radiateur", "chauffe_eau", "refrigerateur"}

_DAY_CACHE: dict = {}
_BASE_CACHE: dict = {}


def now():
    from m12.models import SimState
    try:
        off = SimState.objects.values_list("offset_minutes", flat=True).get(pk=1)
    except SimState.DoesNotExist:
        off = 0
    return timezone.now() + timedelta(minutes=off)


def local(t):
    return t.astimezone(TN)


def day_start(d):
    return datetime.combine(d, time(0), tzinfo=TN)


@dataclass
class Spec:
    id: int
    seed: int
    category: str
    scale: float
    start: datetime
    end: datetime | None
    events: list = field(default_factory=list)   # (kind, start, end, factor, data)
    background: bool = False
    real: bool = False
    adapter_id: str = ""

    def __post_init__(self):
        self.info = cat(self.category)
        self.on_w = self.info["on_w"] * (0.88 + 0.24 * noise(self.seed, 999))
        self.key = (self.id, self.seed, self.category, self.scale, self.start, self.end,
                    tuple((k, s, e, f) for k, s, e, f, _ in self.events), self.background)

    @property
    def threshold(self):
        if self.info["kind"] == "constant":
            return 0.5 * self.on_w
        return max(self.info["standby_w"] * 2.5 + 1.0, 0.3 * self.on_w)


def spec_of(inst, events=None, background=None, real=False):
    evs = events if events is not None else list(inst.events.all())
    return Spec(
        id=inst.id, seed=(inst.adapter.seed * 7919 + sum(map(ord, inst.category))) % 1_000_003, category=inst.category,
        scale=inst.usage_scale, start=inst.start, end=inst.end,
        events=[(e.kind, e.start, e.end, e.factor, e.data) for e in evs],
        background=(not inst.household.is_live) if background is None else background, real=real, adapter_id=inst.adapter_id,
    )


# ---------------------------------------------------------------------------
# Instantaneous power
# ---------------------------------------------------------------------------

def state_at(spec, t):
    eff, cut, forced, paused, anomaly = 1.0, False, False, False, None
    for kind, s, e, f, data in spec.events:
        if t < s or (e is not None and t >= e):
            continue
        if kind == "efficiency":
            eff = f
        elif kind == "standby_cut":
            cut = True
        elif kind == "forced_on":
            forced = True
        elif kind == "pause":
            paused = True
        elif kind == "anomaly":
            anomaly = (data.get("type", "surcharge"), f)
            if data.get("forced"):
                forced = True
    if spec.background and anomaly is None and spec.category in BACKGROUND_ANOMALY_CATS:
        ts = t.timestamp()
        block = int(ts // 14400)
        if noise(spec.seed + 77, block) < 0.03:
            anomaly = ("surcharge", 1.55 + 0.3 * noise(spec.seed + 78, block))
            if spec.category != "refrigerateur" and ts % 14400 < 3600:
                forced = True
    return eff, cut, forced, paused, anomaly


def usage_probability(spec, h, weekend, wf):
    info = spec.info
    if info["kind"] == "constant":
        return 1.0
    if info["kind"] == "cycle":
        return info["duty"]
    if info.get("business") and weekend:
        return 0.0
    p = info["p"][h] * spec.scale
    if weekend and spec.category in ("television", "console", "machine_a_laver", "four"):
        p *= 1.3
    return min(p * wf, 0.95)


def power(spec, t, st=None):
    """(watts, in_use) at time t. Deterministic, 5-second resolution."""
    if t < spec.start or (spec.end and t >= spec.end):
        return 0.0, False
    eff, cut, forced, paused, anomaly = st or state_at(spec, t)
    info = spec.info
    ts = t.timestamp()
    m = int(ts // 60)
    lt = t.astimezone(TN)
    weekend = lt.weekday() >= 5
    seed = spec.seed
    if info["kind"] == "constant":
        on = True
    elif info["kind"] == "cycle":
        period = info["period"]
        on = ((m + seed * 7) % period) < period * info["duty"]
    else:
        wf = weather_factor(lt.date()) if spec.category in WEATHER_CATS else 1.0
        on = noise(seed, (m + seed * 13) // info["block"]) < usage_probability(spec, lt.hour, weekend, wf)
    a_type, a_factor = anomaly or ("", 1.0)
    if forced or a_type == "pic":
        on = True
    jitter = 1 + 0.07 * (noise(seed + 3, int(ts // STEP_S)) - 0.5)
    if on:
        w = spec.on_w * eff * jitter
        if a_type in ("surcharge", "pic"):
            w *= a_factor
    else:
        standby = info["standby_w"]
        if cut and info["standby_prone"]:
            standby = 0.3
        if a_type == "veille":
            standby = max(standby, 1) * a_factor
        w = standby * (1 + 0.1 * (noise(seed + 5, m) - 0.5))
    return max(0.0, w), on


def measured_power(spec, t):
    st = state_at(spec, t)
    if st[3]:  # paused: nothing is measured (the appliance keeps working)
        return None
    return power(spec, t, st)[0]


# ---------------------------------------------------------------------------
# Energy
# ---------------------------------------------------------------------------

def _expected_day(spec, d):
    weekend = d.weekday() >= 5
    wf = weather_factor(d) if spec.category in WEATHER_CATS else 1.0
    base = d.toordinal() * 24
    out = []
    for h in range(24):
        p = usage_probability(spec, h, weekend, wf)
        w = p * spec.on_w + (1 - p) * spec.info["standby_w"]
        if spec.info["kind"] == "block":
            w *= 0.55 + 0.9 * noise(spec.seed, base + h)
        out.append(w / 1000)
    return out


def _sampled_day(spec, d, s, e, measured):
    out = [0.0] * 24
    t = s
    step = timedelta(minutes=SAMPLE_MIN)
    while t < e:
        nxt = min(e, t + step)
        mid = t + (nxt - t) / 2
        st = state_at(spec, mid)
        if not (measured and st[3]):
            w, _ = power(spec, mid, st)
            out[mid.astimezone(TN).hour] += w * (nxt - t).total_seconds() / 3_600_000
        t = nxt
    return out


def _overlaps(spec, s, e):
    for kind, es, ee, _, _ in spec.events:
        if es < e and (ee is None or ee > s):
            return True
    return False


def day_hourly(spec, d, t_now, measured=True):
    """Hourly kWh for an installation on day d (local), up to t_now."""
    ds = day_start(d)
    de = ds + timedelta(days=1)
    s = max(ds, spec.start)
    e = min(de, spec.end or de, t_now)
    if e <= s:
        return [0.0] * 24
    if spec.real:
        return _real_day(spec, d, s, e)
    if measured and not any(k == "pause" for k, *_ in spec.events):
        measured = False  # nothing paused: measured and consumed energy are identical
    full = s == ds and e == de
    key = (spec.key, d, measured, None if full else int(e.timestamp() // (SAMPLE_MIN * 60)))
    hit = _DAY_CACHE.get(key)
    if hit is not None:
        return hit
    if full and not _overlaps(spec, s, e):
        res = _expected_day(spec, d)
    else:
        res = _sampled_day(spec, d, s, e, measured)
    if len(_DAY_CACHE) > 200_000:
        _DAY_CACHE.clear()
    _DAY_CACHE[key] = res
    return res


def _real_day(spec, d, s, e):
    from m12.models import Reading
    out = [0.0] * 24
    sums = {}
    for ts, w in Reading.objects.filter(adapter_id=spec.adapter_id, ts__gte=s, ts__lt=e).values_list("ts", "watts"):
        h = ts.astimezone(TN).hour
        a = sums.setdefault(h, [0.0, 0])
        a[0] += w
        a[1] += 1
    for h, (tot, n) in sums.items():
        hs = day_start(d) + timedelta(hours=h)
        covered = (min(e, hs + timedelta(hours=1)) - max(s, hs)).total_seconds() / 3600
        out[h] = tot / n / 1000 * max(0.0, covered)
    return out


def real_live(spec, t):
    from m12.models import Reading
    r = Reading.objects.filter(adapter_id=spec.adapter_id, ts__lte=t).order_by("-ts").first()
    if r and (t - r.ts).total_seconds() < 120:
        return r.watts
    return None


def baseline(spec, t):
    """Sliding median of power while in use, over the 3 previous days."""
    key = (spec.key, int(t.timestamp() // 3600))
    if key in _BASE_CACHE:
        return _BASE_CACHE[key]
    vals = []
    x = t - timedelta(days=3)
    step = timedelta(minutes=9)
    while x < t - timedelta(minutes=10):
        st = state_at(spec, x)
        if st[4] is None and not st[2]:  # readings flagged anomalous are excluded
            w, _ = power(spec, x, st)
            if w >= spec.threshold:
                vals.append(w)
        x += step
    vals.sort()
    med = vals[len(vals) // 2] if vals else spec.on_w
    res = (med, len(vals))
    if len(_BASE_CACHE) > 20_000:
        _BASE_CACHE.clear()
    _BASE_CACHE[key] = res
    return res


# ---------------------------------------------------------------------------
# Loads not covered by adapters
# ---------------------------------------------------------------------------

_AUX_CACHE: dict = {}


def _aux_cached(key, t_now, d, fn):
    full = t_now >= day_start(d) + timedelta(days=1)
    k = key + ((None,) if full else (int(t_now.timestamp() // 300),))
    hit = _AUX_CACHE.get(k)
    if hit is None:
        if len(_AUX_CACHE) > 50_000:
            _AUX_CACHE.clear()
        hit = _AUX_CACHE[k] = fn()
    return hit


def unmonitored_hourly(household, d, t_now):
    return _aux_cached(("u", household.id, household.unmonitored_base_w, d), t_now, d, lambda: _unmonitored(household, d, t_now))


def common_hourly(building, d, t_now):
    return _aux_cached(("c", building.id, building.common_base_w, building.common_fault_since, d), t_now, d, lambda: _common(building, d, t_now))


def _unmonitored(household, d, t_now):
    ds = day_start(d)
    out = []
    for h in range(24):
        hs = ds + timedelta(hours=h)
        frac = max(0.0, min(1.0, (t_now - hs).total_seconds() / 3600))
        out.append(household.unmonitored_base_w * UNMONITORED_SHAPE[h] * (0.85 + 0.3 * noise(household.id, d.toordinal() * 24 + h)) * frac / 1000)
    return out


def _common(building, d, t_now):
    ds = day_start(d)
    out = []
    for h in range(24):
        hs = ds + timedelta(hours=h)
        frac = max(0.0, min(1.0, (t_now - hs).total_seconds() / 3600))
        factor = 3.0 if building.common_fault_since and hs >= building.common_fault_since else 1.0
        out.append(building.common_base_w * factor * COMMON_SHAPE[h] * (0.9 + 0.2 * noise(building.id, d.toordinal() * 24 + h)) * frac / 1000)
    return out


def solar_hourly(building, d, t_now):
    if not building.solar_kwc:
        return [0.0] * 24
    ds = day_start(d)
    clouds = 0.6 + 0.4 * noise(building.id + 11, d.toordinal())
    out = []
    for h in range(24):
        x = h + 0.5
        p = 0.0 if x < 7 or x > 17.5 else building.solar_kwc * 0.72 * math.sin(math.pi * (x - 7) / 10.5) * clouds
        frac = max(0.0, min(1.0, (t_now - (ds + timedelta(hours=h))).total_seconds() / 3600))
        out.append(p * frac)
    return out


def is_peak(h):
    return h in PEAK_HOURS
