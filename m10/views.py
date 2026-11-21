from django.conf import settings
from django.shortcuts import render
from django.utils.http import url_has_allowed_host_and_scheme


def index(request):
    """Sign-in page: Google login, account status and the way to the back office."""
    next_url = request.GET.get("next", "")
    if not url_has_allowed_host_and_scheme(next_url, allowed_hosts={request.get_host()}):
        next_url = ""
    return render(
        request,
        "m10/index.html",
        {
            "next": next_url,
            "google_ready": settings.GOOGLE_LOGIN_CONFIGURED,
        },
    )
