import json
from functools import lru_cache

from django.conf import settings
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie

from .apiutils import ensure_seeded

MANIFEST = settings.BASE_DIR / "assets" / "app" / ".vite" / "manifest.json"


def module_page(request, title, hint):
    """Shared placeholder page used by the reserved modules m1 to m5."""
    return render(
        request,
        "kizuna/module.html",
        {
            "title": title,
            "hint": hint,
        },
    )


MODULE_LINKS = [
    {"label": "M1", "url_name": "m1:index"},
    {"label": "M2", "url_name": "m2:index"},
    {"label": "M3", "url_name": "m3:index"},
    {"label": "M4", "url_name": "m4:index"},
    {"label": "M5", "url_name": "m5:index"},
    {"label": "M10", "url_name": "m10:index"},
]
@lru_cache(maxsize=1)
def _entry(mtime):
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))["index.html"]
    return "app/" + data["file"], ["app/" + c for c in data.get("css", [])]


@ensure_csrf_cookie
def spa(request, *args):
    """Serve the React app (built by Vite into assets/app/)."""
    ensure_seeded()
    js, css = (None, [])
    if MANIFEST.exists():
        js, css = _entry(MANIFEST.stat().st_mtime)
    return render(request, "kizuna/spa.html", {"js_file": js, "css_files": css})
