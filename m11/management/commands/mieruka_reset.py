import time

from django.core.management import BaseCommand

from m11.seed import reset_demo


class Command(BaseCommand):
    help = "Reset the Mieruka demo dataset (demo accounts, installations, events, alerts, tokens)."

    def handle(self, **options):
        started = time.perf_counter()
        reset_demo()
        self.stdout.write(self.style.SUCCESS(f"Mieruka demo dataset ready in {time.perf_counter() - started:.1f} s."))
