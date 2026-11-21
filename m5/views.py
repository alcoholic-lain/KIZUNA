"""M5 back office: staff-only monitoring of devices, households, usage, alerts and credits.

Sign-in goes through M10 (Google via django-allauth, or a Django staff password).
All figures are computed from the M2 tables; demo data is simulated.
"""

from datetime import timedelta, timezone as dt_timezone
from functools import wraps

from django.contrib.auth.views import redirect_to_login
from django.core.paginator import Paginator
from django.db.models import Avg, Count, Max, Min, OuterRef, Q, Subquery, Sum
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.utils import timezone

from m2.models import Adaptateur, Alerte, Mesure, Recompense, Utilisateur

# Tunisia is UTC+1 all year (no daylight saving), so a fixed offset is exact.
TUNIS = dt_timezone(timedelta(hours=1), "Africa/Tunis")
WINDOW_HOURS = 24
PAGE_SIZE = 25

NAV = [
    ("m5:index", "Overview"),
    ("m5:devices", "Devices"),
    ("m5:users", "Users"),
    ("m5:alerts", "Alerts"),
    ("m5:credits", "Credits"),
]


def back_office(view):
    """Staff only, shown in Tunis local time.

    Visitors who are not signed in go to the M10 sign-in page; signed-in
    accounts without staff rights get a 403 page explaining how to get access.
    """

    @wraps(view)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect_to_login(request.get_full_path(), reverse("m10:index"))
        if not (request.user.is_active and request.user.is_staff):
            return render(request, "m5/forbidden.html", status=403)
        timezone.activate(TUNIS)
        try:
            return view(request, *args, **kwargs)
        finally:
            timezone.deactivate()

    return wrapper


def _page(request, template, active, **context):
    return render(request, template, {"nav": NAV, "active": active, **context})


def _window():
    end = timezone.now()
    return end - timedelta(hours=WINDOW_HOURS), end


def _energy_by_adapter(start, end, **filters):
    """kWh per adapter: average power × the time span its readings cover."""
    rows = (
        Mesure.objects.filter(horodatage__gte=start, horodatage__lte=end, **filters)
        .values("adaptateur_id")
        .annotate(avg=Avg("watts"), first=Min("horodatage"), last=Max("horodatage"))
    )
    energy = {}
    for row in rows:
        hours = (row["last"] - row["first"]).total_seconds() / 3600
        energy[row["adaptateur_id"]] = (row["avg"] or 0) * hours / 1000
    return energy


def _power_series(start, end, **filters):
    """Total power (kW) per timestamp, for the usage chart."""
    rows = (
        Mesure.objects.filter(horodatage__gte=start, horodatage__lte=end, **filters)
        .values("horodatage")
        .annotate(total=Sum("watts"))
        .order_by("horodatage")
    )
    return [(row["horodatage"], row["total"] / 1000) for row in rows]


