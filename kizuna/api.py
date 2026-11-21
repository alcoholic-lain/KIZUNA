"""Authentication, profile, benchmark and learning endpoints."""
import re
from datetime import timedelta

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie

from m11 import model as M
from m11.profiles import CATALOG, USER_CATEGORIES
from m11.seed import DEMO_ACCOUNTS, DEMO_PASSWORD
from m12.data import CO2_KG_PER_KWH, installations, matrix, pairs, today, totals
from m12.models import LearningProgress, Profile
from m14 import rewards

from . import benchmarks
from .apiutils import ApiError, api, body, household_of, profile_of

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def me_json(request):
    data = {
        "authenticated": request.user.is_authenticated,
        "demo": [{"role": r, "name": a["name"], "email": a["email"]} for r, a in DEMO_ACCOUNTS.items()],
        "password": DEMO_PASSWORD,
        "categories": [{"code": c, "label": CATALOG[c]["label"], "room": CATALOG[c]["room"], "watts": CATALOG[c]["on_w"]} for c in USER_CATEGORIES],
    }
    p = getattr(request.user, "profile", None) if request.user.is_authenticated else None
    if p:
        h = p.household
        data["user"] = {
            "name": p.display_name, "email": request.user.email, "role": p.role, "city": p.city, "onboarded": p.onboarded,
            "household": {"code": h.code, "label": h.label, "building": h.building.name, "region": h.building.region.name,
                          "goal": h.monthly_goal_kwh, "occupants": h.occupants, "kva": h.subscribed_kva} if h else None,
        }
    return data


@ensure_csrf_cookie
@api()
def me(request):
    return me_json(request)


@api(("POST",))
def do_login(request):
    d = body(request)
    ident, pw = (d.get("email") or "").strip(), d.get("password") or ""
    User = get_user_model()
    u = User.objects.filter(email__iexact=ident).first() or User.objects.filter(username__iexact=ident).first()
    user = authenticate(request, username=u.username, password=pw) if u else None
    if not user:
        raise ApiError("E-mail ou mot de passe incorrect", 401)
    login(request, user)
    return me_json(request)


@api(("POST",))
def demo_login(request):
    acc = DEMO_ACCOUNTS.get(body(request).get("role"))
    if not acc:
        raise ApiError("Compte inconnu")
    user = get_user_model().objects.filter(username=acc["username"]).first()
    if not user:
        from m11.seed import reset_demo
        reset_demo()
        user = get_user_model().objects.get(username=acc["username"])
    if request.user.pk != user.pk:
        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return me_json(request)


@api(("POST",))
def do_logout(request):
    logout(request)
    return {"ok": True}


@api(("POST",))
def register(request):
    d = body(request)
    name, email, pw = (d.get("name") or "").strip(), (d.get("email") or "").strip().lower(), d.get("password") or ""
    role = d.get("role") if d.get("role") in ("foyer", "etudiant", "famille", "entreprise") else "foyer"
    errors = {}
    if len(name) < 2:
        errors["name"] = "Nom requis"
    if not EMAIL_RE.match(email):
        errors["email"] = "E-mail invalide"
    elif get_user_model().objects.filter(email__iexact=email).exists():
        errors["email"] = "E-mail déjà utilisé"
    if len(pw) < 8:
        errors["password"] = "8 caractères minimum"
    if errors:
        return JsonResponse({"error": "Champs invalides", "fields": errors}, status=400)
    user = get_user_model().objects.create_user(username=email[:150], email=email, password=pw)
    Profile.objects.create(user=user, role=role, display_name=name, city=(d.get("city") or "Tunis")[:60], onboarded=True)
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    household_of(request)
    return me_json(request)


@api(("POST",))
def update_profile(request):
    p = profile_of(request)
    d = body(request)
    if (d.get("name") or "").strip():
        p.display_name = d["name"].strip()[:80]
    if (d.get("city") or "").strip():
        p.city = d["city"].strip()[:60]
    p.save()
    if p.role != "steg":
        h = household_of(request)
        try:
            if "goal" in d:
                h.monthly_goal_kwh = max(10.0, min(100000.0, float(d["goal"])))
            if "occupants" in d:
                h.occupants = max(1, min(500, int(d["occupants"])))
            if "kva" in d:
                h.subscribed_kva = max(1, min(100, int(d["kva"])))
        except (TypeError, ValueError):
            raise ApiError("Valeur invalide")
        h.save()
    return me_json(request)


@api()
def benchmark(request):
    mine = None
    p = getattr(request.user, "profile", None) if request.user.is_authenticated else None
    if p and p.household:
        now = M.now()
        d = today(now)
        prs = pairs(installations([p.household]))
        kwh28 = sum(totals(matrix(prs, d - timedelta(days=28), d - timedelta(days=1), now)).values())
        year = (kwh28 / 28 + p.household.unmonitored_base_w * 24 / 1000) * 365
        mine = {"label": p.household.label, "kwh_year": round(year), "co2_t": round(year * CO2_KG_PER_KWH / 1000, 2)}
    return {"countries": benchmarks.COUNTRIES, "sources": benchmarks.SOURCES, "mine": mine}


@api(("POST",))
def learn_complete(request):
    p = profile_of(request)
    d = body(request)
    item = (d.get("item") or "")[:40]
    if not item:
        raise ApiError("Quiz inconnu")
    obj, created = LearningProgress.objects.get_or_create(user=request.user, item=item, defaults={"score": int(d.get("score") or 0)})
    got = 0
    if created and p.household and p.role != "steg":
        got = rewards.fixed_grant(p.household, 15, "education", f"Quiz : {d.get('title') or item}", M.now())
    return {"tokens": got, "done": list(LearningProgress.objects.filter(user=request.user).values_list("item", flat=True))}


@api()
def learn_progress(request):
    if not request.user.is_authenticated:
        return {"done": []}
    return {"done": list(LearningProgress.objects.filter(user=request.user).values_list("item", flat=True))}
