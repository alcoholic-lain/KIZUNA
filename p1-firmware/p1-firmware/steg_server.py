#!/usr/bin/env python3
"""
STEG back-office server (demo). Receives signed batches from the concentrator, keeps the
latest reading and a history per meter, estimates the bill, raises alerts, logs every reading
to data/readings.jsonl and lets an operator send ON/OFF commands back down the chain.
Read it:  http://localhost:9200 (dashboard)   GET /api/state   GET /api/history?dev=<id>
"""
import argparse, hmac, json, os, threading, time
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from common import CONC_KEY, read_json, reply, verify

ap = argparse.ArgumentParser()
ap.add_argument("--port", type=int, default=9200)
ap.add_argument("--tariff", type=float, default=0.250, help="TND per kWh, ILLUSTRATIVE flat rate (real STEG tariff is tiered)")
ap.add_argument("--operator-key", default=os.environ.get("STEG_OPERATOR_KEY", "steg-operator-demo"), help="key required for remote cutoff")
args = ap.parse_args()
HERE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(os.path.join(HERE, "data"), exist_ok=True)
LOG = os.path.join(HERE, "data", "readings.jsonl")

lock = threading.Lock()
meters, hist = {}, {}
alerts = deque(maxlen=40)
pending = []                 # commands waiting for the next concentrator batch
stats = {"batches": 0, "readings": 0, "bad": 0}

PAGE = """<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>STEG - supervision (demo)</title><style>
body{margin:0;background:#0c1116;color:#e6edf2;font:14px/1.5 system-ui,sans-serif}.w{max-width:960px;margin:0 auto;padding:20px 16px}
h1{font-size:20px;margin:0 0 14px}.c{background:#141b22;border:1px solid #26323c;border-radius:14px;padding:14px;margin-bottom:14px}
.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}.g b{display:block;font-size:20px}.g span{font-size:11px;color:#8fa1ad;text-transform:uppercase}
button{font:600 13px system-ui;padding:7px 12px;border-radius:9px;border:1px solid #26323c;background:transparent;color:#e6edf2;cursor:pointer;margin-right:8px}
.ok{color:#34d399}.bad{color:#f43f5e}pre{margin:0;font:12px ui-monospace,monospace;color:#8fa1ad;white-space:pre-wrap}canvas{width:100%;height:80px}</style>
<div class="w"><h1>STEG - supervision des compteurs communicants <small style="color:#8fa1ad">(demo)</small></h1><div id="m"></div>
<div class="c"><b>Alertes</b><pre id="a">-</pre></div><div class="c"><pre id="s"></pre></div></div>
<script>
function cmd(d,a){fetch('/api/command',{method:'POST',body:JSON.stringify({dev:d,action:a})})}
function tick(){fetch('/api/state').then(r=>r.json()).then(function(s){var h='';
Object.keys(s.meters).forEach(function(d){var m=s.meters[d],on=m.age_s<6;
h+='<div class="c"><b>'+d+'</b> <span class="'+(on?'ok':'bad')+'">'+(on?'en ligne':'hors ligne')+'</span> - '+m.state+
'<div class="g" style="margin:10px 0"><div><span>Puissance</span><b>'+Math.round(m.power_w)+' W</b></div><div><span>Courant</span><b>'+m.current_a.toFixed(2)+' A</b></div>'+
'<div><span>Tension</span><b>'+m.voltage_v.toFixed(1)+' V</b></div><div><span>Energie</span><b>'+(m.energy_wh/1000).toFixed(4)+' kWh</b></div>'+
'<div><span>Facture estimee</span><b>'+m.cost_tnd.toFixed(4)+' TND</b></div><div><span>Temp.</span><b>'+m.temp_c.toFixed(1)+' C</b></div></div>'+
'<button onclick="cmd(\\''+d+'\\',\\'OFF\\')">Coupure a distance</button><button onclick="cmd(\\''+d+'\\',\\'ON\\')">Retablir</button></div>'});
document.getElementById('m').innerHTML=h||'<div class="c">En attente de donnees du concentrateur...</div>';
document.getElementById('a').textContent=s.alerts.length?s.alerts.map(function(x){return x.time+'  '+x.dev+'  '+x.msg}).join('\\n'):'-';
document.getElementById('s').textContent='lots recus: '+s.stats.batches+'   mesures: '+s.stats.readings+'   rejets: '+s.stats.bad+'   tarif illustratif: '+s.tariff+' TND/kWh'}).catch(function(){})}
tick();setInterval(tick,1000);</script></html>"""


