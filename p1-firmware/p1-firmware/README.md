# P1 firmware kit

Two ways to run the same plug logic:

| Mode | Firmware | Link to Python | Needs |
|---|---|---|---|
| **A. Native (recommended for the demo)** | `native/p1_native.cpp` compiled on your PC | UART-style stdin/stdout, `gateway.py` | a C++ compiler only |
| **B. Wokwi ESP32** | `src/main.cpp` (PlatformIO) | HTTPS POST to `server.py` through a tunnel | VS Code, PlatformIO, Wokwi, cloudflared |

## A. Native mode
1. Install uv: `winget install astral-sh.uv`.
2. From this folder: `uv run gateway.py` (add `--mqtt` to feed `prototype.html` through broker.emqx.io). uv installs paho-mqtt and, if you have no g++/clang++, a bundled compiler (ziglang, ~100 MB). The first compile with it takes a few minutes; later runs are instant.
3. Open http://localhost:8123. The script compiles and launches the C++ itself.

## B. Wokwi mode
Set `SERVER_URL` in `src/main.cpp` to your `cloudflared tunnel --url http://localhost:5000` address, run `server.py`, then build and start the Wokwi simulator.

## C. Full chain: room + concentrator + STEG server
`uv run run_all.py` starts everything (extra args go to the gateway, e.g. `--mqtt`):

| URL | What |
|---|---|
| http://localhost:8123/room | 3D room: plug on the wall outlet, appliance, STEG meter + concentrator by the door, STEG server outside. Packets fly between them. |
| http://localhost:8123 | device console (OLED, slider, log) |
| http://localhost:9200 | STEG back-office: readings, estimated bill, alerts, remote ON/OFF |

Flow: plug (C++) → signed frame every 1 s → concentrator `:9100` (checks HMAC, drops replays, buffers if STEG is down) → signed batch every 2 s → STEG server `:9200` (reads it, logs `data/readings.jsonl`, estimates the bill). A remote OFF from the STEG page travels back down the same path to the plug.
Keys in `common.py` are demo keys. The tariff is a flat illustrative 0.250 TND/kWh, not the real STEG tiers.

## D. Cloud chain: plug → Railway → Vercel back-office
Set these before `uv run run_all.py`:

| Variable | Meaning |
|---|---|
| `MIERUKA_API_TOKEN` | Railway `API_TOKEN`. The concentrator posts each reading to `https://mieruka-endpoint-production.up.railway.app/mesures` (override with `MIERUKA_ENDPOINT`; never the web app). Without it the cloud uplink is off. |
| `MIERUKA_ADAPTER_KEY` | Same key as on Vercel and Railway. Used once at start for the **simulated scan**. |
| `MIERUKA_WEB` | Web app, default `https://kizuna-temp.vercel.app`. |

At start, `run_all.py` simulates a phone scan: `POST /api/atlas/provision` registers a new device named `LAC-xxx` on a random mapped building (adapter `NABD-7xxx`, GPS fix and roof pin), so it appears on the STEG Réseau map. The device is kept in `data/device.json`; `--new-device` creates another. Readings then flow plug → concentrator → Railway `/mesures` → Vercel `/api/mesures`. The 3D room shows a QR of the adapter ID, which the Mieruka app's scanner reads.
