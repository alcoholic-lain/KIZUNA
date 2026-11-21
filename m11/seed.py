"""Demo dataset (module M1). Small: energy is computed, not stored.

Cities are real; buildings, households, companies and associations are fictional.
"""
import random
from datetime import datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from m12.models import (
    Adapter, Alert, Building, ChallengeEntry, Contribution, Event, Household, Installation, LearningProgress, Profile,
    Reading, Region, SavingAction, SimState, SolidarityProject, TokenTx,
)

from .profiles import TN, cat

DEMO_PASSWORD = "mieruka2026"

REGIONS = [
    ("tunis", "Grand Tunis", 36.8065, 10.1815), ("sfax", "Sfax", 34.7406, 10.7603), ("sousse", "Sousse", 35.8256, 10.6084),
    ("kairouan", "Kairouan", 35.6781, 10.0963), ("gabes", "Gabès", 33.8815, 10.0982), ("tozeur", "Tozeur", 33.9197, 8.1335),
]
# code, name, district, region, kind, background households, common W, solar kWc
BUILDINGS = [
    ("BAT-TUN-01", "Résidence Les Jasmins", "El Menzah 6", "tunis", "residentiel", 9, 350, 6.0),
    ("BAT-TUN-02", "Immeuble Ennasr Horizon", "Ennasr 2", "tunis", "residentiel", 8, 300, 0),
    ("BAT-TUN-03", "Carthage Textile", "Z.I. Ben Arous", "tunis", "entreprise", 0, 1100, 15.0),
    ("BAT-SFX-01", "Îlot El Bousten", "Route de Tunis km 4", "sfax", "residentiel", 7, 120, 0),
    ("BAT-SFX-02", "Résidence Thyna", "Sfax Ville", "sfax", "residentiel", 6, 300, 0),
    ("BAT-SOU-01", "Foyer universitaire Sahloul", "Sahloul", "sousse", "campus", 9, 600, 8.0),
    ("BAT-SOU-02", "Résidence Khezama", "Khezama Est", "sousse", "residentiel", 6, 300, 0),
    ("BAT-KAI-01", "Résidence Ibn Khaldoun", "Centre-ville", "kairouan", "residentiel", 7, 250, 0),
    ("BAT-KAI-02", "Cité Ennour", "Cité Ennour", "kairouan", "residentiel", 5, 180, 0),
    ("BAT-GAB-01", "Résidence de l'Oasis", "Gabès Médina", "gabes", "residentiel", 6, 250, 0),
    ("BAT-GAB-02", "Immeuble Chatt Essalam", "Chatt Essalam", "gabes", "residentiel", 5, 200, 0),
    ("BAT-TOZ-01", "Résidence La Palmeraie", "Tozeur centre", "tozeur", "residentiel", 6, 200, 4.0),
]
FAULT_BUILDING = "BAT-TUN-02"

DEMO_ACCOUNTS = {
    "foyer": dict(username="amira", email="amira@demo.mieruka.tn", name="Amira Ben Salah", city="Tunis"),
    "etudiant": dict(username="youssef", email="youssef@demo.mieruka.tn", name="Youssef Trabelsi", city="Sousse"),
    "famille": dict(username="leila", email="leila@demo.mieruka.tn", name="Famille Gharbi", city="Sfax"),
    "entreprise": dict(username="carthage", email="energie@demo.carthage-textile.tn", name="Carthage Textile", city="Ben Arous"),
    "steg": dict(username="steg", email="analyste@demo.steg.tn", name="Analyste STEG", city="Tunis"),
}
# role -> building, label, category, occupants, housing, kVA, goal, unmonitored W, installations
LIVE = {
    "foyer": ("BAT-TUN-01", "Foyer Ben Salah", "foyer", 3, "appartement", 4, 200, 70, [
        ("NABD-0001", "refrigerateur", "Réfrigérateur", "Cuisine", 1.0, 2011),
        ("NABD-0002", "climatisation", "Climatiseur salon", "Salon", 1.0, 2017),
        ("NABD-0006", "television", "TV + décodeur", "Salon", 1.0, 2019),
        ("NABD-0007", "chauffe_eau", "Chauffe-eau", "Salle de bain", 1.0, 2015),
        ("NABD-0008", "chargeur", "Chargeur", "Chambre", 1.0, 2023),
    ]),
    "etudiant": ("BAT-SOU-01", "Studio de Youssef", "etudiant", 1, "studio", 2, 80, 25, [
        ("NABD-2001", "ordinateur", "PC portable", "Bureau", 1.5, 2022),
        ("NABD-2002", "refrigerateur", "Mini-frigo", "Kitchenette", 0.8, 2018),
        ("NABD-2003", "radiateur", "Radiateur", "Chambre", 0.7, 2014),
        ("NABD-2004", "chargeur", "Chargeur", "Chambre", 1.0, 2024),
        ("NABD-2005", "console", "Console", "Chambre", 1.2, 2021),
    ]),
    "famille": ("BAT-SFX-01", "Famille Gharbi", "famille", 5, "maison", 6, 330, 140, [
        ("NABD-3001", "refrigerateur", "Réfrigérateur", "Cuisine", 1.0, 2016),
        ("NABD-3002", "climatisation", "Climatiseur séjour", "Séjour", 1.2, 2019),
        ("NABD-3003", "television", "Télévision", "Séjour", 1.0, 2020),
        ("NABD-3004", "machine_a_laver", "Lave-linge", "Buanderie", 1.3, 2018),
        ("NABD-3005", "four", "Four", "Cuisine", 1.0, 2013),
        ("NABD-3006", "chauffe_eau", "Chauffe-eau", "Salle de bain", 1.2, 2012),
    ]),
    "entreprise": ("BAT-TUN-03", "Carthage Textile", "entreprise", 24, "atelier", 36, 2100, 600, [
        ("NABD-5001", "compresseur", "Compresseur d'air", "Atelier", 1.0, 2010),
        ("NABD-5002", "machine_industrielle", "Ligne de couture", "Atelier", 1.0, 2019),
        ("NABD-5003", "eclairage_pro", "Éclairage atelier", "Atelier", 1.0, 2021),
        ("NABD-5004", "serveurs", "Serveurs", "Salle serveurs", 1.0, 2020),
    ]),
}
STOCK = ["NABD-0003", "NABD-0004", "NABD-0005", "NABD-0009", "NABD-0010", "NABD-0011", "NABD-0012"]