def note(dev, msg):
    alerts.appendleft({"time": time.strftime("%H:%M:%S"), "dev": dev, "msg": msg})
    print(dev, msg)


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            fp = os.path.join(HERE, "steg.html")
            b = open(fp, "rb").read() if os.path.exists(fp) else PAGE.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(b)))
            self.end_headers()
            self.wfile.write(b)
        elif self.path == "/nav.js":
            b = open(os.path.join(HERE, "nav.js"), "rb").read()
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(b)))
            self.end_headers()
            self.wfile.write(b)
        elif self.path.startswith("/api/state"):
            with lock:
                now = time.time()
                m = {d: {**v, "age_s": round(now - v["rx_ts"], 1)} for d, v in meters.items()}
                reply(self, {"meters": m, "alerts": list(alerts), "stats": stats, "tariff": args.tariff})
        elif self.path.startswith("/api/history"):
            dev = self.path.split("dev=")[-1] if "dev=" in self.path else ""
            with lock:
                reply(self, {"dev": dev, "points": list(hist.get(dev, []))})
        else:
            reply(self, {"error": "not found"}, 404)

    def do_POST(self):
        try:
            d = read_json(self)
        except ValueError:
            return reply(self, {"error": "bad json"}, 400)
        if self.path == "/api/command":
            if not hmac.compare_digest(self.headers.get("X-Operator-Key", ""), args.operator_key):
                with lock:
                    note(str(d.get("dev", "?"))[:40], "REFUSED command: bad operator key")
                return reply(self, {"error": "bad operator key"}, 401)
            if d.get("action") in ("ON", "OFF") and d.get("dev"):
                with lock:
                    pending.append({"dev": str(d["dev"])[:40], "action": d["action"]})
                    note(d["dev"], f"operator command {d['action']} queued")
                return reply(self, {"queued": True})
            return reply(self, {"error": "bad command"}, 400)
        if self.path != "/api/readings":
            return reply(self, {"error": "not found"}, 404)
        s = d.get("batch", "")
        if not verify(CONC_KEY, s, d.get("sig", "")):
            with lock:
                stats["bad"] += 1
            return reply(self, {"error": "bad signature"}, 401)
        b = json.loads(s)
        with lock:
            stats["batches"] += 1
            for r in b["readings"]:
                dev, t = r["dev"], r["data"]
                prev = meters.get(dev)
                if prev and r["seq"] <= prev["seq"]:
                    continue
                stats["readings"] += 1
                if t["state"].startswith("TRIP") and not (prev and prev["state"].startswith("TRIP")):
                    note(dev, f"ALERT {t['state']}  {t.get('current_a', 0):.1f} A / {t.get('temp_c', 0):.0f} C")
                meters[dev] = {"seq": r["seq"], "ts": r["ts"], "rx_ts": time.time(), "conc": b["conc"],
                               "state": t["state"], "relay": t["relay"], "power_w": t["power_w"],
                               "current_a": t["current_a"], "voltage_v": t["voltage_v"],
                               "energy_wh": t["energy_wh"], "temp_c": t["temp_c"],
                               "cost_tnd": t["energy_wh"] / 1000 * args.tariff}
                hist.setdefault(dev, deque(maxlen=300)).append([r["ts"], t["power_w"]])
                with open(LOG, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"dev": dev, "seq": r["seq"], "ts": r["ts"], **t}) + "\n")
            out = {"ok": True, "n": len(b["readings"]), "cmds": list(pending)}
            pending.clear()
        reply(self, out)


print(f"operator key for remote cutoff: {args.operator_key}")
print(f"STEG server on http://localhost:{args.port}  (tariff {args.tariff} TND/kWh, illustrative)")
ThreadingHTTPServer(("0.0.0.0", args.port), H).serve_forever()
