from django.contrib import admin

from .models import AtlasLocation


@admin.register(AtlasLocation)
class AtlasLocationAdmin(admin.ModelAdmin):
    list_display = ("adapter_id", "y", "x", "z", "accuracy_m", "captured_at", "recorded_by")
    search_fields = ("adapter_id",)