PROJECTS = [
    ("SP-01", "Crédits d'hiver pour 40 familles", "credit", "kairouan", "Association Nour Énergie (fictive)", 4000, 100),
    ("SP-02", "Réfrigérateurs efficaces pour 20 familles", "equipement", "gabes", "Oasis Solidaire (fictive)", 12000, 600),
    ("SP-03", "Kits solaires pour une école rurale", "rural", "tozeur", "Soleil du Djérid (fictive)", 9000, 45),
    ("SP-04", "Éclairage LED, maison des jeunes", "equipement", "sfax", "Jeunesse Lumière (fictive)", 3000, 30),
]
CONTRIBUTIONS = [("SP-01", "Carthage Textile", 1500, 18), ("SP-02", "Carthage Textile", 2400, 9),
                 ("SP-03", "Medina Logistique (fictive)", 2000, 14), ("SP-01", "Atlas Agro (fictive)", 1200, 6),
                 ("SP-04", "Sahel Digital (fictive)", 900, 4), ("SP-02", "Atlas Agro (fictive)", 1800, 2)]


def _bg_appliances(rng, kind, region):
    if kind == "campus":
        return ["refrigerateur", "ordinateur", "chargeur"] + (["radiateur"] if rng.random() < 0.5 else [])
    cats = ["refrigerateur"]
    for c, p in [("television", 0.8), ("climatisation", 0.6), ("chauffe_eau", 0.4), ("ordinateur", 0.45),
                 ("machine_a_laver", 0.35), ("four", 0.25), ("radiateur", 0.45 if region in ("kairouan", "tozeur") else 0.2),
                 ("console", 0.15)]:
        if rng.random() < p and len(cats) < 5:
            cats.append(c)
    return cats if len(cats) >= 3 else cats + ["television"]


def code_for(n):
    return f"FY-{(n * 7919 + 4099) % 0xFFFF:04X}"


