# Smart Plug P1 — live digital twin

`device_sim.py` is a virtual ESP32 written in Python. It follows the firmware rules and MQTT protocol in [spec.md](spec.md). `prototype.html` is the 3D twin, and it now talks to the device over MQTT. Later you can swap the Python device for the Wokwi ESP32 without changing the page, because both use the same topics.

```
device_sim.py  ──TCP 1883──►  broker.emqx.io  ◄──WSS 8084──  prototype.html (3D twin)
 (virtual ESP32)                                                   (browser)
```

## Install (once)

- Python 3.10+
- Chrome or Edge
- In this folder:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
```

## Run

```powershell
.\.venv\Scripts\python device_sim.py
```

Then open **http://localhost:8000/prototype.html**. The simulator serves the page too. Click once anywhere on the page to enable sound.

The panel pill turns green ("● en direct") when the page reaches the broker and is receiving telemetry from the plug.

| Option | Default | |
|---|---|---|
| `--dev` | `kizuna-0042` | topics are `p1/<dev>/…`; the page reads `?dev=` |
| `--host` / `--port` | `broker.emqx.io` / `1883` | the page reads `?broker=wss://…/mqtt` |
| `--http` | `8000` | `0` turns off the built-in web server |
| `--no-sound` | off | mutes the PC-speaker buzzer |

Simulator keys (the "physical" plug): `SPACE` short press · `L` long press (reset kWh) · `+`/`-` current slider · `0` slider to zero · `Q` quit.

## 2-minute demo script

1. **ON**: click the red 3D button on the side of the plug. The relay chirps, the 3D LED turns green, and the terminal shows `relay ON (MQTT)`.
2. **Radiateur 2000 W**: the 3D screen shows ~2100 W / 9.13 A, and the kWh counter starts going up.
3. **Test surcharge (4100 W)**: the firmware trips after 3 samples above 16 A. The relay opens, the 3D screen flashes **SURCHARGE · TRIP : >16 A**, the LED flashes red, and the browser and PC both beep 3 times.
4. Click **ON**: it is refused while tripped. Pick a normal appliance, click **Réarmer**, then **ON**.
5. **Physical button**: press `SPACE` in the terminal. The 3D twin follows within a second.
6. **Power loss**: close the terminal. The twin shows "prise hors ligne" (MQTT last will). Restart the simulator and the relay state and kWh come back (`p1_nvs.json`).
7. Open the "Trames MQTT" section to show the raw JSON on the wire.

## Offline fallback (no venue Wi-Fi)

Install [Mosquitto](https://mosquitto.org/download/) and start it with this `mosquitto.conf`:

```
listener 1883
listener 9001
protocol websockets
allow_anonymous true
```

```powershell
mosquitto -c mosquitto.conf -v
.\.venv\Scripts\python device_sim.py --host localhost
```

Then open `http://localhost:8000/prototype.html?broker=ws://localhost:9001`.
