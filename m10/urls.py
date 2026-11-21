from django.urls import path

from . import views

app_name = "m10"

urlpatterns = [
    path("", views.index, name="index"),
]
