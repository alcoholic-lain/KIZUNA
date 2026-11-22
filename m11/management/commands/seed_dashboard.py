from django.core.management.base import BaseCommand

from m11.seed import seed_dashboard


class Command(BaseCommand):
    help = "Restore simulated households and buildings when the backoffice network is empty."

    def handle(self, **options):
        if seed_dashboard():
            self.stdout.write(self.style.SUCCESS("Seeded the simulated backoffice network."))
        else:
            self.stdout.write("Backoffice network already exists; nothing to seed.")
