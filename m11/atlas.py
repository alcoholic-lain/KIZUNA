"""Energy atlas of Tunisia (Kinto's M1 map, served by Django).

A deterministic fleet of ~1,000 adapters, each placed in a real OpenStreetMap
house footprint of one of nine demo neighbourhoods (assets/atlas/*.json).
Adapters that are really installed in the database report their simulated
household power; the others follow a synthetic wave. Phone GPS fixes taken
when an adapter's QR is scanned (AtlasLocation) move it to its real position.
"""
import json
import math
from datetime import datetime, timedelta
from operator import itemgetter
from functools import lru_cache
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.db.models import F, Min, Window
from django.db.models.functions import RowNumber
from django.utils import timezone

from kizuna.apiutils import ApiError, api, body, profile_of, require_steg
from m12.models import Adapter, Installation, Reading
from m15.receiver import receiver_readings

from . import model as M
from .models import AtlasLocation

DATA_DIR = Path(settings.BASE_DIR) / "assets" / "atlas"
POLICY = {"id": "TN-demo-v1", "unit": "W", "economic_max_ratio": 1, "elevated_max_ratio": 1.35}
SITES = [  # id, city, lat, lon, adapters (= mapped homes in the extract)
    ("tunis", "Tunis", 36.795, 10.12, 270),
    ("sfax", "Sfax", 34.775, 10.675, 205),
    ("sousse", "Sousse", 35.825, 10.545, 145),
    ("kairouan", "Kairouan", 35.675, 10.095, 110),
    ("kef", "Le Kef", 36.18, 8.71, 85),
    ("gafsa", "Gafsa", 34.42, 8.78, 70),
    ("gabes", "Gabès", 33.875, 9.995, 50),
    ("tataouine", "Tataouine", 32.93, 10.45, 40),
    ("tozeur", "Tozeur", 33.92, 8.13, 25),
]
PROFILES = [  # same bench as the Node simulator (m1/static/m1/model.js)
    ("Réfrigérateur", 90, 0.12),
    ("Ordinateur", 60, 0.22),
    ("Télévision", 110, 0.10),
    ("Climatisation", 900, 0.08),
    ("Chargeur téléphone", 10, 0.25),
]
ELEVATION = [14, 18, 33, 68, 650, 296, 16, 240, 47]
FACTORS = [1.15, 0.92, 0.62, 1.08, 0.9]
CATCHMENT_KM = 100
ROOF_RADIUS_M = 50
LIVE_READING_WINDOW = timedelta(minutes=2)


@lru_cache(maxsize=1)
def registry():
    """Static part of the fleet, built once per process."""
    fleet, next_serial = [], len(PROFILES) + 1
    for index, (rid, city, lat, lon, count) in enumerate(SITES):
        homes = json.loads((DATA_DIR / f"{rid}.json").read_text(encoding="utf-8"))["homes"]
        if len(homes) != count:
            raise RuntimeError(f"Incomplete footprint data for {rid}")
        for i, home in enumerate(homes):
            bench = i == 0 and index < len(PROFILES)
            serial = index + 1 if bench else next_serial
            if not bench:
                next_serial += 1
            name, base, variation = PROFILES[(serial - 1) % len(PROFILES)]
            x, y = home["point"]
            fleet.append({
                "adaptateur_id": f"NABD-{serial:04d}", "serial": serial, "name": name, "base": base, "variation": variation,
                "online": serial % 7 != 0 and serial % 11 != 0, "region_id": rid, "city": city,
                "location": {"x": x, "y": y, "z": ELEVATION[index] + serial % 4 * 3, "source": "simulated_building",
                             "building_id": home["osm_id"]},
                "reference_watts": round(base * FACTORS[(serial - 1) % 5]),
            })
    return fleet


def known_ids():
    return {d["adaptateur_id"] for d in registry()}


def _site_of(x, y):
    best, best_km = None, CATCHMENT_KM
    for rid, city, lat, lon, _ in SITES:
        km = 111.2 * math.hypot(y - lat, (x - lon) * math.cos(math.radians(y)))
        if km < best_km:
            best, best_km = (rid, city), km
    return best or ("outside", "Hors secteurs")


def _state(watts, reference):
    ratio = watts / max(reference, 1)
    if ratio <= POLICY["economic_max_ratio"]:
        return "economic"
    return "elevated" if ratio <= POLICY["elevated_max_ratio"] else "high"


def _location_json(fix):
    loc = {"x": fix.x, "y": fix.y, "z": fix.z, "accuracy_m": fix.accuracy_m,
           "captured_at": fix.captured_at.isoformat(), "source": "phone_gps"}
    if fix.roof_x is not None:
        loc["roof"] = {"x": fix.roof_x, "y": fix.roof_y}
    return loc


