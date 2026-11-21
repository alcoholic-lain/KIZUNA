"""Fill the database with simulated Mieruka data for demos and the back office.

Everything created here is fictional and tagged `simulee`. Run with --reset to
replace earlier demo data.
"""

import math
import random
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from m2.models import Adaptateur, Alerte, Appareil, Mesure, Recompense, Utilisateur

POINTS_PER_KWH = 500  # same constant as the rewards formula (k-mod/mieruka-05-rewards.md)

APPAREILS = [
    # nom, type, nominal W, hourly usage profile (0-23 → share of nominal)
    ("Réfrigérateur", "froid", 150, [0.45] * 24),
    ("Climatisation", "clim", 900, [0.1] * 7 + [0.15] * 5 + [0.6] * 6 + [0.9] * 4 + [0.4] * 2),
    ("Chauffe-eau", "eau_chaude", 1500, [0.02] * 5 + [0.5, 0.7, 0.4] + [0.05] * 10 + [0.3, 0.4] + [0.05] * 4),
    ("Télévision", "multimedia", 110, [0.0] * 7 + [0.2] * 5 + [0.3] * 6 + [0.9] * 5 + [0.2]),
    ("Machine à laver", "lavage", 2000, [0.0] * 9 + [0.25, 0.3, 0.1] + [0.0] * 6 + [0.2, 0.15] + [0.0] * 4),
    ("Éclairage", "eclairage", 120, [0.05] * 6 + [0.3] + [0.05] * 11 + [0.6, 0.9, 0.9, 0.8, 0.4, 0.1]),
]

REGIONS = [("tunis", 14), ("sfax", 12), ("kairouan", 10), ("tozeur", 8)]

FAMILLES = [
    "Ben Ali", "Trabelsi", "Jaziri", "Mansouri", "Gharbi", "Hammami", "Bouazizi", "Chaabane",
    "Mejri", "Ayari", "Khelifi", "Sassi", "Baccouche", "Ferchichi", "Haddad", "Karoui",
    "Laabidi", "Marzouki", "Nasri", "Ouertani", "Riahi", "Saidi", "Tlili", "Zouari",
]

PRENOMS = [
    "Amel", "Sami", "Leila", "Karim", "Nour", "Youssef", "Ines", "Hedi", "Salma", "Walid",
    "Mariem", "Anis", "Rania", "Omar", "Sarra", "Fares",
]

EXPLICATION = (
    "{appareil} consomme {pct} % de plus que sa médiane habituelle à cette heure "
    "depuis {n} mesures consécutives. {conseil}"
)

CONSEILS = {
    "froid": "Vérifiez que la porte ferme bien et que le thermostat n'est pas au maximum.",
    "clim": "Remontez la consigne à 26 °C et fermez les fenêtres de la pièce.",
    "eau_chaude": "Baissez la température du chauffe-eau à 55 °C.",
    "multimedia": "Éteignez l'appareil au lieu de le laisser en veille.",
    "lavage": "Lancez un cycle à 30 °C et à pleine charge.",
    "eclairage": "Éteignez les pièces inoccupées ou passez aux LED.",
}


