#!/usr/bin/env python3
"""
P1 gateway: compiles + launches the native C++ firmware, talks to it over a UART-style
stdin/stdout link, and serves a live device page (OLED framebuffer, LED, buttons, slider).

   native/p1_native.cpp  --stdout JSON lines-->  gateway.py  --SSE-->  viewer.html (browser)
                         <--stdin text cmds----            <--POST /api/input--
                                                   |
                                                   +--MQTT (optional, --mqtt)--> 3D twin page

Run:  uv run gateway.py            then open http://localhost:8123
      uv run gateway.py --mqtt     also bridges to broker.emqx.io for prototype.html
"""
import argparse, json, os, queue, random, shutil, subprocess, sys, threading, time, urllib.request
from common import PLUG_KEY, sign
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "native", "p1_native.cpp")
EXE = os.path.join(HERE, "native", "p1_native" + (".exe" if os.name == "nt" else ""))

ap = argparse.ArgumentParser()
ap.add_argument("--dev", default="kizuna-0042")
ap.add_argument("--http", type=int, default=8123)
ap.add_argument("--conc", default="http://localhost:9100", help="concentrator URL (next to the STEG meter)")
ap.add_argument("--no-net", action="store_true", help="do not send frames to the concentrator")
ap.add_argument("--mqtt", action="store_true", help="bridge to an MQTT broker for the 3D twin")
ap.add_argument("--host", default="broker.emqx.io")
ap.add_argument("--port", type=int, default=1883)
args = ap.parse_args()
BASE = f"p1/{args.dev}"

# ---------- 1. compile the firmware ----------
def find_cxx():
    for name in ("g++", "clang++"):
        if shutil.which(name):
            return [shutil.which(name)]
    try:
        import ziglang  # installed by uv: a bundled C++ compiler, nothing else to install
        return [sys.executable, "-m", "ziglang", "c++"]
    except ImportError:
        sys.exit("No C++ compiler found. Use:  uv run gateway.py  (it brings its own compiler)")


if not os.path.exists(EXE) or os.path.getmtime(SRC) > os.path.getmtime(EXE):
    cxx = find_cxx()
    print(f"compiling {os.path.basename(SRC)} with {' '.join(cxx[-2:])} ...")
    r = subprocess.run(cxx + ["-std=c++17", "-O2", "-pthread", "-o", EXE, SRC], capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr)
    print("compiled OK")

# ---------- 2. launch it ----------
proc = subprocess.Popen([EXE, args.dev, os.path.join(HERE, "native", "p1_native_nvs.txt")],
                        stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, bufsize=1)
send_lock = threading.Lock()


def uart_send(line):
    with send_lock:
        try:
            proc.stdin.write(line + "\n")
            proc.stdin.flush()
        except OSError:
            pass


# ---------- 3. fan-out to browsers (SSE) ----------
clients, clients_lock = [], threading.Lock()
last = {"telem": None, "oled": None}
log_tail = []


def broadcast(msg):
    data = json.dumps(msg)
    with clients_lock:
        for q in clients:
            try:
                q.put_nowait(data)
            except queue.Full:
                pass


# ---------- 4. optional MQTT bridge (same topics as spec.md) ----------
cli = None
if args.mqtt:
    import paho.mqtt.client as mqtt
    cli = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"p1-gw-{random.randrange(1 << 24):06x}")
    cli.will_set(f"{BASE}/status", "offline", qos=1, retain=True)

    def on_connect(c, ud, flags, rc, props):
        print("MQTT connected" if not rc.is_failure else f"MQTT refused: {rc}")
        c.subscribe([(f"{BASE}/cmd", 1), (f"{BASE}/sim/load", 1)])
        c.publish(f"{BASE}/status", "online", qos=1, retain=True)

    def on_message(c, ud, msg):
        try:
            d = json.loads(msg.payload.decode() or "{}")
        except ValueError:
            return
        if msg.topic.endswith("/cmd"):
            handle_input({"action": d.get("action", "")})
        else:
            handle_input({"load": d})

    cli.on_connect, cli.on_message = on_connect, on_message
    cli.reconnect_delay_set(1, 8)
    cli.connect_async(args.host, args.port, keepalive=15)
    cli.loop_start()

ACTIONS = {"ON", "OFF", "TOGGLE", "RESET_TRIP", "RESET_ENERGY"}


def safe_name(s):
    return "".join(c for c in str(s) if c.isalnum() or c in " -.")[:24] or "?"


