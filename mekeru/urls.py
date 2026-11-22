from django.urls import path

from . import views

app_name = "mekeru"

urlpatterns = [
    path("google/", views.google_start, name="google"),
    path("app/return/", views.app_return, name="app_return"),
    path("app/handoff/", views.app_handoff, name="app_handoff"),
]
