#!/usr/bin/env python3
"""Add a new simulated device (named LAC-xxx) on a random building: a simulated phone scan.
No keys needed.   python new_device.py        [--web https://kizuna-temp.vercel.app]
It becomes the device run_all.py reports as (saved in data/device.json) and shows on the STEG map."""
import argparse, json, os, sys, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument("--web", default=os.environ.get("MIERUKA_WEB", "https://kizuna-temp.vercel.app"))
web = ap.parse_args().web.rstrip("/")
KEY = os.environ.get("MIERUKA_ADAPTER_KEY", "")  # only needed while the web app has a key configured
try:
    req = urllib.request.Request(web + "/api/atlas/provision", b"{}",
                                 {"Content-Type": "application/json", **({"X-Adapter-Key": KEY} if KEY else {})}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        dev = json.loads(r.read())
except urllib.error.HTTPError as e:
    sys.exit(f"refused: HTTP {e.code} {e.read()[:200]!r}")
except (OSError, ValueError) as e:
    sys.exit(f"cannot reach {web}: {e}")
os.makedirs(os.path.join(HERE, "data"), exist_ok=True)
with open(os.path.join(HERE, "data", "device.json"), "w", encoding="utf-8") as f:
    json.dump(dev, f)
print(f"new device {dev['name']} ({dev['id']}) on a building in {dev['city']}  ({dev['latitude']:.5f}, {dev['longitude']:.5f})")
print("now run:  uv run run_all.py   - it reports as this device")
