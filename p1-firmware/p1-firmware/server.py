#!/usr/bin/env python3
"""
P1 cloud server (stdlib HTTP + paho-mqtt).
  ESP32 --HTTP POST /api/telemetry--> this server --MQTT--> broker --WSS--> 3D twin
  twin button / appliance --MQTT cmd + sim/load--> this server --HTTP response--> ESP32
Run:  python server.py        (stop device_sim.py first: same device id / topics)
"""
import argparse, json, random, threading, time
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    import paho.mqtt.client as mqtt
except ImportError:
    mqtt = None

ap = argparse.ArgumentParser()
ap.add_argument("--dev", default="kizuna-0042")
ap.add_argument("--host", default="broker.emqx.io")
ap.add_argument("--port", type=int, default=1883)
ap.add_argument("--http", type=int, default=5000)
ap.add_argument("--no-mqtt", action="store_true", help="HTTP only, no twin")
args = ap.parse_args()
BASE = f"p1/{args.dev}"

lock = threading.Lock()
actions = deque()        # commands waiting for the device's next poll
pending_load = None      # last injected appliance, delivered once
last = {}                # last telemetry
last_seen = 0.0
online = False
last_state = "OFF"

cli = None
if mqtt and not args.no_mqtt:
    cli = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"p1-srv-{random.randrange(1 << 24):06x}")
    cli.will_set(f"{BASE}/status", "offline", qos=1, retain=True)

    def on_connect(c, ud, flags, rc, props):
        print("MQTT connected" if not rc.is_failure else f"MQTT refused: {rc}")
        c.subscribe([(f"{BASE}/cmd", 1), (f"{BASE}/sim/load", 1)])

    def on_message(c, ud, msg):
        global pending_load
        try:
            d = json.loads(msg.payload.decode() or "{}")
        except ValueError:
            return
        with lock:
            if msg.topic.endswith("/cmd"):
                actions.append(str(d.get("action", "")).upper())
                print("twin -> cmd", d)
            elif msg.topic.endswith("/sim/load"):
                pending_load = {"appliance": str(d.get("appliance", "?"))[:24],
                                "watts": float(d.get("watts", 0) or 0),
                                "temp_c": float(d.get("temp_c", 0) or 0)}
                print("twin -> load", pending_load)

    cli.on_connect, cli.on_message = on_connect, on_message
    cli.reconnect_delay_set(1, 8)
    cli.connect_async(args.host, args.port, keepalive=15)
    cli.loop_start()


def pub(topic, payload, qos=0, retain=False):
    if cli:
        cli.publish(f"{BASE}/{topic}", payload, qos=qos, retain=retain)


def watchdog():
    global online
    while True:
        time.sleep(1)
        if online and time.monotonic() - last_seen > 5:
            online = False
            pub("status", "offline", 1, True)
            print("device silent for 5 s -> offline")


threading.Thread(target=watchdog, daemon=True).start()


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, obj, code=200):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):  # quick check from a browser: /api/last
        self._send({"online": online, "last": last} if self.path.startswith("/api/last") else {"ok": True})

    def do_POST(self):
        global last, last_seen, online, last_state, pending_load
        if self.path != "/api/telemetry":
            return self._send({"error": "not found"}, 404)
        try:
            t = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        except ValueError:
            return self._send({"error": "bad json"}, 400)
        with lock:
            last, last_seen = t, time.monotonic()
            if not online:
                online = True
                pub("status", "online", 1, True)
            state = t.get("state", "OFF")
            if state.startswith("TRIP") and not last_state.startswith("TRIP"):
                pub("alert", json.dumps({"state": state, "current_a": t.get("current_a"),
                                         "power_w": t.get("power_w"), "temp_c": t.get("temp_c"),
                                         "ts": int(time.time())}), 1)
            last_state = state
            resp = {"actions": list(actions), "load": pending_load}
            actions.clear()
            pending_load = None
        pub("telemetry", json.dumps(t), 0, True)
        print(f"{time.strftime('%H:%M:%S')}  {state:<16} {t.get('power_w', 0):7.1f} W  "
              f"{t.get('current_a', 0):5.2f} A  {t.get('temp_c', 0):4.1f} C"
              + (f"   -> sent {resp}" if resp["actions"] or resp["load"] else ""))
        self._send(resp)


print(f"P1 server on http://0.0.0.0:{args.http}  (device {args.dev}, MQTT {'off' if not cli else args.host})")
ThreadingHTTPServer(("0.0.0.0", args.http), H).serve_forever()
