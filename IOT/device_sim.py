#!/usr/bin/env python3
"""
Smart Plug P1 - virtual ESP32 (Python stand-in for the Wokwi firmware).

It follows spec.md exactly, so the 3D twin cannot tell it apart from the
real firmware:
  * MQTT topics   p1/<dev>/telemetry  (device -> twin, every 1 s + on change, retained)
                  p1/<dev>/cmd        (twin -> device)  {"action": "ON|OFF|TOGGLE|RESET_TRIP|RESET_ENERGY"}
                  p1/<dev>/sim/load   (twin -> device)  {"appliance": "...", "watts": 2200, "temp_c": 44}
                  p1/<dev>/alert      (device -> twin, immediate trip packet)
                  p1/<dev>/status     ("online" / "offline" via MQTT last will, retained)
  * Overcurrent cutoff: > 16 A or > 3680 W for 3 consecutive 20 ms samples
  * Thermal cutoff above 75 C
  * "NVS" persistence of relay state + energy in p1_nvs.json (debounced)
  * Non-blocking loop (20 ms sampling, 250 ms display, 1000 ms telemetry)
  * Auto-reconnect: protection keeps running while Wi-Fi/MQTT is down
  * Buzzer: one chirp on toggle, three 2.4 kHz beeps on trip (PC speaker on Windows)

It also serves this folder over HTTP so the twin page is one click away.

Keyboard (the "physical" plug):
  SPACE  short press  -> toggle relay / clear trip
  L      long press   -> reset energy counter
  + / -  slide potentiometer +/- 1 A (ADC mode, cancels injected load)
  0      slider to 0 A
  Q      quit
"""
import argparse
import functools
import http.server
import json
import math
import os
import random
import sys
import threading
import time
from collections import deque

try:
    import paho.mqtt.client as mqtt
except ImportError:
    sys.exit("paho-mqtt is missing: run  python -m pip install paho-mqtt")

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------- limits from the spec ----------
TRIP_A = 16.0
TRIP_W = 3680.0
TRIP_SAMPLES = 3
TRIP_TEMP_C = 75.0
AMBIENT_C = 24.0
SAMPLE_MS, OLED_MS, TELEM_MS = 20, 250, 1000
NVS_DEBOUNCE_S = 2.0


def now_ms():
    return time.monotonic() * 1000.0


# ---------- keyboard, non-blocking on Windows and POSIX ----------
class Keys:
    def __init__(self):
        self.win = os.name == "nt"
        self.old = None
        if not self.win and sys.stdin.isatty():
            import termios, tty
            self.old = termios.tcgetattr(sys.stdin)
            tty.setcbreak(sys.stdin.fileno())

    def get(self):
        if self.win:
            import msvcrt
            if msvcrt.kbhit():
                ch = msvcrt.getwch()
                if ch in ("\x00", "\xe0"):  # arrow / function key prefix
                    msvcrt.getwch()
                    return None
                return ch
            return None
        import select
        if sys.stdin.isatty() and select.select([sys.stdin], [], [], 0)[0]:
            return sys.stdin.read(1)
        return None

    def close(self):
        if self.old is not None:
            import termios
            termios.tcsetattr(sys.stdin, termios.TCSADRAIN, self.old)


# ---------- buzzer ----------
class Buzzer:
    def __init__(self, enabled):
        self.enabled = enabled and os.name == "nt"
        self.q = deque()
        self.ev = threading.Event()
        threading.Thread(target=self._run, daemon=True).start()

    def chirp(self):
        self._play([(2400, 60)])

    def alarm(self):
        self._play([(2400, 110), (0, 70)] * 3)

    def _play(self, pattern):
        if not self.enabled:
            sys.stdout.write("\a")
            return
        self.q.append(pattern)
        self.ev.set()

    def _run(self):  # winsound.Beep blocks, so it lives on its own thread
        import winsound
        while True:
            self.ev.wait()
            self.ev.clear()
            while self.q:
                for f, ms in self.q.popleft():
                    if f:
                        winsound.Beep(f, ms)
                    else:
                        time.sleep(ms / 1000)


