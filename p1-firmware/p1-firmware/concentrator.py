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
from railway import DEFAULT_RECEIVER, railway_settings

ap = argparse.ArgumentParser()
ap.add_argument("--id", default="conc-tn-001")
ap.add_argument("--port", type=int, default=9100)
ap.add_argument("--steg", default="http://localhost:9200")
ap.add_argument("--endpoint", default=os.environ.get("MIERUKA_ENDPOINT", DEFAULT_RECEIVER),
                help="Railway telemetry receiver (POST /mesures), which forwards to the Vercel back-office")
ap.add_argument("--token", help="Railway bearer token (prefer MIERUKA_API_TOKEN or API_TOKEN in the environment)")
ap.add_argument("--adapter", default=os.environ.get("MIERUKA_ADAPTER", "NABD-0001"),
                help="registered adapter ID the plug reports as (must exist in the Mieruka database)")
ap.add_argument("--web", default=os.environ.get("MIERUKA_WEB", "https://kizuna-temp.vercel.app"),
                help="web app polled for the back-office power switch (remote cut-off)")
ap.add_argument("--name", default="", help="device label (e.g. LAC-482), shown in the 3D room")
args = ap.parse_args()
args.adapter = args.adapter.strip().upper()
if not re.fullmatch(r"NABD-\d{4}", args.adapter):
    raise SystemExit(f"--adapter must look like NABD-0001, got {args.adapter!r}")
try:
    args.endpoint, args.token = railway_settings(args.endpoint, args.token)
except ValueError as error:
    ap.error(str(error))

lock = threading.Lock()
queue = deque(maxlen=500)
devices = {}                 # dev -> {"seq", "last"}
cmds = {}                    # dev -> [actions] waiting for the plug's next frame
st = {"rx": 0, "bad": 0, "dup": 0, "fwd": 0, "steg_ok": None}
cloud_q = deque(maxlen=5000)  # readings waiting for the Railway receiver (store-and-forward)
cloud = {"enabled": True, "adapter": args.adapter, "endpoint": args.endpoint,
         "ok": None, "sent": 0, "dropped": 0, "error": None, "last_ts": None}


def reading_of(frame):
    """One plug frame -> the frozen /mesures contract (French field names, UTC, whole seconds)."""
    watts = float(frame["data"].get("power_w", 0) or 0)
    ts = datetime.datetime.fromtimestamp(int(frame["ts"]), datetime.timezone.utc)
    return {"adaptateur_id": args.adapter, "horodatage": ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "watts": round(min(max(watts, 0.0), 10000.0), 1), "source": "simulee"}


def _ack(batch, via):
    with lock:
        for _ in range(len(batch)):
            cloud_q.popleft()
        cloud.update(ok=True, error=None, last_ts=int(time.time()))
        cloud["sent"] += len(batch)
        if cloud.get("via") != via:
            print(f"cloud uplink OK via {via}: {args.adapter}")
        cloud["via"] = via


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _post(url, batch, headers, timeout):
    req = urllib.request.Request(url, json.dumps(batch).encode(), {"Content-Type": "application/json", **headers})
    with urllib.request.build_opener(NoRedirect()).open(req, timeout=timeout) as r:
        return json.loads(r.read()).get("acquittees") == len(batch)


def cloud_forwarder():
    delay = 0
    while True:
        time.sleep(max(2, delay))
        with lock:
            batch = list(cloud_q)[:100]
        if not batch:
            continue
        try:
            headers = {"Authorization": f"Bearer {args.token}"} if args.token else {}
            if not _post(args.endpoint + "/mesures", batch, headers, 8):
                raise ValueError("incomplete acknowledgement")
        except urllib.error.HTTPError as error:
            message = f"Railway HTTP {error.code}"
            if error.code in (401, 403):
                message += " — check MIERUKA_API_TOKEN against Railway API_TOKEN"
        except (OSError, ValueError) as error:
            message = f"Railway {type(error).__name__}"
        else:
            _ack(batch, "railway")
            delay = 0
            continue
        with lock:
            if cloud["error"] != message:
                print(message, flush=True)
            cloud.update(ok=False, error=message)
        delay = min(30, max(4, delay * 2))


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
threading.Thread(target=cloud_forwarder, daemon=True).start()

power = {"on": True, "v": 0, "ok": None}   # what the back-office wants; v changes on every flip
applied = {}                               # dev -> version already sent to that plug


def power_poller():
    """Back-office 'Couper' button -> web app flag -> here -> plug. Polled, so the simulator needs no inbound port."""
    while True:
        time.sleep(2)
        try:
            with urllib.request.urlopen(f"{args.web.rstrip('/')}/api/atlas/power/{args.adapter}", timeout=6) as r:
                on = bool(json.loads(r.read()).get("on", True))
            with lock:
                if on != power["on"]:
                    power["on"], power["v"] = on, power["v"] + 1
                    print(f"back-office: power {'restored' if on else 'CUT'} for {args.adapter}")
                power["ok"] = True
        except Exception:
            with lock:
                power["ok"] = False


threading.Thread(target=power_poller, daemon=True).start()


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
                                    "adapter": args.adapter, "name": args.name, "power_on": power["on"], "power_link": power["ok"], "cloud": {**cloud, "queue": len(cloud_q)}})
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
                cloud_q.append(reading_of(f))
                st["rx"] += 1
            if applied.get(dev) != power["v"]:    # new switch position (or first frame): align the relay once
                applied[dev] = power["v"]
                if bool(f["data"].get("relay")) != power["on"] and (power["v"] or not power["on"]):
                    cmds.setdefault(dev, []).append("ON" if power["on"] else "OFF")
            out = {"ok": True, "ack": f["seq"], "cmds": cmds.pop(dev, [])}
        reply(self, out)


print(f"concentrator {args.id} on :{args.port} -> {args.steg}")
ThreadingHTTPServer(("0.0.0.0", args.port), H).serve_forever()
