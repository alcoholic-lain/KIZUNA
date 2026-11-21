from django.urls import path

from . import views

app_name = "mekeru"

urlpatterns = [
    path("google/", views.google_start, name="google"),
]
