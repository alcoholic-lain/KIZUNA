#!/usr/bin/env python3
"""
Concentrator installed next to the STEG meter.
  plug --HTTP POST /ingest (signed frame)--> concentrator --signed batch every 2 s--> STEG server
It verifies signatures, drops replays, buffers while the STEG server is unreachable
(store-and-forward) and relays STEG commands (ON/OFF) back to the plug in its replies.
"""
import argparse, datetime, json, os, re, threading, time, urllib.error, urllib.request
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from common import CONC_KEY, PLUG_KEY, read_json, reply, sign, verify

ap = argparse.ArgumentParser()
ap.add_argument("--id", default="conc-tn-001")
ap.add_argument("--port", type=int, default=9100)
ap.add_argument("--steg", default="http://localhost:9200")
ap.add_argument("--endpoint", default=os.environ.get("MIERUKA_ENDPOINT", "https://mieruka-endpoint-production.up.railway.app"),
                help="Railway telemetry receiver (POST /mesures), which forwards to the Vercel back-office")
ap.add_argument("--token", default=os.environ.get("MIERUKA_API_TOKEN", ""), help="Railway API_TOKEN (or env MIERUKA_API_TOKEN); empty = cloud uplink off")
ap.add_argument("--adapter", default=os.environ.get("MIERUKA_ADAPTER", "NABD-0001"),
                help="registered adapter ID the plug reports as (must exist in the Mieruka database)")
ap.add_argument("--name", default="", help="device label (e.g. LAC-482), shown in the 3D room")
args = ap.parse_args()
args.adapter = args.adapter.strip().upper()
if not re.fullmatch(r"NABD-\d{4}", args.adapter):
    raise SystemExit(f"--adapter must look like NABD-0001, got {args.adapter!r}")
args.endpoint = args.endpoint.rstrip("/")
if "vercel.app" in args.endpoint:
    raise SystemExit("--endpoint must be the Railway receiver (railway.app), not the web app: readings go plug -> Railway /mesures -> Vercel")
if not args.endpoint.startswith("https://") and not args.endpoint.startswith("http://localhost") and not args.endpoint.startswith("http://127."):
    raise SystemExit("--endpoint must be https (the token travels in a header)")

lock = threading.Lock()
queue = deque(maxlen=500)
devices = {}                 # dev -> {"seq", "last"}
cmds = {}                    # dev -> [actions] waiting for the plug's next frame
st = {"rx": 0, "bad": 0, "dup": 0, "fwd": 0, "steg_ok": None}
cloud_q = deque(maxlen=5000)  # readings waiting for the Railway receiver (store-and-forward)
cloud = {"enabled": bool(args.token), "adapter": args.adapter, "endpoint": args.endpoint,
         "ok": None, "sent": 0, "dropped": 0, "error": None, "last_ts": None}


def reading_of(frame):
    """One plug frame -> the frozen /mesures contract (French field names, UTC, whole seconds)."""
    watts = float(frame["data"].get("power_w", 0) or 0)
    ts = datetime.datetime.fromtimestamp(int(frame["ts"]), datetime.timezone.utc)
    return {"adaptateur_id": args.adapter, "horodatage": ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "watts": round(min(max(watts, 0.0), 10000.0), 1), "source": "simulee"}


