from django.contrib import admin

from .models import Adaptateur, Alerte, Appareil, Mesure, Recompense, Utilisateur


@admin.register(Utilisateur)
class UtilisateurAdmin(admin.ModelAdmin):
    list_display = ("nom", "region", "nb_personnes", "type_logement", "compte")
    list_filter = ("region", "type_logement")
    search_fields = ("nom",)


@admin.register(Appareil)
class AppareilAdmin(admin.ModelAdmin):
    list_display = ("nom", "type", "puissance_nominale_w")


@admin.register(Adaptateur)
class AdaptateurAdmin(admin.ModelAdmin):
    list_display = ("id", "utilisateur", "appareil", "statut", "derniere_mesure")
    list_filter = ("statut",)
    search_fields = ("id", "utilisateur__nom")


@admin.register(Mesure)
class MesureAdmin(admin.ModelAdmin):
    list_display = ("adaptateur", "horodatage", "watts", "source")
    list_filter = ("source",)
    date_hierarchy = "horodatage"


@admin.register(Alerte)
class AlerteAdmin(admin.ModelAdmin):
    list_display = ("adaptateur", "horodatage", "type", "resolue")
    list_filter = ("resolue", "type")


@admin.register(Recompense)
class RecompenseAdmin(admin.ModelAdmin):
    list_display = ("utilisateur", "periode", "kwh_evites", "points")
    list_filter = ("periode",)
