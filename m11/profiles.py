"""Appliance profiles and the deterministic power model (module M1).

Every simulated value comes from ``power_at``: a pure function of the adapter,
its seed and the simulated minute. The history seeded at reset and the live
ticks use the same function, so all screens stay consistent.

Nothing here can switch mains power. Modifiers (anomaly, efficiency, standby
cut) only change the *simulated* measurement.
"""
import math
from datetime import date, datetime, timedelta, timezone

# Tunisia uses UTC+1 all year (no daylight saving time since 2009).
TN = timezone(timedelta(hours=1), "Africa/Tunis")


def _ranges(spec, base=0.0):
    p = [base] * 24
    for (start, end), value in spec.items():
        for h in range(start, end):
            p[h % 24] = value
    return p


# kind: "cycle" (compressor), "block" (on/off blocks driven by an hourly
# probability), "constant" (always on, small noise).
CATALOG = {
    "refrigerateur": dict(label="Réfrigérateur", on_w=120, standby_w=3, kind="cycle", period=46, duty=0.40,
                          room="Cuisine", standby_prone=False, shiftable=False, high=False),
    "climatisation": dict(label="Climatiseur réversible", on_w=1000, standby_w=4, kind="block", block=20,
                          p=_ranges({(6, 8): 0.18, (12, 15): 0.10, (18, 23): 0.45, (23, 24): 0.2}),
                          room="Salon", standby_prone=False, shiftable=False, high=True, weather=True),
    "ordinateur": dict(label="Ordinateur", on_w=80, standby_w=3, kind="block", block=15,
                       p=_ranges({(8, 12): 0.35, (14, 18): 0.35, (20, 24): 0.55, (0, 1): 0.2}),
                       room="Bureau", standby_prone=True, shiftable=False, high=False),
    "television": dict(label="Télévision et décodeur", on_w=95, standby_w=9, kind="block", block=30,
                       p=_ranges({(12, 14): 0.35, (19, 23): 0.85, (23, 24): 0.35}),
                       room="Salon", standby_prone=True, shiftable=False, high=False),
    "chargeur": dict(label="Chargeur de téléphone", on_w=11, standby_w=0.5, kind="block", block=30,
                     p=_ranges({(22, 24): 0.8, (0, 2): 0.55, (13, 14): 0.3}),
                     room="Chambre", standby_prone=True, shiftable=False, high=False),
    "chauffe_eau": dict(label="Chauffe-eau électrique", on_w=1500, standby_w=0, kind="block", block=10,
                        p=_ranges({(6, 8): 0.25, (19, 22): 0.15}, base=0.02),
                        room="Salle de bain", standby_prone=False, shiftable=True, high=True),
    "machine_a_laver": dict(label="Machine à laver", on_w=550, standby_w=1, kind="block", block=30,
                            p=_ranges({(9, 11): 0.18, (19, 21): 0.15}),
                            room="Buanderie", standby_prone=False, shiftable=True, high=False),
    "four": dict(label="Four et micro-ondes", on_w=1200, standby_w=2, kind="block", block=10,
                 p=_ranges({(12, 13): 0.3, (19, 21): 0.25}),
                 room="Cuisine", standby_prone=False, shiftable=False, high=True),
    "radiateur": dict(label="Radiateur électrique", on_w=1400, standby_w=0, kind="block", block=20,
                      p=_ranges({(6, 8): 0.25, (19, 23): 0.4}),
                      room="Chambre", standby_prone=False, shiftable=False, high=True, weather=True),
    "routeur": dict(label="Box internet", on_w=8, standby_w=8, kind="constant",
                    room="Salon", standby_prone=False, shiftable=False, high=False),
    "console": dict(label="Console de jeux", on_w=140, standby_w=10, kind="block", block=30,
                    p=_ranges({(17, 23): 0.35}),
                    room="Chambre", standby_prone=True, shiftable=False, high=False),
    "eclairage": dict(label="Éclairage", on_w=60, standby_w=0, kind="block", block=30,
                      p=_ranges({(6, 8): 0.5, (17, 24): 0.85}),
                      room="Salon", standby_prone=False, shiftable=False, high=False),
    "compresseur": dict(label="Compresseur d'air", on_w=4000, standby_w=25, kind="block", block=15, business=True,
                        p=_ranges({(8, 12): 0.7, (13, 17): 0.7}),
                        room="Atelier", standby_prone=True, shiftable=True, high=True),
    "serveurs": dict(label="Baie de serveurs", on_w=850, standby_w=850, kind="constant",
                     room="Salle serveurs", standby_prone=False, shiftable=False, high=False),
    "machine_industrielle": dict(label="Ligne de machines à coudre", on_w=2400, standby_w=40, kind="block", block=20,
                                 business=True, p=_ranges({(8, 12): 0.85, (13, 17): 0.85}),
                                 room="Atelier", standby_prone=True, shiftable=False, high=True),
    "eclairage_pro": dict(label="Éclairage atelier", on_w=1800, standby_w=0, kind="block", block=60, business=True,
                          p=_ranges({(7, 18): 0.95}), room="Atelier", standby_prone=False, shiftable=False, high=True),
    "autre": dict(label="Autre appareil", on_w=150, standby_w=2, kind="block", block=20,
                  p=_ranges({(8, 22): 0.25}), room="Salon", standby_prone=True, shiftable=False, high=False),
}

USER_CATEGORIES = [
    "refrigerateur", "climatisation", "ordinateur", "television", "chargeur", "chauffe_eau",
    "machine_a_laver", "four", "radiateur", "routeur", "console", "eclairage", "autre",
]

