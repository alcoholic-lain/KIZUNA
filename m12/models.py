"""Mieruka data model (module M2).

The database stores facts, not time series:
* who owns which adapter (Installation, with start and end),
* what happened (Event: anomaly, applied fix, measurement pause...),
* what the platform concluded (Alert, SavingAction, TokenTx...).

Energy figures are computed on demand from the appliance model in ``m1.model``
for simulated adapters, and from ``Reading`` rows for real adapters. This keeps
the database small and the app deployable on a serverless host.
"""
from django.conf import settings
from django.db import models

SOURCE_CHOICES = [("simulee", "Simulée"), ("reelle", "Réelle")]


class Region(models.Model):
    code = models.SlugField(unique=True)
    name = models.CharField(max_length=60)
    lat = models.FloatField()
    lon = models.FloatField()

    def __str__(self):
        return self.name


class Building(models.Model):
    KIND_CHOICES = [("residentiel", "Résidentiel"), ("entreprise", "Entreprise"), ("campus", "Résidence universitaire")]
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=80)
    district = models.CharField(max_length=80)
    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name="buildings")
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default="residentiel")
    meter_id = models.CharField(max_length=30)
    lat = models.FloatField()
    lon = models.FloatField()
    common_base_w = models.FloatField(default=300)
    common_fault_since = models.DateTimeField(null=True, blank=True)
    solar_kwc = models.FloatField(default=0)

    def __str__(self):
        return self.name


class Household(models.Model):
    CATEGORY_CHOICES = [("foyer", "Foyer"), ("etudiant", "Étudiant"), ("famille", "Famille"), ("entreprise", "Entreprise")]
    code = models.CharField(max_length=20, unique=True)
    building = models.ForeignKey(Building, on_delete=models.CASCADE, related_name="households")
    label = models.CharField(max_length=80)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="foyer")
    occupants = models.PositiveSmallIntegerField(default=2)
    housing_type = models.CharField(max_length=20, default="appartement")
    subscribed_kva = models.PositiveSmallIntegerField(default=4)
    monthly_goal_kwh = models.FloatField(default=180)
    is_live = models.BooleanField(default=False)
    unmonitored_base_w = models.FloatField(default=60)

    def __str__(self):
        return self.code


class Profile(models.Model):
    ROLE_CHOICES = [("foyer", "Foyer"), ("etudiant", "Étudiant"), ("famille", "Famille"), ("entreprise", "Entreprise"), ("steg", "STEG")]
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="foyer")
    household = models.ForeignKey(Household, null=True, blank=True, on_delete=models.SET_NULL, related_name="members")
    display_name = models.CharField(max_length=80)
    city = models.CharField(max_length=60, default="Tunis")
    onboarded = models.BooleanField(default=False)
    is_demo = models.BooleanField(default=False)
    terms_version = models.CharField(max_length=20, blank=True, default="")
    terms_accepted_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.display_name


class Adapter(models.Model):
    """A physical adapter, identified by the ID printed in its QR code."""

    id = models.CharField(primary_key=True, max_length=12)
    seed = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.id


class Installation(models.Model):
    """An adapter plugged on one appliance of one household, for a period."""

    adapter = models.ForeignKey(Adapter, on_delete=models.CASCADE, related_name="installations")
    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="installations")
    name = models.CharField(max_length=60)
    category = models.CharField(max_length=30)
    room = models.CharField(max_length=40, blank=True)
    usage_scale = models.FloatField(default=1.0)
    year = models.PositiveSmallIntegerField(null=True, blank=True)
    start = models.DateTimeField()
    end = models.DateTimeField(null=True, blank=True)
    monitoring = models.BooleanField(default=True)

    class Meta:
        ordering = ["adapter_id"]
        indexes = [models.Index(fields=["household", "end"])]


class Event(models.Model):
    KIND_CHOICES = [
        ("anomaly", "Anomalie"),        # data.type: surcharge | pic | veille
        ("efficiency", "Réglage"),      # factor < 1 from start
        ("standby_cut", "Veille coupée"),
        ("forced_on", "Appareil laissé allumé"),
        ("pause", "Mesure en pause"),
    ]
    installation = models.ForeignKey(Installation, on_delete=models.CASCADE, related_name="events")
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    start = models.DateTimeField()
    end = models.DateTimeField(null=True, blank=True)
    factor = models.FloatField(default=1.0)
    data = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["start"]


