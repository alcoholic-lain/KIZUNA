from django.urls import path

from . import views

app_name = "m5"

urlpatterns = [
    path("", views.index, name="index"),
    path("devices/", views.devices, name="devices"),
    path("users/", views.users, name="users"),
    path("users/<int:pk>/", views.user_detail, name="user_detail"),
    path("alerts/", views.alerts, name="alerts"),
    path("credits/", views.credits, name="credits"),
]
