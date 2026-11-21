from django.shortcuts import redirect


def index(request):
    """The module lives inside the Mieruka web app."""
    return redirect("/app/steg")