def handle_input(d):
    """Validate everything coming from browsers / MQTT before it reaches the 'MCU'."""
    if "action" in d and str(d["action"]).upper() in ACTIONS:
        uart_send("CMD " + str(d["action"]).upper())
    elif d.get("btn") in ("short", "long"):
        uart_send("BTN " + d["btn"])
    elif "slider" in d:
        uart_send(f"SLIDER {float(d['slider']):.2f}")
    elif isinstance(d.get("load"), dict):
        w = float(d["load"].get("watts", 0) or 0)
        if w > 0:
            uart_send(f"LOAD {w:.1f} {float(d['load'].get('temp_c', 0) or 0):.1f} {safe_name(d['load'].get('appliance', '?'))}")
        else:
            uart_send("UNLOAD")


# ---------- 5. read the firmware's output ----------
def pump():
    prev_state = "OFF"
    for line in proc.stdout:
        line = line.strip()
        try:
            m = json.loads(line)
        except ValueError:
            print("fw>", line)
            continue
        t = m.get("t")
        if t == "oled":
            last["oled"] = m
        elif t == "telem":
            last["telem"] = m
            if cli:
                body = {k: v for k, v in m.items() if k != "t"}
                cli.publish(f"{BASE}/telemetry", json.dumps(body), qos=0, retain=True)
            if m["state"].startswith("TRIP") and not prev_state.startswith("TRIP") and cli:
                cli.publish(f"{BASE}/alert", json.dumps({"state": m["state"], "ts": int(time.time())}), qos=1)
            prev_state = m["state"]
        elif t == "log":
            print(time.strftime("%H:%M:%S"), m["msg"])
            log_tail.append(m)
            del log_tail[:-30]
        broadcast(m)
    code = proc.wait()
    print(f"firmware exited with code {code} ({code & 0xFFFFFFFF:#x}). Run native\\p1_native.exe by hand to see why.")
    os._exit(0)


threading.Thread(target=pump, daemon=True).start()


# ---------- 5b. uplink: signed frame to the concentrator every second ----------
def uplink():
    seq = int(time.time())          # monotonic across restarts (replay protection)
    ok_prev = None
    while True:
        time.sleep(1)
        m = last["telem"]
        if not m:
            continue
        seq += 1
        frame = json.dumps({"v": 1, "dev": args.dev, "seq": seq, "ts": int(time.time()),
                            "data": {k: v for k, v in m.items() if k != "t"}}, sort_keys=True, separators=(",", ":"))
        body = json.dumps({"frame": frame, "sig": sign(PLUG_KEY, frame)}).encode()
        ok = False
        try:
            req = urllib.request.Request(args.conc + "/ingest", body, {"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=2) as r:
                resp = json.loads(r.read())
            ok = True
            for a in resp.get("cmds", []):
                print("remote command from STEG:", a)
                handle_input({"action": a})
        except Exception:
            pass
        if ok != ok_prev:
            print("uplink to concentrator:", "OK" if ok else "unreachable")
            ok_prev = ok
        broadcast({"t": "pkt", "dir": "up", "seq": seq, "bytes": len(body), "ok": ok})


if not args.no_net:
    threading.Thread(target=uplink, daemon=True).start()


# ---------- 6. HTTP ----------
class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        pages = {"/": "viewer.html", "/index.html": "viewer.html", "/console": "viewer.html", "/room": "room.html", "/composants": "composants.html", "/produit": "produit.html"}
        if self.path in ("/nav.js", "/p1model.js"):
            b = open(os.path.join(HERE, self.path[1:]), "rb").read()
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(b)))
            self.end_headers()
            return self.wfile.write(b)
        if self.path in pages:
            b = open(os.path.join(HERE, pages[self.path]), "rb").read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(b)))
            self.end_headers()
            self.wfile.write(b)
        elif self.path == "/events":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            q = queue.Queue(maxsize=200)
            with clients_lock:
                clients.append(q)
            try:
                for m in (last["oled"], last["telem"]):
                    if m:
                        self.wfile.write(f"data: {json.dumps(m)}\n\n".encode())
                self.wfile.flush()
                while True:
                    try:
                        self.wfile.write(f"data: {q.get(timeout=10)}\n\n".encode())
                    except queue.Empty:
                        self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
            except OSError:
                pass
            finally:
                with clients_lock:
                    clients.remove(q)
        elif self.path == "/api/last":
            b = json.dumps(last["telem"]).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b)
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path != "/api/input":
            return self.send_error(404)
        try:
            handle_input(json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0)))))
            self.send_response(204)
        except (ValueError, TypeError):
            self.send_response(400)
        self.end_headers()


print(f"device page: http://localhost:{args.http}   (firmware pid {proc.pid}, MQTT {'on' if cli else 'off'})")
try:
    ThreadingHTTPServer(("0.0.0.0", args.http), H).serve_forever()
except KeyboardInterrupt:
    pass
finally:
    proc.terminate()
