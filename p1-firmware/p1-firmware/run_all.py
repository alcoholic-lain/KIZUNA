#!/usr/bin/env python3
"""Start the whole chain: STEG server, concentrator, gateway (C++ firmware). Ctrl+C stops all.
   uv run run_all.py            (extra args go to gateway.py, e.g. --mqtt)"""
import json, os, subprocess, sys, threading, time, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
procs = []


def spawn(name, script, *extra):
    p = subprocess.Popen([sys.executable, "-u", os.path.join(HERE, script), *extra], cwd=HERE,
                         stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    procs.append(p)

    def pump():
        for line in p.stdout:
            print(f"[{name}] {line.rstrip()}", flush=True)
    threading.Thread(target=pump, daemon=True).start()
    return p


WEB = os.environ.get("MIERUKA_WEB", "https://kizuna-temp.vercel.app").rstrip("/")
KEY = os.environ.get("MIERUKA_ADAPTER_KEY", "")
DEVFILE = os.path.join(HERE, "data", "device.json")


def simulate_scan():
    """Stand-in for scanning the plug's QR with a phone: the web app registers a new adapter named LAC-xxx
    on a random building and stores its GPS fix, so the device appears in the back-office atlas.
    The device is kept between runs; pass --new-device for a fresh one."""
    if "--new-device" not in sys.argv and os.path.exists(DEVFILE):
        try:
            return json.load(open(DEVFILE, encoding="utf-8"))
        except (OSError, ValueError):
            pass
    try:
        req = urllib.request.Request(WEB + "/api/atlas/provision", b"{}", {"Content-Type": "application/json", **({"X-Adapter-Key": KEY} if KEY else {})}, method="POST")
        with urllib.request.urlopen(req, timeout=20) as r:
            dev = json.loads(r.read())
    except (urllib.error.URLError, ValueError) as e:
        print(f"simulated scan failed ({getattr(e, 'code', e.__class__.__name__)}): the device keeps its previous/default ID")
        return None
    os.makedirs(os.path.dirname(DEVFILE), exist_ok=True)
    json.dump(dev, open(DEVFILE, "w", encoding="utf-8"))
    return dev


device = simulate_scan()
extra_conc = []
if device:
    print(f"\n  simulated scan: {device['name']} ({device['id']}) placed on a building in {device['city']} -> visible in the back-office Atlas\n")
    extra_conc = ["--adapter", device["id"], "--name", device["name"]]
sys.argv = [a for a in sys.argv if a != "--new-device"]

spawn("steg", "steg_server.py")
spawn("conc", "concentrator.py", *extra_conc)
time.sleep(1)
spawn("plug", "gateway.py", *sys.argv[1:])
print("\n  device console   http://localhost:8123\n  3D room          http://localhost:8123/room\n  components 3D    http://localhost:8123/composants\n  operator entry   http://localhost:9200   (key: steg-operator-demo)\n", flush=True)
try:
    while all(p.poll() is None for p in procs):
        time.sleep(0.5)
except KeyboardInterrupt:
    pass
finally:
    for p in procs:
        if p.poll() is None:
            p.terminate()
