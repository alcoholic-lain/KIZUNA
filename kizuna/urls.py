from django.urls import path, re_path

from . import views

app_name = "kizuna"

urlpatterns = [
    path("", views.spa, name="index"),
    re_path(r"^(login|app)(?:/.*)?$", views.spa, name="spa"),
]