# Shapes for loads that no adapter measures (lighting, cooking, pumps...).
UNMONITORED_SHAPE = [0.5, 0.4, 0.4, 0.4, 0.4, 0.5, 0.9, 1.3, 1.1, 0.9, 0.9, 1.0,
                     1.3, 1.2, 0.9, 0.8, 0.9, 1.1, 1.6, 2.0, 1.9, 1.6, 1.1, 0.7]
COMMON_SHAPE = [1.1, 1.1, 1.1, 1.1, 1.1, 1.0, 0.9, 1.0, 0.9, 0.8, 0.8, 0.8,
                0.8, 0.8, 0.8, 0.8, 0.9, 1.1, 1.3, 1.3, 1.2, 1.2, 1.1, 1.1]

PEAK_HOURS = range(18, 22)


def cat(code):
    return CATALOG.get(code) or CATALOG["autre"]


def noise(a, b):
    x = (a * 374761393 + b * 668265263) & 0xFFFFFFFF
    x = ((x ^ (x >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((x ^ (x >> 16)) & 0xFFFFFFFF) / 4294967296.0


def weather_factor(d: date) -> float:
    """Simulated cold-weather factor for heating loads (November)."""
    n = d.toordinal()
    return 0.85 + 0.25 * (0.5 + 0.5 * math.sin(n / 4.3)) + 0.1 * noise(n, 77)


def minute_index(t: datetime) -> int:
    return int(t.timestamp() // 60)


def on_power(adapter, info=None) -> float:
    cached = adapter.__dict__.get("_on_w")
    if cached is not None:
        return cached
    info = info or cat(adapter.category)
    value = info["on_w"] * (0.88 + 0.24 * noise(adapter.seed, 999))
    adapter.__dict__["_on_w"] = value
    return value


def active_threshold(adapter, info=None) -> float:
    """Above this power the appliance is considered "in use"."""
    info = info or cat(adapter.category)
    if info["kind"] == "constant":
        return 0.5 * info["on_w"]
    return max(info["standby_w"] * 2.5 + 1.0, 0.3 * on_power(adapter, info))


def power_at(adapter, t: datetime, info=None):
    """Return (watts, in_use) for the adapter at simulated time ``t``."""
    info = info or cat(adapter.category)
    lt = t.astimezone(TN)
    forced = bool(adapter.forced_on_until and t < adapter.forced_on_until)
    anomaly = adapter.anomaly
    if anomaly and adapter.anomaly_until and t >= adapter.anomaly_until:
        anomaly = ""
    wf = weather_factor(lt.date()) if info.get("weather") else 1.0
    return power_core(adapter, info, minute_index(t), lt.hour, lt.weekday() >= 5, wf, forced, anomaly)


def usage_probability(adapter, info, h, weekend, wf):
    if info["kind"] == "constant":
        return 1.0
    if info["kind"] == "cycle":
        return info["duty"]
    prob = info["p"][h] * adapter.usage_scale
    if info.get("business") and weekend:
        return 0.0
    if weekend and adapter.category in ("television", "console", "machine_a_laver", "four"):
        prob *= 1.3
    return min(prob * wf, 0.95)


def expected_w(adapter, info, h, weekend, wf):
    """Average power over an hour (used for older history, cheaper than sampling)."""
    p = usage_probability(adapter, info, h, weekend, wf)
    return p * on_power(adapter, info) + (1 - p) * info["standby_w"]


def power_core(adapter, info, m, h, weekend, wf, forced=False, anomaly=""):
    """Fast path shared by the live engine and the history seeder."""
    seed = adapter.seed
    base_on = on_power(adapter, info)

    if info["kind"] == "constant":
        on = True
    elif info["kind"] == "cycle":
        period = info["period"]
        on = ((m + seed * 7) % period) < period * info["duty"]
    else:
        prob = info["p"][h] * adapter.usage_scale
        if info.get("business") and weekend:
            prob = 0.0
        elif weekend and adapter.category in ("television", "console", "machine_a_laver", "four"):
            prob *= 1.3
        prob *= wf
        block = info["block"]
        on = noise(seed, (m + seed * 13) // block) < min(prob, 0.95)

    if forced:
        on = True

    jitter = 1 + 0.08 * (noise(seed + 3, m) - 0.5)
    if anomaly == "pic":
        on = True
    if on:
        w = base_on * adapter.efficiency_factor * jitter
        if anomaly in ("surcharge", "pic"):
            w *= adapter.anomaly_factor
    else:
        standby = info["standby_w"]
        if adapter.standby_cut and info["standby_prone"]:
            standby = 0.3
        if anomaly == "veille":
            standby = max(standby, 1) * adapter.anomaly_factor
        w = standby * (1 + 0.1 * (noise(seed + 5, m) - 0.5))
    return max(w, 0.0), on


def unmonitored_w(household, t: datetime) -> float:
    lt = t.astimezone(TN)
    return household.unmonitored_base_w * UNMONITORED_SHAPE[lt.hour] * (0.9 + 0.2 * noise(household.id or 1, minute_index(t) // 30))


def common_w(building, t: datetime, factor=1.0) -> float:
    lt = t.astimezone(TN)
    return building.common_base_w * factor * COMMON_SHAPE[lt.hour] * (0.92 + 0.16 * noise(building.id or 1, minute_index(t) // 30))


def solar_w(building, t: datetime) -> float:
    """Simulated rooftop production (November daylight 07:00 to 17:30)."""
    if not building.solar_kwc:
        return 0.0
    lt = t.astimezone(TN)
    x = lt.hour + lt.minute / 60
    if x < 7 or x > 17.5:
        return 0.0
    clouds = 0.65 + 0.35 * noise(building.id or 1, lt.toordinal() if hasattr(lt, "toordinal") else 0)
    return building.solar_kwc * 1000 * 0.72 * math.sin(math.pi * (x - 7) / 10.5) * clouds