def _latest_readings():
    latest = {}
    rows = Reading.objects.annotate(rank=Window(
        expression=RowNumber(), partition_by=[F("adapter_id")], order_by=F("ts").desc(),
    )).filter(rank=1).values_list("adapter_id", "ts", "watts")
    for aid, ts, watts in rows:
        latest[aid] = (ts, watts)
    try:
        upstream = receiver_readings()["readings"]
    except ApiError:
        # Local readings and GPS registrations remain available during a receiver outage.
        return latest
    for row in upstream:
        try:
            aid, stamp, watts = itemgetter("adaptateur_id", "horodatage", "watts")(row)
            ts = datetime.fromisoformat(stamp)
            if not isinstance(aid, str) or ts.tzinfo is None or not math.isfinite(watts) or watts < 0:
                continue
        except (KeyError, TypeError, ValueError, OverflowError):
            continue
        if aid not in latest or ts > latest[aid][0]:
            latest[aid] = (ts, watts)
    return latest


@api()
def registrations(request):
    require_steg(request)
    latest = _latest_readings()
    fixes = {f.adapter_id: f for f in AtlasLocation.objects.all()}
    mapped = {d["adaptateur_id"]: (d["region_id"], d["city"]) for d in registry()}
    first = dict(Reading.objects.order_by().values("adapter_id")
                 .annotate(first=Min("ts")).values_list("adapter_id", "first"))
    items = []
    for aid in fixes.keys() | latest.keys():
        fix = fixes.get(aid)
        reading = latest.get(aid)
        region, city = _site_of(fix.x, fix.y) if fix else mapped.get(aid, (None, None))
        items.append({
            "adaptateur_id": aid, "region": region, "city": city,
            "scan_at": fix.captured_at.isoformat() if fix else None,
            "first_reading_at": first[aid].isoformat() if aid in first else None,
            "last_reading_at": reading[0].isoformat() if reading else None,
            "watts": reading[1] if reading else None,
        })
    items.sort(key=lambda row: max(
        datetime.fromisoformat(value) for value in (row["scan_at"], row["last_reading_at"]) if value
    ), reverse=True)
    return {"items": items}


def snapshot(now=None, region=None):
    """Regions with device counts, plus the devices of one region when asked."""
    now = now or M.now()
    fixes = {f.adapter_id: f for f in AtlasLocation.objects.all()}
    readings = _latest_readings()
    wall_time = timezone.now()
    installs = {i.adapter_id: i for i in Installation.objects.filter(end__isnull=True, monitoring=True)
                .select_related("adapter", "household").prefetch_related("events")}
    minute = now.timestamp() / 2  # the wave moves like the simulator: one step every ~2 s
    totals = {rid: {"id": rid, "city": city, "latitude": lat, "longitude": lon, "count": 0, "active_count": 0, "confirmed_count": 0}
              for rid, city, lat, lon, _ in SITES}
    fleet = list(registry())
    seen = {d["adaptateur_id"] for d in fleet}
    for aid in sorted(set(fixes) - seen):  # scanned adapters outside the demo fleet (e.g. generated demo ones)
        serial = int(aid[5:]) if aid[5:].isdigit() else 1
        name, base, variation = PROFILES[(serial - 1) % len(PROFILES)]
        fleet.append({"adaptateur_id": aid, "serial": serial, "name": name, "base": base, "variation": variation,
                      "online": True, "region_id": None, "city": None, "location": None,
                      "reference_watts": round(base * FACTORS[(serial - 1) % 5])})
    devices = []
    for d in fleet:
        aid = d["adaptateur_id"]
        inst = installs.get(aid)
        name = inst.name if inst else d["name"]
        watts = None
        sampled_at = now
        fix = fixes.get(aid)
        reading = readings.get(aid)
        if reading:
            sampled_at, measured = reading
            if timedelta() <= wall_time - sampled_at < LIVE_READING_WINDOW:
                watts = round(measured, 1)
        elif not fix and inst:
            measured = M.measured_power(M.spec_of(inst, events=list(inst.events.all())), now)
            watts = None if measured is None else round(measured, 1)
        elif not fix and d["online"]:
            wave = math.sin(minute * 0.43 + d["serial"]) * math.cos(minute * 0.13 + d["serial"] / 7)
            watts = round(d["base"] * (1 + d["variation"] * wave), 1)
        active = watts is not None
        if fix:
            location = _location_json(fix)
            rid, city = _site_of(fix.x, fix.y)
        elif d["location"]:
            location, rid, city = d["location"], d["region_id"], d["city"]
        else:
            continue
        if rid not in totals:
            totals[rid] = {"id": rid, "city": city, "latitude": None, "longitude": None, "count": 0, "active_count": 0, "confirmed_count": 0}
        totals[rid]["count"] += 1
        totals[rid]["active_count"] += active
        totals[rid]["confirmed_count"] += bool(fix or reading)
        if region and rid == region:
            devices.append({
                "adaptateur_id": aid, "name": name, "region_id": rid, "city": city, "installed": bool(inst),
                "latitude": location["y"], "longitude": location["x"], "altitude": location.get("z"),
                "location": location, "reference_watts": d["reference_watts"], "active": active, "watts": watts,
                "state": _state(watts, d["reference_watts"]) if active else "offline",
                "horodatage": sampled_at.isoformat() if active else None,
            })
    regions = [r for r in totals.values() if r["count"] or r["id"] != "outside"]
    return {"country": "TN", "utility": "STEG", "source": "simulee", "policy": POLICY,
            "horodatage": now.isoformat(), "regions": regions, "devices": devices}


