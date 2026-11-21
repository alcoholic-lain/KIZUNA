from django.urls import path

from . import views

app_name = "m11"

urlpatterns = [
    path("", views.index, name="index"),
]
