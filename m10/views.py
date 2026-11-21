from kizuna.views import module_page


def index(request):
    return module_page(
        request,
        "M10",
        "User management: Google sign-in (Clerk or FastAPI) is coming here.",
    )