class Command(BaseCommand):
    help = "Create simulated households, adapters, readings, alerts and rewards (all labelled simulated)."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete existing data first.")
        parser.add_argument(
            "--if-empty", action="store_true", help="Do nothing when data already exists (safe in deploys)."
        )
        parser.add_argument("--hours", type=int, default=24, help="Hours of readings to generate.")
        parser.add_argument("--step", type=int, default=15, help="Minutes between readings.")
        parser.add_argument("--seed", type=int, default=2026)

    def handle(self, *args, reset, if_empty, hours, step, seed, **options):
        if hours < 1 or step < 1:
            raise CommandError("--hours and --step must be positive.")
        if if_empty and Utilisateur.objects.exists():
            if options["verbosity"] >= 1:
                self.stdout.write("Data already exists; nothing to seed.")
            return
        if Utilisateur.objects.exists() and not reset:
            raise CommandError("Data already exists. Re-run with --reset to replace it.")

        rng = random.Random(seed)
        now = timezone.now().replace(second=0, microsecond=0)
        now -= timedelta(minutes=now.minute % step)
        start = now - timedelta(hours=hours)

        with transaction.atomic():
            if reset:
                for model in (Mesure, Alerte, Recompense, Adaptateur, Appareil, Utilisateur):
                    model.objects.all().delete()

            appareils = [
                Appareil.objects.create(nom=nom, type=type_, puissance_nominale_w=w)
                for nom, type_, w, _ in APPAREILS
            ]
            profils = {a.pk: APPAREILS[i][3] for i, a in enumerate(appareils)}

            noms = rng.sample([f"{f} {p}" for f in FAMILLES for p in PRENOMS], sum(c for _, c in REGIONS))
            foyers = []
            for region, count in REGIONS:
                for _ in range(count):
                    foyers.append(
                        Utilisateur.objects.create(
                            nom=f"Foyer {noms.pop()}",
                            nb_personnes=rng.randint(1, 6),
                            type_logement=rng.choice(["appartement", "maison"]),
                            region=region,
                        )
                    )

            adaptateurs, numero = [], 1
            for foyer in foyers:
                for appareil in rng.sample(appareils, rng.randint(2, 4)):
                    statut = "hors_ligne" if rng.random() < 0.08 else "actif"
                    adaptateurs.append(
                        Adaptateur(
                            id=f"MIERUKA-{numero:04d}",
                            utilisateur=foyer,
                            appareil=appareil,
                            statut=statut,
                        )
                    )
                    numero += 1
            for _ in range(6):  # spare adapters waiting in stock
                adaptateurs.append(Adaptateur(id=f"MIERUKA-{numero:04d}", statut="non_associe"))
                numero += 1
            Adaptateur.objects.bulk_create(adaptateurs)

            mesures, alertes = [], []
            steps = hours * 60 // step
            for adaptateur in adaptateurs:
                if adaptateur.appareil is None:
                    continue
                nominal = adaptateur.appareil.puissance_nominale_w
                profil = profils[adaptateur.appareil.pk]
                # offline adapters stopped reporting a few hours ago
                stop = steps - (rng.randint(3, 8) * 60 // step) if adaptateur.statut == "hors_ligne" else steps
                # ~12% of active adapters drift during the last two hours
                derive = adaptateur.statut == "actif" and rng.random() < 0.12
                derive_depuis = steps - (120 // step)
                derniere = None
                for i in range(stop + 1):
                    t = start + timedelta(minutes=i * step)
                    heure_locale = (t.hour + 1) % 24  # Africa/Tunis is UTC+1
                    base = nominal * profil[heure_locale]
                    watts = max(0.0, base * rng.uniform(0.8, 1.2) + rng.uniform(0, 4))
                    if derive and i >= derive_depuis:
                        watts = max(watts * 1.6, nominal * 0.5)
                    mesures.append(
                        Mesure(adaptateur=adaptateur, horodatage=t, watts=round(watts, 1), source="simulee")
                    )
                    derniere = t
                adaptateur.derniere_mesure = derniere
                if derive:
                    alertes.append(
                        Alerte(
                            adaptateur=adaptateur,
                            horodatage=start + timedelta(minutes=(derive_depuis + 3) * step),
                            explication=EXPLICATION.format(
                                appareil=adaptateur.appareil.nom, pct=60, n=3,
                                conseil=CONSEILS[adaptateur.appareil.type],
                            ),
                        )
                    )
            Mesure.objects.bulk_create(mesures, batch_size=1000)
            Adaptateur.objects.bulk_update(adaptateurs, ["derniere_mesure"], batch_size=500)

            # a few older alerts that households already resolved
            actifs = [a for a in adaptateurs if a.statut == "actif"]
            for adaptateur in rng.sample(actifs, min(10, len(actifs))):
                alertes.append(
                    Alerte(
                        adaptateur=adaptateur,
                        horodatage=start - timedelta(days=rng.randint(1, 20)),
                        explication=EXPLICATION.format(
                            appareil=adaptateur.appareil.nom, pct=rng.randint(40, 90), n=3,
                            conseil=CONSEILS[adaptateur.appareil.type],
                        ),
                        resolue=True,
                    )
                )
            Alerte.objects.bulk_create(alertes)

            recompenses = []
            for foyer in foyers:
                for mois in range(3):
                    annee, m = now.year, now.month - mois
                    while m < 1:
                        m += 12
                        annee -= 1
                    kwh = round(max(0.0, rng.gauss(6, 4)), 2)
                    recompenses.append(
                        Recompense(
                            utilisateur=foyer,
                            periode=f"{annee}-{m:02d}",
                            kwh_evites=kwh,
                            points=math.floor(kwh * POINTS_PER_KWH),
                        )
                    )
            Recompense.objects.bulk_create(recompenses)

        if options["verbosity"] < 1:
            return
        self.stdout.write(
            self.style.SUCCESS(
                f"Simulated data: {len(foyers)} households, {len(adaptateurs)} adapters, "
                f"{len(mesures)} readings, {len(alertes)} alerts, {len(recompenses)} reward rows."
            )
        )
