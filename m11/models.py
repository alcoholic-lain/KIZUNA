from django.conf import settings
from django.db import models


class AtlasLocation(models.Model):
    """Where an adapter really is: the phone GPS fix taken when its QR was scanned.

    Keyed by the adapter ID printed on the QR, so it also covers the simulated
    atlas fleet that has no row in m12.Adapter.
    """

    adapter_id = models.CharField(primary_key=True, max_length=12)
    x = models.FloatField(help_text="Longitude (WGS84)")
    y = models.FloatField(help_text="Latitude (WGS84)")
    z = models.FloatField(null=True, blank=True, help_text="GPS altitude in metres, when the phone gave one")
    accuracy_m = models.FloatField()
    captured_at = models.DateTimeField()
    roof_x = models.FloatField(null=True, blank=True)
    roof_y = models.FloatField(null=True, blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["adapter_id"]

    def __str__(self):
        return f"{self.adapter_id} @ {self.y:.5f}, {self.x:.5f}"