# ---------- the plug ----------
class Plug:
    def __init__(self, args):
        self.a = args
        self.base = f"p1/{args.dev}"
        self.nvs_path = os.path.join(HERE, args.nvs)
        nvs = self._nvs_load()
        self.relay = bool(nvs.get("relay_state", False))
        self.energy_wh = float(nvs.get("energy_wh", 0.0))
        self.state = "ON" if self.relay else "OFF"
        self.boot = time.monotonic()
        self.voltage = 230.0
        self.current = 0.0
        self.power = 0.0
        self.temp = AMBIENT_C
        self.slider_a = 0.0          # Wokwi slide potentiometer, 0..20 A
        self.inj = None              # injected appliance {"appliance","watts","temp_c"}
        self.over = 0                # consecutive overcurrent samples
        self.nvs_dirty_at = None
        self.connected = False
        self.dirty = True            # publish telemetry asap
        self.log = deque(maxlen=7)
        self.lock = threading.Lock()
        self.buzz = Buzzer(not args.no_sound)

        self.cli = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2,
                               client_id=f"p1-{args.dev}-{random.randrange(1 << 24):06x}")
        self.cli.will_set(f"{self.base}/status", "offline", qos=1, retain=True)
        self.cli.reconnect_delay_set(1, 8)
        self.cli.on_connect = self._on_connect
        self.cli.on_disconnect = self._on_disconnect
        self.cli.on_message = self._on_message

    # ----- persistence (Preferences.h stand-in) -----
    def _nvs_load(self):
        try:
            with open(self.nvs_path, encoding="utf-8") as f:
                return json.load(f)
        except (OSError, ValueError):
            return {}

    def _nvs_mark(self):
        self.nvs_dirty_at = time.monotonic()

    def _nvs_flush(self, force=False):
        if self.nvs_dirty_at is None:
            return
        if force or time.monotonic() - self.nvs_dirty_at > NVS_DEBOUNCE_S:
            tmp = self.nvs_path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump({"relay_state": self.relay, "energy_wh": round(self.energy_wh, 3)}, f)
            os.replace(tmp, self.nvs_path)
            self.nvs_dirty_at = None

    # ----- MQTT -----
    def _on_connect(self, cli, ud, flags, rc, props):
        if rc.is_failure:
            self.say(f"MQTT refused: {rc}")
            return
        self.connected = True
        cli.subscribe([(f"{self.base}/cmd", 1), (f"{self.base}/sim/load", 1)])
        cli.publish(f"{self.base}/status", "online", qos=1, retain=True)
        self.dirty = True
        self.say(f"MQTT connected to {self.a.host}:{self.a.port}")

    def _on_disconnect(self, cli, ud, flags, rc, props):
        self.connected = False
        self.say("MQTT lost - auto-reconnecting, protection still active")

    def _on_message(self, cli, ud, msg):
        try:
            data = json.loads(msg.payload.decode("utf-8") or "{}")
        except ValueError:
            self.say(f"bad JSON on {msg.topic}")
            return
        with self.lock:
            if msg.topic.endswith("/cmd"):
                self.command(str(data.get("action", "")).upper(), "MQTT")
            elif msg.topic.endswith("/sim/load"):
                w = float(data.get("watts", 0) or 0)
                if w > 0:
                    self.inj = {"appliance": str(data.get("appliance", "?"))[:24], "watts": w,
                                "temp_c": float(data.get("temp_c", 0) or 0)}
                    self.say(f"load injected: {self.inj['appliance']} {w:.0f} W")
                else:
                    self.inj = None
                    self.say("load removed - back to ADC slider")
                self.dirty = True

    def publish_telemetry(self):
        if not self.connected:
            return
        self.cli.publish(f"{self.base}/telemetry", json.dumps(self.telemetry()), qos=0, retain=True)

    def telemetry(self):
        return {
            "relay": self.relay,
            "state": self.state,
            "voltage_v": round(self.voltage, 1),
            "current_a": round(self.current, 2),
            "power_w": round(self.power, 1),
            "energy_wh": round(self.energy_wh, 2),
            "temp_c": round(self.temp, 1),
            "uptime_s": int(time.monotonic() - self.boot),
            "appliance": self.inj["appliance"] if self.inj else ("Slider ADC" if self.slider_a > 0 else "Aucun"),
            "load_w": round(self.load_w(), 1),
            "rssi_dbm": -54 + random.randint(-3, 3),
        }

    # ----- behaviour -----
    def say(self, text):
        self.log.appendleft(f"{time.strftime('%H:%M:%S')}  {text}")

    def tripped(self):
        return self.state.startswith("TRIP")

    def set_relay(self, on, why):
        if on and self.tripped():
            self.say(f"ON refused ({why}): clear the trip first")
            return
        if on == self.relay:
            return
        self.relay = on
        self.state = "ON" if on else "OFF"
        self.buzz.chirp()
        self._nvs_mark()
        self._nvs_flush(force=True)             # relay state is written at once, energy is debounced
        self.dirty = True
        self.say(f"relay {'ON' if on else 'OFF'} ({why})")

    def command(self, action, why):
        if action == "ON":
            self.set_relay(True, why)
        elif action == "OFF":
            self.set_relay(False, why)
        elif action == "TOGGLE":
            if self.tripped():
                self.command("RESET_TRIP", why)
            else:
                self.set_relay(not self.relay, why)
        elif action == "RESET_TRIP":
            if self.tripped():
                self.state = "OFF"
                self.over = 0
                self.buzz.chirp()
                self.dirty = True
                self.say(f"trip cleared ({why}) - relay stays OFF")
        elif action == "RESET_ENERGY":
            self.energy_wh = 0.0
            self._nvs_mark()
            self.dirty = True
            self.say(f"energy counter reset ({why})")
        else:
            self.say(f"unknown action '{action}'")

    def trip(self, kind):
        self.relay = False                       # GPIO 26 = LOW
        self.state = kind
        self.over = 0
        self._nvs_mark()
        self.buzz.alarm()
        self.dirty = True
        alert = {"state": kind, "current_a": round(self.current, 2), "power_w": round(self.power, 1),
                 "temp_c": round(self.temp, 1), "ts": int(time.time())}
        if self.connected:
            self.cli.publish(f"{self.base}/alert", json.dumps(alert), qos=1)
        self.say(f"!!! {kind}  {self.current:.1f} A / {self.power:.0f} W / {self.temp:.0f} C")
        self.current = self.power = 0.0         # output is open from now on
        self._nvs_flush(force=True)

    def load_w(self):
        if self.inj:
            return self.inj["watts"]
        return self.slider_a * 230.0

    def sample(self, dt):
        """One 20 ms ADC sample: measure, integrate energy, run protection."""
        self.voltage = 230.0 + 1.6 * math.sin(time.monotonic() / 7.0) + random.uniform(-0.4, 0.4)
        if self.relay:
            w = self.load_w()
            noise = 1 + random.uniform(-0.006, 0.006) if w > 0 else 1
            self.current = w / self.voltage * noise
            self.power = self.voltage * self.current
        else:
            self.current = 0.0
            self.power = 0.0
        self.energy_wh += self.power * dt / 3600.0
        if self.power > 0:
            if self.nvs_dirty_at is None:
                self._nvs_mark()

        # thermal model: target from the injected appliance or from I^2 heating
        target = AMBIENT_C + 0.11 * self.current ** 2
        if self.inj and self.inj["temp_c"] and self.relay:
            target = max(target, self.inj["temp_c"])
        self.temp += (target - self.temp) * min(1.0, dt / 6.0)

        if self.tripped():
            return
        if self.current > TRIP_A or self.power > TRIP_W:
            self.over += 1
            if self.over >= TRIP_SAMPLES:
                self.trip("TRIP_OVERCURRENT")
        else:
            self.over = 0
        if self.temp > TRIP_TEMP_C and not self.tripped():
            self.trip("TRIP_THERMAL")

    def key(self, ch):
        ch = ch.lower()
        if ch == " ":
            self.command("TOGGLE", "button")
        elif ch == "l":
            self.command("RESET_ENERGY", "long press")
        elif ch in "+=-_0":
            if ch in "+=":
                self.slider_a = min(20.0, self.slider_a + 1)
            elif ch in "-_":
                self.slider_a = max(0.0, self.slider_a - 1)
            else:
                self.slider_a = 0.0
            if self.inj:
                self.inj = None
                self.say("slider moved - injected load released")
            self.dirty = True
        elif ch == "q":
            raise KeyboardInterrupt

    # ----- OLED (terminal) -----
    def oled(self):
        W = 60
        net = f"MQTT {'OK ' if self.connected else '...'}  {self.a.host}"
        if self.tripped():
            big = ">>> TRIP: >16A  OVERLOAD <<<" if self.state == "TRIP_OVERCURRENT" else ">>> TRIP: OVERHEAT <<<"
            big = f"\x1b[1;97;41m{big.center(W - 2)}\x1b[0m"
        else:
            col = "\x1b[1;92m" if self.relay else "\x1b[1;90m"
            big = f"{col}{('OUTPUT ' + self.state).center(W - 2)}\x1b[0m"
        load = self.telemetry()["appliance"]
        rows = [
            f" P1 {self.a.dev:<20}{net:>{W - 26}} ",
            "",
            big,
            "",
            f"   {self.power:8.1f} W     {self.current:6.2f} A     {self.voltage:5.1f} V",
            f"   {self.energy_wh / 1000:8.4f} kWh   {self.temp:5.1f} C     up {int(time.monotonic() - self.boot)} s",
            f"   load: {load[:24]:<24} slider {self.slider_a:4.1f} A",
        ]
        out = ["\x1b[H", "+" + "-" * (W - 2) + "+"]
        for r in rows:
            vis = len(strip_ansi(r))
            out.append("|" + r + " " * max(0, W - 2 - vis) + "|")
        out.append("+" + "-" * (W - 2) + "+")
        out.append(" SPACE toggle/clear trip  L reset kWh  +/- slider  0 zero  Q quit")
        out.append(f" twin: http://localhost:{self.a.http}/prototype.html" if self.a.http else "")
        out.append("")
        for line in list(self.log) + [""] * (7 - len(self.log)):
            out.append(line[:W + 20].ljust(W + 20))
        sys.stdout.write("\n".join(l + "\x1b[K" for l in out))
        sys.stdout.flush()

    # ----- main loop -----
    def run(self):
        self.say(f"boot - NVS restored relay={'ON' if self.relay else 'OFF'} energy={self.energy_wh:.1f} Wh")
        self.cli.connect_async(self.a.host, self.a.port, keepalive=15)
        self.cli.loop_start()               # network on its own thread, reconnects by itself
        keys = Keys()
        os.system("")                       # enable ANSI on Windows consoles
        sys.stdout.write("\x1b[2J\x1b[?25l")
        t_s = t_o = t_t = now_ms()
        try:
            while True:
                k = keys.get()
                t = now_ms()
                with self.lock:
                    if k:
                        self.key(k)
                    if t - t_s >= SAMPLE_MS:
                        self.sample((t - t_s) / 1000.0)
                        t_s = t
                    if self.dirty or t - t_t >= TELEM_MS:
                        self.publish_telemetry()
                        self.dirty = False
                        t_t = t
                    self._nvs_flush()
                    if t - t_o >= OLED_MS:
                        self.oled()
                        t_o = t
                time.sleep(0.004)
        except KeyboardInterrupt:
            pass
        finally:
            keys.close()
            self._nvs_flush(force=True)
            if self.connected:
                self.cli.publish(f"{self.base}/status", "offline", qos=1, retain=True).wait_for_publish(2)
            self.cli.loop_stop()
            self.cli.disconnect()
            sys.stdout.write("\x1b[?25h\n")


def strip_ansi(s):
    import re
    return re.sub(r"\x1b\[[0-9;?]*[A-Za-z]", "", s)


def serve(port):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    handler = functools.partial(Quiet, directory=HERE)
    httpd = http.server.ThreadingHTTPServer(("0.0.0.0", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()


def main():
    ap = argparse.ArgumentParser(description="Smart Plug P1 virtual ESP32")
    ap.add_argument("--host", default="broker.emqx.io", help="MQTT broker host (default broker.emqx.io)")
    ap.add_argument("--port", type=int, default=1883, help="MQTT TCP port (default 1883)")
    ap.add_argument("--dev", default="kizuna-0042", help="device id, topics are p1/<dev>/... (must match the page)")
    ap.add_argument("--http", type=int, default=8000, help="serve the twin page on this port, 0 to disable")
    ap.add_argument("--nvs", default="p1_nvs.json", help="flash persistence file")
    ap.add_argument("--no-sound", action="store_true", help="mute the PC-speaker buzzer")
    args = ap.parse_args()
    if args.http:
        serve(args.http)
    Plug(args).run()


if __name__ == "__main__":
    main()