def _chart(series, width=720, height=200, pad=28):
    """Server-rendered SVG line chart; no JavaScript needed (works in the app)."""
    if len(series) < 2:
        return None
    values = [v for _, v in series]
    top = max(values) * 1.1 or 1
    span = len(series) - 1
    inner_w, inner_h = width - pad * 2, height - pad * 2

    def xy(i, v):
        return pad + inner_w * i / span, pad + inner_h * (1 - v / top)

    points = [xy(i, v) for i, v in enumerate(values)]
    line = " ".join(f"{x:.1f},{y:.1f}" for x, y in points)
    area = f"{pad},{pad + inner_h} {line} {pad + inner_w},{pad + inner_h}"
    ticks = []
    for i in range(0, len(series), max(1, len(series) // 6)):
        x, _ = xy(i, 0)
        ticks.append({"x": round(x, 1), "label": timezone.localtime(series[i][0]).strftime("%H:%M")})
    peak_i = values.index(max(values))
    px, py = points[peak_i]
    return {
        "width": width,
        "height": height,
        "line": line,
        "area": area,
        "ticks": ticks,
        "base_y": pad + inner_h,
        "top_label": f"{top:.1f} kW",
        "pad": pad,
        "top_label_y": pad - 10,
        "tick_y": pad + inner_h + 16,
        "peak": {"x": round(px, 1), "y": round(py, 1), "label_y": round(max(py - 10, 12), 1),
                 "anchor": "end" if px > width * 0.8 else ("start" if px < width * 0.2 else "middle"),
                 "value": f"{max(values):.1f} kW",
                 "time": timezone.localtime(series[peak_i][0]).strftime("%H:%M")},
    }


def _latest_watts():
    return Subquery(
        Mesure.objects.filter(adaptateur=OuterRef("pk")).order_by("-horodatage").values("watts")[:1]
    )


@back_office
def index(request):
    start, end = _window()
    energy = _energy_by_adapter(start, end)
    adapters = Adaptateur.objects.select_related("utilisateur")
    by_status = dict(adapters.values_list("statut").annotate(n=Count("pk")))

    region_names = dict(Utilisateur.Region.choices)
    regions = {
        code: {"name": name, "households": 0, "devices": 0, "kwh": 0.0, "alerts": 0}
        for code, name in region_names.items()
    }
    for row in Utilisateur.objects.values("region").annotate(n=Count("pk")):
        regions[row["region"]]["households"] = row["n"]
    for adapter in adapters:
        if adapter.utilisateur:
            region = regions[adapter.utilisateur.region]
            region["devices"] += 1
            region["kwh"] += energy.get(adapter.pk, 0)
    for row in (
        Alerte.objects.filter(resolue=False)
        .values("adaptateur__utilisateur__region")
        .annotate(n=Count("pk"))
    ):
        if row["adaptateur__utilisateur__region"] in regions:
            regions[row["adaptateur__utilisateur__region"]]["alerts"] = row["n"]

    household_kwh = {}
    for adapter in adapters:
        if adapter.utilisateur_id:
            household_kwh[adapter.utilisateur_id] = household_kwh.get(adapter.utilisateur_id, 0) + energy.get(adapter.pk, 0)
    top_ids = sorted(household_kwh, key=household_kwh.get, reverse=True)[:5]
    top_names = Utilisateur.objects.in_bulk(top_ids)
    top = [{"household": top_names[i], "kwh": household_kwh[i]} for i in top_ids]

    period = timezone.localdate().strftime("%Y-%m")
    credits = Recompense.objects.filter(periode=period).aggregate(points=Sum("points"), kwh=Sum("kwh_evites"))

    return _page(
        request,
        "m5/index.html",
        "m5:index",
        kpis={
            "households": Utilisateur.objects.count(),
            "active": by_status.get("actif", 0),
            "offline": by_status.get("hors_ligne", 0),
            "unpaired": by_status.get("non_associe", 0),
            "kwh": sum(energy.values()),
            "open_alerts": Alerte.objects.filter(resolue=False).count(),
            "points": credits["points"] or 0,
            "kwh_avoided": credits["kwh"] or 0,
            "period": period,
        },
        chart=_chart(_power_series(start, end)),
        regions=regions.values(),
        top=top,
        alerts=Alerte.objects.filter(resolue=False).select_related(
            "adaptateur__utilisateur", "adaptateur__appareil"
        )[:6],
    )


@back_office
def devices(request):
    start, end = _window()
    energy = _energy_by_adapter(start, end)
    qs = (
        Adaptateur.objects.select_related("utilisateur", "appareil")
        .annotate(
            watts=_latest_watts(),
            open_alerts=Count("alertes", filter=Q(alertes__resolue=False)),
        )
        .order_by("id")
    )
    status = request.GET.get("status", "")
    region = request.GET.get("region", "")
    query = request.GET.get("q", "").strip()
    if status in Adaptateur.Statut.values:
        qs = qs.filter(statut=status)
    if region in Utilisateur.Region.values:
        qs = qs.filter(utilisateur__region=region)
    if query:
        qs = qs.filter(
            Q(id__icontains=query) | Q(utilisateur__nom__icontains=query) | Q(appareil__nom__icontains=query)
        )
    page = Paginator(qs, PAGE_SIZE).get_page(request.GET.get("page"))
    for adapter in page:
        adapter.kwh = energy.get(adapter.pk)
    return _page(
        request,
        "m5/devices.html",
        "m5:devices",
        page=page,
        statuses=Adaptateur.Statut.choices,
        regions=Utilisateur.Region.choices,
        filters={"status": status, "region": region, "q": query},
        total=qs.count(),
    )


@back_office
def users(request):
    start, end = _window()
    energy = _energy_by_adapter(start, end)
    qs = Utilisateur.objects.annotate(
        devices=Count("adaptateurs", distinct=True),
        open_alerts=Count("adaptateurs__alertes", filter=Q(adaptateurs__alertes__resolue=False), distinct=True),
    )
    points = dict(
        Recompense.objects.values("utilisateur").annotate(total=Sum("points")).values_list("utilisateur", "total")
    )
    region = request.GET.get("region", "")
    query = request.GET.get("q", "").strip()
    if region in Utilisateur.Region.values:
        qs = qs.filter(region=region)
    if query:
        qs = qs.filter(nom__icontains=query)

    adapter_owner = dict(Adaptateur.objects.exclude(utilisateur=None).values_list("pk", "utilisateur_id"))
    kwh = {}
    for adapter_id, value in energy.items():
        owner = adapter_owner.get(adapter_id)
        if owner:
            kwh[owner] = kwh.get(owner, 0) + value

    rows = list(qs)
    for user in rows:
        user.kwh = kwh.get(user.pk, 0)
        user.points = points.get(user.pk, 0)
    sort = request.GET.get("sort", "kwh")
    keys = {"kwh": lambda u: -u.kwh, "points": lambda u: -u.points, "alerts": lambda u: -u.open_alerts, "name": lambda u: u.nom}
    rows.sort(key=keys.get(sort, keys["kwh"]))
    page = Paginator(rows, PAGE_SIZE).get_page(request.GET.get("page"))
    return _page(
        request,
        "m5/users.html",
        "m5:users",
        page=page,
        regions=Utilisateur.Region.choices,
        filters={"region": region, "q": query, "sort": sort},
        total=len(rows),
    )


@back_office
def user_detail(request, pk):
    household = get_object_or_404(Utilisateur.objects.select_related("compte"), pk=pk)
    start, end = _window()
    energy = _energy_by_adapter(start, end, adaptateur__utilisateur=household)
    adapters = list(
        household.adaptateurs.select_related("appareil").annotate(watts=_latest_watts()).order_by("id")
    )
    for adapter in adapters:
        adapter.kwh = energy.get(adapter.pk)
    rewards = household.recompenses.order_by("-periode")
    return _page(
        request,
        "m5/user_detail.html",
        "m5:users",
        household=household,
        adapters=adapters,
        kwh=sum(energy.values()),
        chart=_chart(_power_series(start, end, adaptateur__utilisateur=household)),
        alerts=Alerte.objects.filter(adaptateur__utilisateur=household).select_related("adaptateur__appareil")[:20],
        rewards=rewards,
        points=rewards.aggregate(total=Sum("points"))["total"] or 0,
    )


@back_office
def alerts(request):
    state = request.GET.get("state", "open")
    qs = Alerte.objects.select_related("adaptateur__utilisateur", "adaptateur__appareil")
    if state == "open":
        qs = qs.filter(resolue=False)
    elif state == "resolved":
        qs = qs.filter(resolue=True)
    page = Paginator(qs, PAGE_SIZE).get_page(request.GET.get("page"))
    return _page(
        request,
        "m5/alerts.html",
        "m5:alerts",
        page=page,
        state=state,
        counts={
            "open": Alerte.objects.filter(resolue=False).count(),
            "resolved": Alerte.objects.filter(resolue=True).count(),
        },
    )


@back_office
def credits(request):
    periods = list(
        Recompense.objects.values("periode")
        .annotate(points=Sum("points"), kwh=Sum("kwh_evites"), households=Count("utilisateur", distinct=True))
        .order_by("-periode")
    )
    selected = request.GET.get("period") or (periods[0]["periode"] if periods else "")
    ledger = (
        Recompense.objects.filter(periode=selected).select_related("utilisateur").order_by("-points")
        if selected
        else Recompense.objects.none()
    )
    page = Paginator(ledger, PAGE_SIZE).get_page(request.GET.get("page"))
    totals = Recompense.objects.aggregate(points=Sum("points"), kwh=Sum("kwh_evites"))
    return _page(
        request,
        "m5/credits.html",
        "m5:credits",
        periods=periods,
        selected=selected,
        page=page,
        totals={"points": totals["points"] or 0, "kwh": totals["kwh"] or 0},
    )
