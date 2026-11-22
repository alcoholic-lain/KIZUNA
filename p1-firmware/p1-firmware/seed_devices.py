#!/usr/bin/env python3
"""Register many simulated devices (LAC-xxx) on random mapped buildings: a bulk simulated scan.
   python seed_devices.py              random 400-1500 devices
   python seed_devices.py --count 800
Set MIERUKA_ADAPTER_KEY if the web app has one. Delete them one by one from the Réseau panel."""
import argparse, json, os, random, sys, urllib.error, urllib.request

ap = argparse.ArgumentParser()
ap.add_argument("--count", type=int, default=random.randint(400, 1500))
ap.add_argument("--web", default=os.environ.get("MIERUKA_WEB", "https://kizuna-temp.vercel.app"))
a = ap.parse_args()
web, key, done = a.web.rstrip("/"), os.environ.get("MIERUKA_ADAPTER_KEY", ""), 0
print(f"registering {a.count} devices on {web} ...")
while done < a.count:
    n = min(100, a.count - done)
    req = urllib.request.Request(web + "/api/atlas/provision", json.dumps({"count": n}).encode(),
                                 {"Content-Type": "application/json", **({"X-Adapter-Key": key} if key else {})}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            done += json.loads(r.read())["created"]
    except urllib.error.HTTPError as e:
        sys.exit(f"refused after {done}: HTTP {e.code} {e.read()[:160]!r}")
    except (OSError, ValueError) as e:
        sys.exit(f"failed after {done}: {e}")
    print(f"  {done}/{a.count}", flush=True)
print("done: refresh the Réseau page")