def cloud_forwarder():
    """Railway acknowledges once stored; it then retries Vercel by itself. Retry here with backoff."""
    delay = 0
    while True:
        time.sleep(max(2, delay))
        with lock:
            batch = list(cloud_q)[:100]
        if not batch:
            continue
        try:
            req = urllib.request.Request(args.endpoint + "/mesures", json.dumps(batch).encode(), {
                "Content-Type": "application/json", "Authorization": "Bearer " + args.token})
            with urllib.request.urlopen(req, timeout=8) as r:
                ack = json.loads(r.read())
            if ack.get("acquittees") != len(batch):
                raise ValueError("incomplete acknowledgement")
            with lock:
                for _ in range(len(batch)):
                    cloud_q.popleft()
                cloud.update(ok=True, error=None, last_ts=int(time.time()))
                cloud["sent"] += len(batch)
            delay = 0
        except urllib.error.HTTPError as e:
            msg = f"HTTP {e.code}"
            with lock:
                cloud.update(ok=False, error=msg)
                if e.code == 400:          # the receiver refuses this batch for good: do not block the queue
                    for _ in range(len(batch)):
                        cloud_q.popleft()
                    cloud["dropped"] += len(batch)
            print(f"cloud uplink rejected: {msg}" + (" - check MIERUKA_API_TOKEN" if e.code == 401 else ""))
            delay = min(60, max(4, delay * 2))
        except Exception as e:
            with lock:
                if cloud["ok"] is not False:
                    print(f"cloud uplink unreachable ({e.__class__.__name__}) - buffering")
                cloud.update(ok=False, error=e.__class__.__name__)
            delay = min(60, max(4, delay * 2))
        else:
            if cloud["sent"] == len(batch):
                print(f"cloud uplink OK: {args.adapter} -> {args.endpoint}/mesures")


def forwarder():
    while True:
        time.sleep(2)
        with lock:
            batch = list(queue)
        if not batch:
            continue
        s = json.dumps({"conc": args.id, "ts": int(time.time()), "readings": batch}, sort_keys=True, separators=(",", ":"))
        body = json.dumps({"batch": s, "sig": sign(CONC_KEY, s)}).encode()
        try:
            req = urllib.request.Request(args.steg + "/api/readings", body, {"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=3) as r:
                resp = json.loads(r.read())
            with lock:
                for _ in range(len(batch)):
                    queue.popleft()
                st["fwd"] += 1
                if st["steg_ok"] is not True:
                    print("STEG server reachable, queue flushed")
                st["steg_ok"] = True
                for c in resp.get("cmds", []):
                    if c.get("action") in ("ON", "OFF"):
                        cmds.setdefault(c["dev"], []).append(c["action"])
                        print(f"STEG command for {c['dev']}: {c['action']}")
        except Exception as e:
            with lock:
                if st["steg_ok"] is not False:
                    print(f"STEG server unreachable ({e.__class__.__name__}) - buffering")
                st["steg_ok"] = False


threading.Thread(target=forwarder, daemon=True).start()
if args.token:
    threading.Thread(target=cloud_forwarder, daemon=True).start()
else:
    print("cloud uplink OFF: set MIERUKA_API_TOKEN (Railway API_TOKEN) to send readings to Railway -> Vercel")


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/api/state"):
            with lock:
                age = {d: round(time.time() - v["last"], 1) for d, v in devices.items()}
                return reply(self, {"id": args.id, **st, "queue": len(queue), "age_s": age,
                                    "adapter": args.adapter, "name": args.name, "cloud": {**cloud, "queue": len(cloud_q)}})
        reply(self, {"error": "not found"}, 404)

    def do_POST(self):
        if self.path != "/ingest":
            return reply(self, {"error": "not found"}, 404)
        try:
            d = read_json(self)
            frame = d["frame"]
        except (ValueError, KeyError):
            return reply(self, {"error": "bad request"}, 400)
        if not verify(PLUG_KEY, frame, d.get("sig", "")):
            with lock:
                st["bad"] += 1
            print("rejected frame: bad signature")
            return reply(self, {"error": "bad signature"}, 401)
        f = json.loads(frame)
        dev = f["dev"]
        with lock:
            if f["seq"] <= devices.get(dev, {}).get("seq", 0):
                st["dup"] += 1                      # replay / duplicate
            else:
                devices[dev] = {"seq": f["seq"], "last": time.time()}
                queue.append(f)
                if args.token:
                    cloud_q.append(reading_of(f))
                st["rx"] += 1
            out = {"ok": True, "ack": f["seq"], "cmds": cmds.pop(dev, [])}
        reply(self, out)


print(f"concentrator {args.id} on :{args.port} -> {args.steg}")
ThreadingHTTPServer(("0.0.0.0", args.port), H).serve_forever()