def _number(data, key, low, high, label, required=True):
    value = data.get(key)
    if value is None and not required:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
        raise ApiError(f"{label} invalide.")
    return float(value)


def _when(value):
    try:
        ts = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        raise ApiError("Horodatage GPS invalide.")
    if ts.tzinfo is None or ts > datetime.now(ts.tzinfo) + timedelta(minutes=1):
        raise ApiError("Horodatage GPS invalide.")
    return ts


def _adapter_for(request, data):
    """The adapter the caller may locate: any for STEG, only their own installed ones for a household."""
    from m14 import services
    aid = services.normalize(data.get("adaptateur_id"))
    if not aid:
        raise ApiError("Identifiant d'adaptateur manquant.")
    profile = profile_of(request)
    if profile.role == "steg":
        if aid not in known_ids() and not Adapter.objects.filter(id=aid).exists():
            raise ApiError("Adaptateur inconnu.", 404)
        return aid
    if not profile.household_id or not Installation.objects.filter(
            adapter_id=aid, household_id=profile.household_id, end__isnull=True).exists():
        raise ApiError("Cet adaptateur n'est pas associé à votre foyer.", 403)
    return aid


def _device(aid):
    fix = AtlasLocation.objects.get(pk=aid)
    rid, _ = _site_of(fix.x, fix.y)
    return next(d for d in snapshot(region=rid)["devices"] if d["adaptateur_id"] == aid)


@api()
def atlas(request):
    require_steg(request)
    region = request.GET.get("region") or None
    if region and region != "outside" and region not in {s[0] for s in SITES}:
        raise ApiError("Région inconnue.", 404)
    return snapshot(region=region)


@api(("POST",))
def locate(request):
    """Save the phone GPS fix taken while scanning the adapter's QR."""
    data = body(request)
    aid = _adapter_for(request, data)
    x = _number(data, "x", -180, 180, "Longitude GPS")
    y = _number(data, "y", -90, 90, "Latitude GPS")
    z = _number(data, "z", -500, 9000, "Altitude GPS", required=False)
    accuracy = _number(data, "accuracy_m", 0, 5000, "Précision GPS")
    captured = _when(data.get("captured_at"))
    with transaction.atomic():
        previous = AtlasLocation.objects.select_for_update().filter(pk=aid).first()
        if previous and previous.captured_at > captured:
            raise ApiError("Une position plus récente est déjà enregistrée.", 409)
        AtlasLocation.objects.update_or_create(adapter_id=aid, defaults={
            "x": x, "y": y, "z": z, "accuracy_m": accuracy, "captured_at": captured,
            "roof_x": None, "roof_y": None, "recorded_by": request.user})
    return _device(aid)


@api(("POST",))
def roof(request):
    """Pin the adapter to the roof the user tapped, near its GPS fix."""
    data = body(request)
    aid = _adapter_for(request, data)
    fix = AtlasLocation.objects.filter(pk=aid).first()
    if not fix or fix.captured_at != _when(data.get("captured_at")):
        raise ApiError("La position GPS a changé. Sélectionnez à nouveau le bâtiment.", 409)
    x = _number(data, "x", -180, 180, "Position du bâtiment")
    y = _number(data, "y", -90, 90, "Position du bâtiment")
    distance = 111320 * math.hypot(y - fix.y, (x - fix.x) * math.cos(math.radians(fix.y)))
    if distance > max(ROOF_RADIUS_M, fix.accuracy_m):
        raise ApiError("Choisissez un toit à proximité du relevé GPS.")
    fix.roof_x, fix.roof_y = x, y
    fix.save(update_fields=["roof_x", "roof_y", "updated_at"])
    return _device(aid)


FIRST_DEMO_SERIAL = 7001  # above every seeded adapter (seed uses up to NABD-5xxx)


@api(("POST",))
def demo_adapter(request):
    """Create a brand-new adapter to print as a QR code and scan with the phone."""
    require_steg(request)
    taken = set(Adapter.objects.filter(id__startswith="NABD-").values_list("id", flat=True)) | set(
        AtlasLocation.objects.values_list("adapter_id", flat=True))
    serial = FIRST_DEMO_SERIAL
    while f"NABD-{serial:04d}" in taken:
        serial += 1
    if serial > 9999:
        raise ApiError("Plus d'identifiant disponible.", 409)
    adapter = Adapter.objects.create(id=f"NABD-{serial:04d}", seed=serial)
    name = PROFILES[(serial - 1) % len(PROFILES)][0]
    return {"id": adapter.id, "name": name}


@api()
def device(request, aid):
    """Where one adapter is, once a phone has scanned it."""
    require_steg(request)
    if not AtlasLocation.objects.filter(pk=aid).exists():
        return {"id": aid, "located": False}
    return {"id": aid, "located": True, "device": _device(aid)}
