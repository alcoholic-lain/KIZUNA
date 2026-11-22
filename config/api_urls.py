"""JSON API of the Mieruka web app. Each module owns its endpoints."""
from django.urls import path

from kizuna import api as core
from m11 import api as m1
from m11 import atlas
from m13 import api as m3
from m14 import api as m4
from m15 import api as m5

urlpatterns = [
    path("auth/me", core.me),
    path("auth/login", core.do_login),
    path("auth/demo", core.demo_login),
    path("auth/logout", core.do_logout),
    path("auth/register", core.register),
    path("profile", core.update_profile),
    path("benchmark", core.benchmark),
    path("learn", core.learn_progress),
    path("learn/complete", core.learn_complete),
    path("learn/bill", core.learn_bill),
    path("terms", core.terms_view),
    # M1: live feed, demo controls, adapters, measurement contract
    path("live", m1.live),
    path("sim", m1.sim),
    path("mesures", m1.mesures),
    path("adapters/check", m1.adapter_check),
    path("adapters/registry", m1.registry),
    # M1: energy atlas (Kinto's map) and phone GPS fixes from QR scans
    path("atlas", atlas.atlas),
    path("atlas/registrations", atlas.registrations),
    path("atlas/locate", atlas.locate),
    path("atlas/roof", atlas.roof),
    path("atlas/demo-adapter", atlas.demo_adapter),
    path("atlas/provision", atlas.provision),
    path("atlas/recent", atlas.recent),
    path("atlas/rename", atlas.rename),
    path("atlas/remove", atlas.remove),
    path("atlas/power", atlas.power),
    path("atlas/power/<str:aid>", atlas.power_state),
    path("atlas/device/<str:aid>", atlas.device),
    # M3: AI
    path("ai", m3.analysis),
    path("ai/gemini-live-token", m3.gemini_live_token),
    path("ai/voice-context", m3.voice_context),
    path("alerts/<int:aid>", m3.alert_detail),
    path("alerts/<int:aid>/apply", m3.alert_apply),
    path("alerts/<int:aid>/ignore", m3.alert_ignore),
    path("recommendations/apply", m3.reco_apply),
    # M4: household, rewards, solidarity, company
    path("home", m4.home),
    path("devices", m4.devices),
    path("devices/<int:iid>", m4.device),
    path("history", m4.history),
    path("rewards", m4.rewards_view),
    path("rewards/redeem", m4.redeem),
    path("challenges/<str:code>", m4.challenge),
    path("solidarity", m4.solidarity),
    path("company", m4.company),
    path("flows", m4.flows),
    # M5: STEG
    path("steg/overview", m5.overview),
    path("steg/telemetry", m5.telemetry),
    path("steg/buildings", m5.buildings),
    path("steg/buildings/<str:code>", m5.building),
    path("steg/households/<str:code>", m5.household),
    path("steg/peak", m5.peak),
    path("steg/incidents", m5.incidents),
    path("steg/incidents/<int:aid>/resolve", m5.resolve),
]
