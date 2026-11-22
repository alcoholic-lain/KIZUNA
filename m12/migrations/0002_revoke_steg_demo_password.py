"""Revoke the public demo password on the STEG demo account.

Earlier seeds gave the STEG account the same published password as the demo
households, so anyone could open the STEG back office. The account now signs in
only with MIERUKA_STEG_PASSWORD (checked in kizuna.api.do_login).
"""
from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.db import migrations


def revoke(apps, schema_editor):
    User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))
    User.objects.filter(username="steg").update(password=make_password(None))


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("m12", "0001_initial"),
    ]

    operations = [migrations.RunPython(revoke, migrations.RunPython.noop)]
