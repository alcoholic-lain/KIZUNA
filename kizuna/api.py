"""Authentication, profile, benchmark and learning endpoints."""
import re
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.http import JsonResponse
from django.utils.crypto import constant_time_compare
from django.views.decorators.csrf import ensure_csrf_cookie

from m11 import model as M
from m11.profiles import CATALOG, USER_CATEGORIES
from m11.seed import DEMO_ACCOUNTS
from m12.data import CO2_KG_PER_KWH, installations, matrix, pairs, today, totals
from m12.models import LearningProgress, Profile, TokenTx
from m14 import rewards

from . import benchmarks, learn, terms
from .apiutils import ApiError, api, body, household_of, profile_of, require_local_demo

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def me_json(request):
    data = {
        "authenticated": request.user.is_authenticated,
        "demo": [{"role": r, "name": a["name"], "email": a["email"]} for r, a in DEMO_ACCOUNTS.items()],
        "categories": [{"code": c, "label": CATALOG[c]["label"], "room": CATALOG[c]["room"], "watts": CATALOG[c]["on_w"]} for c in USER_CATEGORIES],
    }
    p = getattr(request.user, "profile", None) if request.user.is_authenticated else None
    if p:
        h = p.household
        data["user"] = {
            "name": p.display_name, "email": request.user.email, "role": p.role, "city": p.city, "onboarded": p.onboarded,
            "terms": {"version": p.terms_version, "accepted_at": p.terms_accepted_at.isoformat() if p.terms_accepted_at else None,
                      "current": terms.VERSION, "ok": p.terms_version == terms.VERSION},
            "household": {"code": h.code, "label": h.label, "building": h.building.name, "region": h.building.region.name,
                          "goal": h.monthly_goal_kwh, "occupants": h.occupants, "kva": h.subscribed_kva} if h else None,
        }
    return data


@ensure_csrf_cookie
@api()
def me(request):
    return me_json(request)


STEG_SESSION_KEY = "mieruka_steg_access"
MODEL_BACKEND = "django.contrib.auth.backends.ModelBackend"


def _is_steg(user):
    p = getattr(user, "profile", None) if user.is_authenticated else None
    return bool(p and p.role == "steg")


def _steg_demo_password_ok(pw):
    """The STEG demo account only accepts the configured secret, never the public demo password."""
    secret = getattr(settings, "MIERUKA_STEG_PASSWORD", "")
    return bool(secret) and constant_time_compare(pw, secret)


@api(("POST",))
def do_login(request):
    d = body(request)
    ident, pw = (d.get("email") or "").strip(), d.get("password") or ""
    User = get_user_model()
    u = User.objects.filter(email__iexact=ident).first() or User.objects.filter(username__iexact=ident).first()
    if u and u.username == DEMO_ACCOUNTS["steg"]["username"]:
        user = u if u.is_active and _steg_demo_password_ok(pw) else None
    else:
        user = authenticate(request, username=u.username, password=pw) if u else None
    if not user:
        raise ApiError("Incorrect email or password", 401)
    if getattr(getattr(user, "profile", None), "is_demo", False):
        require_local_demo(request)
    login(request, user, backend=MODEL_BACKEND)
    if _is_steg(user):
        request.session[STEG_SESSION_KEY] = True
    return me_json(request)


@api(("POST",))
def demo_login(request):
    require_local_demo(request)
    role = body(request).get("role")
    acc = DEMO_ACCOUNTS.get(role)
    if not acc:
        raise ApiError("Unknown account")
    # One-click access is for the fictional households only. STEG requires a
    # session that already proved STEG credentials (password or staff Google).
    steg_ok = bool(request.session.get(STEG_SESSION_KEY)) or _is_steg(request.user)
    if role == "steg" and not steg_ok:
        raise ApiError("STEG area is protected: sign in with \"Email\" using the STEG password.", 403)
    user = get_user_model().objects.filter(username=acc["username"]).first()
    if not user:
        from .apiutils import demo_reset_allowed
        if not demo_reset_allowed():
            raise ApiError("Demo accounts not initialised.", 503)
        from m11.seed import reset_demo
        reset_demo()
        user = get_user_model().objects.get(username=acc["username"])
    if request.user.pk != user.pk:
        login(request, user, backend=MODEL_BACKEND)  # a different user flushes the session...
        if steg_ok:
            request.session[STEG_SESSION_KEY] = True  # ...so keep the presenter's STEG unlock
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
        errors["email"] = "Email already in use"
    if len(pw) < 8:
        errors["password"] = "8 characters minimum"
    if d.get("accept_terms") is not True:
        errors["terms"] = "Please accept the terms and conditions to create an account"
    if errors:
        return JsonResponse({"error": "Champs invalides", "fields": errors}, status=400)
    user = get_user_model().objects.create_user(username=email[:150], email=email, password=pw)
    Profile.objects.create(user=user, role=role, display_name=name, city=(d.get("city") or "Tunis")[:60], onboarded=True,
                           terms_version=terms.VERSION, terms_accepted_at=M.now())
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    household_of(request)
    return me_json(request)


@api(("POST",))
def update_profile(request):
    p = profile_of(request)
    d = body(request)
    if p.terms_version != terms.VERSION:
        if d.get("accept_terms") is not True:
            raise ApiError("Please accept the terms and conditions to save your profile.")
        p.terms_version, p.terms_accepted_at = terms.VERSION, M.now()
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
            raise ApiError("Invalid value")
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


def _learn_state(request):
    rows = {r.item: r.score for r in LearningProgress.objects.filter(user=request.user)}
    items = [{"id": k, "title": v["title"], "tokens": v["tokens"], "pass": v["pass"], "done": k in rows, "score": rows.get(k)}
             for k, v in learn.ACTIVITIES.items()]
    p = getattr(request.user, "profile", None)
    earned = 0
    if p and p.household and p.role != "steg":
        earned = sum(t.amount for t in TokenTx.objects.filter(household=p.household, kind="education"))
    return {"items": items, "done": [i["id"] for i in items if i["done"]], "tokens_earned": earned}


@api(("POST",))
def learn_complete(request):
    p = profile_of(request)
    d = body(request)
    item = d.get("item")
    spec = learn.ACTIVITIES.get(item)
    if not spec:
        raise ApiError("Unknown activity")
    try:
        score = max(0, min(100, int(d.get("score") or 0)))
    except (TypeError, ValueError):
        raise ApiError("Invalid score")
    got = 0
    passed = score >= spec["pass"]
    if passed:
        obj, created = LearningProgress.objects.get_or_create(user=request.user, item=item, defaults={"score": score})
        if not created and score > obj.score:
            obj.score = score
            obj.save(update_fields=["score"])
        if created and p.household and p.role != "steg":
            got = rewards.fixed_grant(p.household, spec["tokens"], "education", f"Learn: {spec['title']}", M.now())
    return {"passed": passed, "tokens": got, **_learn_state(request)}


@api()
def learn_progress(request):
    if not request.user.is_authenticated:
        return {"done": [], "items": [], "tokens_earned": 0}
    return _learn_state(request)


@api()
def learn_bill(request):
    """Bill simulator: STEG residential tariff for any monthly consumption."""
    try:
        kwh = max(0.0, min(5000.0, float(request.GET.get("kwh", 150))))
        kva = max(1, min(100, int(request.GET.get("kva", 4))))
    except ValueError:
        raise ApiError("Invalid value")
    return learn.bill_with_bands(kwh, kva)


@api()
def terms_view(request):
    return {"version": terms.VERSION, "updated": terms.UPDATED, "sections": terms.SECTIONS}
