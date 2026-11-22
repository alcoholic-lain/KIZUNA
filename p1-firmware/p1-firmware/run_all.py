#!/usr/bin/env python3
"""Start the whole chain: STEG server, concentrator, gateway (C++ firmware). Ctrl+C stops all.
   uv run run_all.py            (extra args go to gateway.py, e.g. --mqtt)"""
import json, os, re, subprocess, sys, threading, time, urllib.error, urllib.request
from railway import DEFAULT_RECEIVER, railway_settings

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


def simulate_scan(new_device):
    """Stand-in for scanning the plug's QR with a phone: the web app registers a new adapter named LAC-xxx
    on a random building and stores its GPS fix, so the device appears in the back-office atlas.
    The device is kept between runs; pass --new-device for a fresh one."""
    if not new_device:
        try:
            with open(DEVFILE, encoding="utf-8") as saved:
                device = json.load(saved)
            if valid_device(device):
                return device
        except (OSError, ValueError):
            pass
    try:
        req = urllib.request.Request(WEB + "/api/atlas/provision", b"{}", {"Content-Type": "application/json", **({"X-Adapter-Key": KEY} if KEY else {})}, method="POST")
        with urllib.request.urlopen(req, timeout=20) as r:
            dev = json.loads(r.read())
    except (OSError, ValueError) as error:
        status = getattr(error, "code", None)
        hint = " Set MIERUKA_ADAPTER_KEY to the adapter key from Vercel." if status in (401, 403) else ""
        detail = f"HTTP {status}" if status else type(error).__name__
        raise ValueError(f"Could not register an adapter at {WEB} ({detail}).{hint}") from error
    if not valid_device(dev):
        raise ValueError(f"{WEB} did not return a valid adapter registration.")
    os.makedirs(os.path.dirname(DEVFILE), exist_ok=True)
    with open(DEVFILE, "w", encoding="utf-8") as saved:
        json.dump(dev, saved)
    return dev


def valid_device(device):
    return (isinstance(device, dict)
            and isinstance(device.get("id"), str) and re.fullmatch(r"NABD-\d{4}", device["id"])
            and all(isinstance(device.get(key), str) and device[key] for key in ("name", "city")))


new_device = "--new-device" in sys.argv
configured_adapter = os.environ.get("MIERUKA_ADAPTER", "").strip().upper()
try:
    railway_settings(os.environ.get("MIERUKA_ENDPOINT", DEFAULT_RECEIVER))
    if configured_adapter and not new_device:
        if not re.fullmatch(r"NABD-\d{4}", configured_adapter):
            raise ValueError("MIERUKA_ADAPTER must look like NABD-0001.")
        extra_conc = ["--adapter", configured_adapter]
        print(f"  using registered adapter {configured_adapter}", flush=True)
    else:
        device = simulate_scan(new_device)
        print(f"  simulator adapter: {device['name']} ({device['id']}) in {device['city']}", flush=True)
        extra_conc = ["--adapter", device["id"], "--name", device["name"]]
except (OSError, ValueError) as error:
    raise SystemExit(str(error)) from None

spawn("steg", "steg_server.py")
spawn("conc", "concentrator.py", *extra_conc)
time.sleep(1)
spawn("plug", "gateway.py", "--load-watts", "450", *(arg for arg in sys.argv[1:] if arg != "--new-device"))
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
