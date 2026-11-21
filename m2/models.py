"""Mieruka data model, following the frozen contract in k-mod/mieruka-03-data.md.

Table names match the contract (utilisateurs, adaptateurs, appareils, mesures,
alertes, recompenses). Times are stored in UTC.
"""

from django.conf import settings
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models

ADAPTER_ID_PATTERN = r"^MIERUKA-\d{4}$"


class Utilisateur(models.Model):
    """A household. Login accounts arrive with M10; `compte` links one when it exists."""

    class TypeLogement(models.TextChoices):
        APPARTEMENT = "appartement", "Appartement"
        MAISON = "maison", "Maison"

    class Region(models.TextChoices):
        TUNIS = "tunis", "Tunis"
        SFAX = "sfax", "Sfax"
        KAIROUAN = "kairouan", "Kairouan"
        TOZEUR = "tozeur", "Tozeur"

    nom = models.CharField(max_length=120)
    nb_personnes = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    type_logement = models.CharField(max_length=20, choices=TypeLogement.choices)
    region = models.CharField(max_length=20, choices=Region.choices)
    compte = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="foyer",
    )
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "utilisateurs"
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class Appareil(models.Model):
    nom = models.CharField(max_length=80)
    type = models.CharField(max_length=40)
    puissance_nominale_w = models.PositiveIntegerField()

    class Meta:
        db_table = "appareils"
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class Adaptateur(models.Model):
    class Statut(models.TextChoices):
        ACTIF = "actif", "Actif"
        HORS_LIGNE = "hors_ligne", "Hors ligne"
        NON_ASSOCIE = "non_associe", "Non associé"

    id = models.CharField(
        primary_key=True,
        max_length=12,
        validators=[RegexValidator(ADAPTER_ID_PATTERN, "Format attendu : MIERUKA-xxxx.")],
    )
    utilisateur = models.ForeignKey(
        Utilisateur,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="adaptateurs",
    )
    appareil = models.ForeignKey(
        Appareil,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="adaptateurs",
    )
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.NON_ASSOCIE)
    derniere_mesure = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "adaptateurs"
        ordering = ["id"]

    def __str__(self):
        return self.id


class Mesure(models.Model):
    class Source(models.TextChoices):
        SIMULEE = "simulee", "Simulée"
        REELLE = "reelle", "Réelle"

    adaptateur = models.ForeignKey(Adaptateur, on_delete=models.CASCADE, related_name="mesures")
    horodatage = models.DateTimeField()
    watts = models.FloatField(validators=[MinValueValidator(0)])
    source = models.CharField(max_length=10, choices=Source.choices)

    class Meta:
        db_table = "mesures"
        ordering = ["-horodatage"]
        constraints = [
            models.UniqueConstraint(
                fields=["adaptateur", "horodatage"],
                name="mesure_unique_par_adaptateur_horodatage",
            ),
        ]
        indexes = [models.Index(fields=["horodatage"])]

    def __str__(self):
        return f"{self.adaptateur_id} {self.horodatage:%Y-%m-%d %H:%M} {self.watts:.0f} W"


class Alerte(models.Model):
    class Type(models.TextChoices):
        ANOMALIE = "anomalie", "Anomalie"

    adaptateur = models.ForeignKey(Adaptateur, on_delete=models.CASCADE, related_name="alertes")
    horodatage = models.DateTimeField()
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.ANOMALIE)
    explication = models.TextField()
    resolue = models.BooleanField(default=False)

    class Meta:
        db_table = "alertes"
        ordering = ["-horodatage"]

    def __str__(self):
        return f"{self.adaptateur_id} {self.type} {self.horodatage:%Y-%m-%d %H:%M}"


class Recompense(models.Model):
    """Credits: points earned for kWh avoided in one period (formula in M4)."""

    utilisateur = models.ForeignKey(Utilisateur, on_delete=models.CASCADE, related_name="recompenses")
    periode = models.CharField(max_length=7, help_text="Mois, au format AAAA-MM.")
    kwh_evites = models.FloatField(default=0, validators=[MinValueValidator(0)])
    points = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "recompenses"
        ordering = ["-periode", "utilisateur__nom"]
        constraints = [
            models.UniqueConstraint(
                fields=["utilisateur", "periode"],
                name="recompense_unique_par_utilisateur_periode",
            ),
        ]

    def __str__(self):
        return f"{self.utilisateur} {self.periode}: {self.points} pts"
