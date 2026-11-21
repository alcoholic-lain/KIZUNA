from django.db import models


class Mesure(models.Model):
    adaptateur_id = models.CharField(max_length=9)
    horodatage = models.DateTimeField()
    watts = models.FloatField()
    source = models.CharField(max_length=7)

    class Meta:
        db_table = "mesures"
        constraints = [
            models.UniqueConstraint(
                fields=["adaptateur_id", "horodatage"], name="mesure_adaptateur_instant"
            )
        ]