class Reading(models.Model):
    """Real measurements posted by hardware (frozen contract)."""

    adapter = models.ForeignKey(Adapter, on_delete=models.CASCADE, related_name="readings")
    ts = models.DateTimeField()
    watts = models.FloatField()
    source = models.CharField(max_length=10, choices=SOURCE_CHOICES, default="reelle")

    class Meta:
        unique_together = [("adapter", "ts")]
        indexes = [models.Index(fields=["adapter", "ts"])]
        ordering = ["ts"]


class Alert(models.Model):
    SEVERITY_CHOICES = [("info", "Info"), ("attention", "Attention"), ("elevee", "Élevée"), ("critique", "Critique")]
    STATUS_CHOICES = [("ouverte", "Ouverte"), ("appliquee", "Corrigée"), ("resolue", "Résolue"), ("ignoree", "Ignorée")]
    household = models.ForeignKey(Household, null=True, blank=True, on_delete=models.CASCADE, related_name="alerts")
    installation = models.ForeignKey(Installation, null=True, blank=True, on_delete=models.SET_NULL, related_name="alerts")
    building = models.ForeignKey(Building, null=True, blank=True, on_delete=models.CASCADE, related_name="alerts")
    kind = models.CharField(max_length=30)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default="attention")
    title = models.CharField(max_length=140)
    cause = models.CharField(max_length=240, blank=True)
    action = models.CharField(max_length=240, blank=True)
    action_code = models.CharField(max_length=30, blank=True)
    detected_at = models.DateTimeField()
    measured = models.FloatField(null=True, blank=True)
    expected = models.FloatField(null=True, blank=True)
    unit = models.CharField(max_length=6, default="W")
    confidence = models.FloatField(default=0.7)
    evidence = models.JSONField(default=dict, blank=True)
    kwh_month = models.FloatField(default=0)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="ouverte")
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.CharField(max_length=20, blank=True)

    class Meta:
        ordering = ["-detected_at"]


class SavingAction(models.Model):
    """An applied recommendation. Savings are computed against ``reference_w``."""

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="actions")
    installation = models.ForeignKey(Installation, null=True, blank=True, on_delete=models.SET_NULL)
    alert = models.ForeignKey(Alert, null=True, blank=True, on_delete=models.SET_NULL)
    code = models.CharField(max_length=30)
    title = models.CharField(max_length=140)
    applied_at = models.DateTimeField()
    reference_w = models.FloatField(default=0)
    mode = models.CharField(max_length=10, default="actif")  # actif | veille
    window_hours = models.PositiveSmallIntegerField(default=24)

    class Meta:
        ordering = ["-applied_at"]


class TokenTx(models.Model):
    KIND_CHOICES = [("defi", "Défi"), ("education", "Apprentissage"), ("communaute", "Action collective"),
                    ("depense", "Récompense"), ("don", "Don solidaire"), ("economie", "Économie vérifiée")]
    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="tokens")
    ts = models.DateTimeField()
    amount = models.IntegerField()
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    label = models.CharField(max_length=140)

    class Meta:
        ordering = ["-ts", "-id"]


class ChallengeEntry(models.Model):
    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="challenges")
    code = models.CharField(max_length=30)
    completed_at = models.DateTimeField()

    class Meta:
        unique_together = [("household", "code")]


class SolidarityProject(models.Model):
    KIND_CHOICES = [("credit", "Crédits d'électricité"), ("equipement", "Équipement efficace"), ("rural", "Énergie rurale")]
    code = models.CharField(max_length=20, unique=True)
    title = models.CharField(max_length=120)
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    region = models.ForeignKey(Region, on_delete=models.CASCADE)
    partner = models.CharField(max_length=120)
    goal_tnd = models.FloatField()
    unit_cost_tnd = models.FloatField()

    class Meta:
        ordering = ["code"]


class Contribution(models.Model):
    project = models.ForeignKey(SolidarityProject, on_delete=models.CASCADE, related_name="contributions")
    household = models.ForeignKey(Household, null=True, blank=True, on_delete=models.SET_NULL)
    contributor = models.CharField(max_length=120)
    tokens = models.PositiveIntegerField(default=0)
    amount_tnd = models.FloatField(default=0)
    ts = models.DateTimeField()

    class Meta:
        ordering = ["-ts"]


class LearningProgress(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="learning")
    item = models.CharField(max_length=40)
    score = models.PositiveSmallIntegerField(default=0)

    class Meta:
        unique_together = [("user", "item")]


class SimState(models.Model):
    """Demo clock offset (minutes added to real time) and dataset version."""

    offset_minutes = models.IntegerField(default=0)
    version = models.PositiveIntegerField(default=1)
    seeded_at = models.DateTimeField()

    @classmethod
    def get(cls):
        return cls.objects.get(pk=1)
