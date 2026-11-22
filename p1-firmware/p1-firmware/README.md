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
Set `MIERUKA_API_TOKEN` to the Railway service’s `API_TOKEN`, then run `uv run run_all.py`. Use the raw token value. The concentrator adds the `Authorization: Bearer` header. The simulator also accepts `API_TOKEN` as a local environment variable if `MIERUKA_API_TOKEN` is unset.

In PowerShell, from this folder:

```powershell
$env:MIERUKA_API_TOKEN = Read-Host 'Railway API_TOKEN' -MaskInput
uv run run_all.py
```

In Bash or zsh:

```sh
printf 'Railway API_TOKEN: '
read -rs MIERUKA_API_TOKEN
printf '\n'
export MIERUKA_API_TOKEN
uv run run_all.py
```

At start it simulates a phone scan: `POST /api/atlas/provision` on the web app (`MIERUKA_WEB`, default `https://kizuna-temp.vercel.app`) registers a new device named `LAC-xxx` on a random mapped building (adapter `NABD-7xxx`), so it shows on the STEG Réseau map. It is kept in `data/device.json`; `--new-device` makes another. Then every reading goes plug → concentrator → Railway `POST /mesures` (`MIERUKA_ENDPOINT`, never the web app) → Vercel `/api/mesures`. The 3D room shows a QR of the adapter ID for the app's scanner.

Look for `cloud uplink OK via railway` in the concentrator logs. A Railway HTTP 401 indicates a missing or incorrect bearer token. The readings remain queued for retry. Railway controls delivery to Vercel via its `FORWARD_URL` variable.

If Vercel requires `MIERUKA_ADAPTER_KEY`, the simulator uses it for the separate device-registration request to Vercel. Railway uses that same key for its forwarding request. Keep this key separate from the Railway `API_TOKEN`.