@transaction.atomic
def reset_demo():
    rng = random.Random(2026)
    now = timezone.now()
    version = (SimState.objects.filter(pk=1).values_list("version", flat=True).first() or 0) + 1
    for model in (Reading, Event, SavingAction, Alert, TokenTx, ChallengeEntry, Contribution, SolidarityProject,
                  LearningProgress, Installation, Adapter):
        model.objects.all().delete()
    Profile.objects.update(household=None)
    Household.objects.all().delete()
    Building.objects.all().delete()
    Region.objects.all().delete()
    SimState.objects.all().delete()
    SimState.objects.create(pk=1, offset_minutes=0, version=version, seeded_at=now)

    regions = {c: Region.objects.create(code=c, name=n, lat=la, lon=lo) for c, n, la, lo in REGIONS}
    buildings = {}
    for i, (code, name, district, reg, kind, _, common, solar) in enumerate(BUILDINGS):
        r = regions[reg]
        buildings[code] = Building.objects.create(
            code=code, name=name, district=district, region=r, kind=kind, meter_id=f"CPT-{reg[:3].upper()}-{4100 + i * 37}",
            lat=r.lat + rng.uniform(-0.04, 0.04), lon=r.lon + rng.uniform(-0.04, 0.04), common_base_w=common, solar_kwc=solar,
            common_fault_since=now - timedelta(days=3, hours=4) if code == FAULT_BUILDING else None,
        )

    counter = [0]

    def new_household(**kw):
        counter[0] += 1
        return Household(code=code_for(counter[0]), **kw)

    adapters, installs, households = [], [], []
    live = {}
    for role, (bcode, label, category, occ, housing, kva, goal, unmon, devs) in LIVE.items():
        hh = new_household(building=buildings[bcode], label=label, category=category, occupants=occ, housing_type=housing,
                           subscribed_kva=kva, monthly_goal_kwh=goal, is_live=True, unmonitored_base_w=unmon)
        hh.save()
        live[role] = hh
        for j, (aid, c, name, room, scale, year) in enumerate(devs):
            adapters.append(Adapter(id=aid, seed=1000 + j * 31 + len(adapters) * 17))
            installs.append(Installation(adapter_id=aid, household=hh, name=name, category=c, room=room, usage_scale=scale,
                                         year=year, start=now - timedelta(days=120 + j)))
    for code, (_, _, _, reg, kind, n_bg, _, _) in zip(buildings, BUILDINGS):
        for k in range(n_bg):
            occ = 1 if kind == "campus" else rng.choice([1, 2, 2, 3, 3, 4, 4, 5, 6])
            households.append(new_household(
                building=buildings[code], label=f"Foyer {k + 1}",
                category="etudiant" if kind == "campus" else ("famille" if occ >= 4 else "foyer"),
                occupants=occ, housing_type="studio" if kind == "campus" else "appartement",
                subscribed_kva=2 if occ <= 2 else 4, monthly_goal_kwh=55 + 32 * occ, unmonitored_base_w=35 + 22 * occ))
    Household.objects.bulk_create(households)
    serial = 1000
    for hh in Household.objects.filter(is_live=False).select_related("building__region").order_by("id"):
        for c in _bg_appliances(rng, hh.building.kind, hh.building.region.code):
            serial += 1
            aid = f"NABD-{serial}"
            adapters.append(Adapter(id=aid, seed=rng.randint(1, 10 ** 6)))
            installs.append(Installation(adapter_id=aid, household=hh, name=cat(c)["label"], category=c, room=cat(c)["room"],
                                         usage_scale=round(rng.uniform(0.7, 1.3) * (0.85 + 0.06 * hh.occupants), 2),
                                         year=rng.randint(2006, 2024), start=now - timedelta(days=rng.randint(40, 200))))
    adapters += [Adapter(id=aid, seed=500 + i * 97) for i, aid in enumerate(STOCK)]
    Adapter.objects.bulk_create(adapters)
    Installation.objects.bulk_create(installs)

    _history(rng, now, live)
    _accounts(live)
    return now


def _accounts(live):
    User = get_user_model()
    for role, acc in DEMO_ACCOUNTS.items():
        user, created = User.objects.get_or_create(username=acc["username"], defaults={"email": acc["email"]})
        if created or not user.has_usable_password():
            user.set_password(DEMO_PASSWORD)
        user.email = acc["email"]
        user.save()
        Profile.objects.update_or_create(user=user, defaults=dict(
            role=role, household=live.get(role), display_name=acc["name"], city=acc["city"], onboarded=True, is_demo=True))
    for p in Profile.objects.filter(is_demo=False, household__isnull=True).exclude(role="steg"):
        p.household = create_household_for(p)
        p.save(update_fields=["household"])


def create_household_for(profile):
    region = {"sfax": "sfax", "sousse": "sousse", "monastir": "sousse", "kairouan": "kairouan", "gabès": "gabes",
              "gabes": "gabes", "tozeur": "tozeur"}.get((profile.city or "").strip().lower(), "tunis")
    building = Building.objects.filter(region__code=region, kind="residentiel").exclude(code="BAT-TUN-01").first() \
        or Building.objects.filter(kind="residentiel").first()
    return Household.objects.create(
        code=code_for(Household.objects.count() + 500), building=building, label=profile.display_name,
        category=profile.role if profile.role in ("foyer", "etudiant", "famille", "entreprise") else "foyer",
        occupants=2, monthly_goal_kwh=150, is_live=True, unmonitored_base_w=60,
    )


