"""Create the first admin account from environment variables, once.

Reads MIERUKA_ADMIN_USERNAME, MIERUKA_ADMIN_EMAIL and MIERUKA_ADMIN_PASSWORD.
Does nothing when they are missing or the user already exists (an existing
password is never changed). Safe to run on every deploy.
"""

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create the admin account from MIERUKA_ADMIN_* environment variables if it does not exist."

    def handle(self, *args, **options):
        username = os.environ.get("MIERUKA_ADMIN_USERNAME", "").strip()
        email = os.environ.get("MIERUKA_ADMIN_EMAIL", "").strip()
        password = os.environ.get("MIERUKA_ADMIN_PASSWORD", "")
        if not (username and password):
            self.stdout.write("MIERUKA_ADMIN_* not set; no admin account created.")
            return
        User = get_user_model()
        if User.objects.filter(username=username).exists():
            self.stdout.write(f"Admin account {username!r} already exists.")
            return
        User.objects.create_superuser(username=username, email=email, password=password)
        self.stdout.write(self.style.SUCCESS(f"Created admin account {username!r}."))
