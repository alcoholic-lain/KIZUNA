# Kizuna

Kizuna is a Django hackathon template with five placeholder modules (M1–M5) and a shared core app. The working Mieruka V0 lives in the apps **M11–M15**; M1–M5 are reserved for teammates and remain placeholders. Team **Zero-Ichi**'s KIZUNA 2026 app is **Mieruka**: it helps each household see where its electricity goes, warns about waste before the bill, and gives STEG an anonymous overview. The prototype runs on simulated data, labelled as simulated on screen. The full module breakdown is in [k-mod/mieruka-00-index.md](k-mod/mieruka-00-index.md).

## Team and branding

- **App:** Mieruka (見える化, "visibility").
- **Team:** Zero-Ichi.
- **App icon:** [assets/mieruka/mieruka-app-icon-v8-rounded.svg](assets/mieruka/mieruka-app-icon-v8-rounded.svg) — v8 flat cartoon, `#CD181F` red background, pale yellow ring, red hat. Full-bleed PNG: [mieruka-app-icon-v8-fullbleed-1024.png](assets/mieruka/mieruka-app-icon-v8-fullbleed-1024.png).
- **Team logo:** [assets/mieruka/zero-itchi-fun-logo.svg](assets/mieruka/zero-itchi-fun-logo.svg) (static) and [assets/mieruka/zero-itchi-fun-logo-animated.svg](assets/mieruka/zero-itchi-fun-logo-animated.svg) (animated) — fox and berries. PNG: [zero-itchi-fun-logo-512.png](assets/mieruka/zero-itchi-fun-logo-512.png); animation page: [zero-itchi-animation.html](assets/mieruka/zero-itchi-animation.html).

## Modules (reserved, M1–M5)

These placeholder apps are kept for the team's own module work (branches `m1`–`m5`).

| Module | Function | Owner |
|---|---|---|
| M1 | Adapter and simulator (MIERUKA-xxxx IDs, `POST /mesures` readings, demo scenarios, offline mode) | Rust dev 2 |
| M2 | API and data (SQLite schema, pairing, alerts, rewards and STEG routes) | Rust dev 1 |
| M3 | AI anomalies (sliding-median rule, explanation, recommendation) | AI |
| M4 | User space and rewards (household screens, fair points for kWh avoided) | Member 4 |
| M5 | Back office (staff monitoring of every device, user, usage, alert and credit; STEG aggregates later) | Member 4 |
| M10 | User management (login with Google via django-allauth; staff access to the back office) | To assign |

## Project state

Mieruka V0 runs as one Django app (API + database) serving a React front end built with Vite.

| Layer | Stack |
|---|---|
| Front end (`frontend/`) | React 19, TypeScript, Vite 6, Tailwind CSS 4, Radix UI (shadcn-style components), Recharts, Motion, TanStack Query, React Router 7, qr-scanner (real camera scan), d3-geo (Natural Earth outline of Tunisia), Geist font |
| Back end | Django 5.2, SQLite locally, Turso on Vercel |
| Energy engine (`m11/model.py`) | Deterministic appliance model; energy = power × time, computed on demand; events (anomaly, fix, pause) stored as intervals; real adapter readings override the model |

| App | What is implemented | Log |
|---|---|---|
| kizuna (core) | React app hosting, auth and demo accounts, sourced Tunisia–Japan figures | [AI.log](kizuna/AI.log) |
| M11 | Energy model, demo controls, `POST /api/mesures`, adapter registry, seed | [AI.log](m11/AI.log) |
| M12 | Data model (installations, events, readings, alerts…) and read helpers | [AI.log](m12/AI.log) |
| M13 | Explainable anomaly rules on 5-second readings, forecast, recommendations | [AI.log](m13/AI.log) |
| M14 | Home, devices, history, STEG tariff bill, tokens, eco-score, solidarity, company | [AI.log](m14/AI.log) |
| M15 | STEG console: network map, buildings (meter equation), incidents, peak | [AI.log](m15/AI.log) |

Sourced figures: STEG residential tariff (01/05/2022), Tunisian household average 1,635.9 kWh/year (STEG survey 2019), Japanese household average 3,911 kWh/year (Ministry of the Environment, FY2023), Tunisian grid factor 0.468 kg CO₂/kWh (IEA). Adapters, households, buildings and collective meters are simulated and labelled as such.

Demo accounts (password `mieruka2026`) are listed on the login page.

## Development

See [DEV.md](DEV.md) to install and run the project.
The native Android client lives in `mobile/`; its test instructions are also documented in [DEV.md](DEV.md).