def _history(rng, now, live):
    def ago(days, hour=None):
        lt = (now - timedelta(days=days)).astimezone(TN)
        return datetime.combine(lt.date(), time(hour if hour is not None else rng.randint(8, 21), rng.randint(0, 59)), tzinfo=TN)

    amira = live["foyer"]
    fridge = Installation.objects.get(adapter_id="NABD-0001")
    Event.objects.create(installation=fridge, kind="anomaly", start=ago(12, 9), end=ago(10, 18), factor=1.45, data={"type": "surcharge"})
    al = Alert.objects.create(
        household=amira, installation=fridge, building=amira.building, kind="surconsommation", severity="elevee",
        title="Réfrigérateur +45 %", cause="Joint de porte usé", action="Remplacer le joint", action_code="verifier_appareil",
        detected_at=ago(12, 9), measured=181, expected=125, confidence=0.88, kwh_month=16.7, status="appliquee",
        resolved_at=ago(10, 18), resolved_by="utilisateur", evidence={"rule": "+35 % sur 3 mesures"},
    )
    SavingAction.objects.create(household=amira, installation=fridge, alert=al, code="verifier_appareil",
                                title="Joint du réfrigérateur remplacé", applied_at=ago(10, 18), reference_w=181)
    plan = {
        "foyer": [(9, 50, "defi", "Soirée douce"), (6, 15, "education", "Quiz : vampires d'énergie"),
                  (3, 80, "defi", "Journée sous ma référence"), (2, -100, "don", "Don : crédits d'hiver Kairouan")],
        "etudiant": [(8, 60, "defi", "Nuit sans veille"), (1, 100, "communaute", "Défi d'immeuble Sahloul")],
        "famille": [(7, 50, "defi", "Soirée douce"), (5, -300, "depense", "Bon LED partenaire"), (2, 80, "defi", "Journée sous ma référence")],
        "entreprise": [(6, 120, "defi", "Atelier hors pointe")],
    }
    for role, items in plan.items():
        TokenTx.objects.bulk_create([TokenTx(household=live[role], ts=ago(d), amount=a, kind=k, label=l) for d, a, k, l in items])
    ChallengeEntry.objects.create(household=amira, code="soiree-douce", completed_at=ago(9))

    regions = {r.code: r for r in Region.objects.all()}
    projects = {}
    for code, title, kind, reg, partner, goal, unit in PROJECTS:
        projects[code] = SolidarityProject.objects.create(code=code, title=title, kind=kind, region=regions[reg],
                                                          partner=partner, goal_tnd=goal, unit_cost_tnd=unit)
    for code, who, amount, days in CONTRIBUTIONS:
        Contribution.objects.create(project=projects[code], contributor=who, amount_tnd=amount, ts=ago(days, 11),
                                    household=live["entreprise"] if who == "Carthage Textile" else None)
    Contribution.objects.create(project=projects["SP-01"], household=amira, contributor="Membre Mieruka", tokens=100, amount_tnd=1, ts=ago(2))

    bg = list(Installation.objects.filter(household__is_live=False).select_related("household__building"))
    kinds = [("surconsommation", "elevee"), ("veille", "info"), ("surconsommation", "attention"), ("simultane", "attention")]
    alerts = []
    for _ in range(32):
        inst = rng.choice(bg)
        kind, sev = rng.choice(kinds)
        base = cat(inst.category)["on_w"]
        d = rng.randint(1, 28)
        alerts.append(Alert(
            household=inst.household, installation=inst, building=inst.household.building, kind=kind, severity=sev,
            title=f"{cat(inst.category)['label']} : {'veille' if kind == 'veille' else 'surconsommation'}",
            cause="Historique", action="Transmis au foyer", detected_at=ago(d),
            measured=round(base * rng.uniform(1.45, 2.0)) if kind != "veille" else round(rng.uniform(6, 18), 1),
            expected=base if kind != "veille" else cat(inst.category)["standby_w"], confidence=round(rng.uniform(0.7, 0.95), 2),
            kwh_month=round(rng.uniform(4, 35), 1), status=rng.choice(["resolue", "appliquee", "appliquee", "ignoree"]),
            resolved_at=ago(max(0, d - 1)), resolved_by=rng.choice(["utilisateur", "auto"]),
        ))
    b = Building.objects.get(code=FAULT_BUILDING)
    alerts.append(Alert(building=b, kind="ecart_compteur", severity="elevee", title="Part non suivie ×3",
                        cause="Équipement commun défaillant (pompe, éclairage)", action="Prévenir le syndic",
                        detected_at=b.common_fault_since + timedelta(hours=20), measured=900, expected=300, confidence=0.74,
                        kwh_month=430, evidence={"rule": "Part non suivie sur 3 jours > moyenne des 14 jours précédents + 40 %"}))
    Alert.objects.bulk_create(alerts)
