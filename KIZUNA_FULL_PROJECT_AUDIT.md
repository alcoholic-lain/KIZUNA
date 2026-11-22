# KIZUNA_FULL_PROJECT_AUDIT.md

**KIZUNA 2026 — Smart Energy — Full Project Audit**
Senior Software Architect + AI/ML Engineer + Product Designer + Hackathon Jury
Repository: `C:\Users\moonm\OneDrive\Desktop\KIZUNA` (branch `master`; `mieruka-v0` is an older predecessor state)
Inspection method: read-only source inspection + live server verification (Django `runserver`, every JSON API endpoint called, anomaly flow triggered end-to-end, `manage.py test`).

---

## 1. EXECUTIVE SUMMARY

**What the project currently is**
A Django 5.2 monolith ("Mieruka" / team Zero-Ichi) serving a React 19 + Vite + Tailwind single-page application, plus a handful of placeholder module apps (m1–m5, m10) and a separate Android WebView client (`mobile/`). The energy domain is split across apps m11–m15: a deterministic appliance energy model, a full data model, explainable anomaly rules, a token/eco-score/rewards system, a STEG tariff bill estimator, and a STEG backoffice API. A physical passive two-outlet adapter, Arduino UNO, sensors, and a 3D prototype HTML exist, but **none of the hardware is connected to the website**.

**What works (verified live)**
Authentication/demo accounts, QR adapter registration (check/registry/pair), appliance pairing/unpairing, real-time dashboard (live power updated every ~2.5 s, 15 s series), per-appliance consumption (W, kWh today/month, baseline, threshold), history/analytics (day/week/month/year/custom), explainable anomaly detection (3-reading rule with evidence and confidence), contextual recommendations, verified savings → tokens, eco-score, STEG tariff bill, solidarity donations, company view, Tunisia–Japan benchmark, energy flows (Sankey), STEG backoffice API (overview/buildings/households/incidents/peak), guided demo, and a working hardware-intake contract (`POST /api/mesures`). **67/67 Django tests pass; `manage.py check` is clean.**

**What does not work / is missing**
- The `/m5/` Django-template backoffice is **broken at runtime**: `m5/views.py` imports `Adaptateur, Alerte, Mesure, Recompense, Utilisateur` from `m2.models`, but `m2/models.py` is empty (docstring only) → `ImportError`.
- **No hardware integration**: no Python USB-serial bridge, Arduino is not wired to the backend, `k-mod/mieruka_demo.ino` is standalone (uses `MIERUKA-0004`, prints JSON to serial only). DHT11, ultrasonic, buttons, buzzer, OLED, LCD are not connected to the website.
- The physical adapter is passive and unmodified; all power/energy values are **simulated** and labelled `simulee`. No real current sensing exists and none should be added (230 V safety).
- No age-based children's section (the `Apprendre` page is a generic quiz + "energy vampires" game, not age-specific).
- Social impact is a proposed, labelled-simulated model (fictive partners), not a real agreement.
- No ML/training pipeline; intelligence is rule-based by design (documented, defensible).
- Adapter ID inconsistency: docs say `MIERUKA-xxxx`; database uses `NABD-xxxx`.
- Google OAuth is not configured locally (demo accounts used instead); sign-in page reports "Google sign-in not configured".

**Maturity level**: **Demo-ready core user journey works end-to-end in the browser**, but the physical-demonstration half (hardware → website) and several agreed product features are missing or partial. Credibility risk if the jury expects the physical adapter to drive the screen.

**Biggest strengths**: complete, tested, coherent end-to-end digital product; explainable (not black-box) AI; transparent token formula with sources; STEG backoffice with privacy masking; polished, consistent UI; guided demo that de-risks the live pitch.

**Biggest weaknesses**: no real hardware-to-website link (the central physical demo story is not demonstrable), broken `/m5/` backoffice, docs/DB ID mismatch, simulated data must be carefully labelled to avoid overclaiming, no children's section, no consumption-prediction model.

---

## 2. COMPLETE PROJECT INVENTORY

### Backend (Django, `config/` + apps)

| File | Role |
|------|------|
| `manage.py` | Django entry; loads `.env.local` unless `VERCEL` |
| `config/settings.py` | Settings: SQLite (local) / Turso (Vercel), allauth + Google OAuth, blob storage, demo controls, adapter key, STAFF emails |
| `config/urls.py` | Root URLconf: admin, allauth, `/api/`, `m1/–m5/`, `m10/–m15/`, `kizuna` SPA |
| `config/api_urls.py` | All JSON API routes (auth, live/sim/mesures/adapters, AI/alerts/recommendations, home/devices/history/rewards/solidarity/company/flows, STEG) |
| `config/db_backends/` | Turso (libsql) database backend |
| `config/blob_storage.py` | Private Vercel Blob storage |
| `config/asgi.py`, `config/wsgi.py` | ASGI/WSGI entrypoints |

**`kizuna/` (core app)**
- `kizuna/views.py` — SPA serving (`spa` renders React from `assets/app/`), module placeholder page, `/modules/` landing
- `kizuna/urls.py` — `/`, `/modules/`, `/login`, `/app/*` → SPA
- `kizuna/api.py` — `auth/me`, `auth/login`, `auth/demo`, `auth/logout`, `auth/register`, `profile`, `benchmark`, `learn`, `learn/complete`
- `kizuna/apiutils.py` — `ApiError`, `api()` decorator (JSON in/out, CSRF, demo seeding, error handling), `household_of`, `profile_of`, `require_steg`, `ensure_seeded`
- `kizuna/benchmarks.py` — sourced Tunisie vs Japon figures
- `kizuna/tests.py` — LAN-address / kizunaserver command tests
- `kizuna/AI.log`, `kizuna/screenshots/`

**`m11/` (energy model + simulator + adapter registry)**
- `m11/model.py` — `Spec`, `power()`, `day_hourly()`, `baseline()`, deterministic 5 s model, events as intervals, real-reading override, `now()` driven by `SimState` demo clock
- `m11/profiles.py` — `CATALOG` (16 appliance types with W/standby/shape), `USER_CATEGORIES`, TN timezone (UTC+1), `noise()` deterministic PRNG, `weather_factor`
- `m11/seed.py` — `reset_demo()`: regions, buildings, 5 demo households + background households, adapters `NABD-xxxx`, demo accounts (`mieruka2026`), events, alerts, tokens, solidarity projects; `DEMO_ACCOUNTS`, `STOCK`
- `m11/api.py` — `live`, `sim` (demo controls + scenarios), `mesures` (hardware intake contract), `adapter_check`, `registry`
- `m11/views.py` — redirect to `/app/appareils?ajouter=1`
- `m11/management/commands/mieruka_reset.py` — reseeds demo dataset
- `m11/tests.py` — model + contract tests

**`m12/` (data model — ALL domain models live here)**
- `m12/models.py` — `Region, Building, Household, Profile, Adapter, Installation, Event, Reading, Alert, SavingAction, TokenTx, ChallengeEntry, SolidarityProject, Contribution, LearningProgress, SimState`
- `m12/data.py` — `installations()`, `pairs()`, `matrix()`, `live_power()`, `label()`, `fr()`, CO₂ factor (0.468 kg/kWh, IEA)
- `m12/views.py` — redirect to `/app/analyse?t=historique`
- `m12/migrations/0001_initial.py` — creates all m12 tables

**`m13/` (AI: anomalies, forecast, recommendations)**
- `m13/engine.py` — explainable rules: overconsumption (3× >35% above sliding median), standby (1–6 h >5 W), simultane (≥2 appliances >800 W, >2.5 kW), peak (shiftable >0.3 kWh 18–22 h), objective (month forecast > goal +5%); `forecast()`, `habits()`, `recommendations()`, `scan_background()` (STEG incidents)
- `m13/api.py` — `ai` (alerts/forecast/habits/recommendations/price), `alert_detail`, `alert_apply`, `alert_ignore`, `reco_apply`
- `m13/tests.py` — anomaly rule tests (3 readings raise 1 alert; 2 readings don't; moderate increase ignored; forecast consistency)

**`m14/` (household space, rewards, tariff, solidarity)**
- `m14/services.py` — `live()`, `home()`, `device_row/detail/update/unpair`, `history()`, `flows()`, `solidarity()`, `donate()`, `contribute()`, `company()`, `validate()` (adapter pairing), `pair()`, `alert_json()`
- `m14/rewards.py` — `TOKENS_PER_KWH=500`, `DAILY_CAP=400`, `savings()` (verified kWh avoided), `ledger()` (balance/today/cap/renewal), `eco_score()`/`score_bundle()` (4 parts, 0–100), `apply_code()`/`apply_alert()` (efficiency/standby_cut/decaler events → SavingAction), challenges (`veille-zero`, `sous-reference`, `soiree-douce`, `atelier-pointe`), `CATALOG` (LED/multiprise/diagnostic rewards)
- `m14/tariff.py` — STEG residential low-voltage tariff (barème 01/05/2022), with source URL, labelled estimate
- `m14/api.py` — `home`, `devices`, `device`, `history`, `rewards`, `redeem`, `challenge`, `solidarity`, `company`, `flows`
- `m14/tests.py` — tariff bands, rewards, daily cap, score bounds, zero-tokens no power change

**`m15/` (STEG backoffice API)**
- `m15/aggregates.py` — `overview()`, `buildings()`, `building()`, `household()`, `regions()` (masking <10 households), `peak()`, `incidents()`, `resolve()`, `ticker()`, `incident_json()`
- `m15/api.py` — `steg/overview`, `steg/buildings`, `steg/buildings/{code}`, `steg/households/{code}`, `steg/peak`, `steg/incidents`, `steg/incidents/{aid}/resolve` (all `require_steg`)
- `m15/tests.py` — region masking, meter equation, fault-building drift, role guard + no names leaked

**`m10/` (user management / auth)**
- `m10/views.py` — sign-in page (`/m10/`), `google_ready` flag
- `m10/adapters.py` — allauth adapters: local signup closed, Google signup open, staff granted via `MIERUKA_STAFF_EMAILS`
- `m10/management/commands/ensure_admin.py` — creates first admin from env
- `m10/templates/m10/index.html`

**`m1–m5` (team modules — placeholders)**
- `m1/views.py`, `m2/views.py`, `m3/views.py`, `m4/views.py`, `m5/views.py` — `m1–m4` render `module_page` stubs; **`m5/views.py` is BROKEN** (imports non-existent `m2.models` classes)
- `m5/templates/m5/*.html` — Django-template backoffice (index, devices, users, user_detail, alerts, credits, `_chart`, `_pager`, base, forbidden) — unreachable/broken due to missing models

### Frontend (React, `frontend/`)

| File | Role |
|------|------|
| `frontend/src/App.tsx` | Routing: `/`, `/login`, `/app/*` guarded by role; home/appareils/analyse/recompenses/explorer/flux/apprendre/profil/comparer/entreprise/steg/* |
| `frontend/src/main.tsx` | QueryClient, Toaster, theme, BrowserRouter |
| `frontend/src/lib/api.ts` | `api()` fetch wrapper (CSRF cookie, `X-CSRFToken`, `/api/` prefix), TanStack Query client, `useApi`, `useAction` |
| `frontend/src/lib/session.ts` | `useMe`, `homeFor`, `useSwitch` (demo accounts), `useLogout` |
| `frontend/src/lib/categories.ts` | `CAT` (color/icon per appliance), `codeOfLabel` |
| `frontend/src/lib/format.ts` | `n`, `kwh`, `watts`, `tnd`, `pct`, `time`, `day`, `ago`, `change` |
| `frontend/src/lib/demo.ts` | `DEMO_STEPS` (8-step guided demo titles) |
| `frontend/src/lib/utils.ts` | `cn` |
| `frontend/src/components/Shell.tsx` | Sidebar + top + bottom nav, `LiveDot` sim/reelle indicator, `AccountMenu` (demo switching, theme, logout) |
| `frontend/src/components/AlertPanel.tsx` | `AlertRow`, `AlertPanel` dialog (measured vs expected, evidence readings graph, apply/ignore, "never cuts power") |
| `frontend/src/components/charts.tsx` | `LiveArea`, `Bars`, `Lines`, `Donut`, `Spark`, `Ring`, `Legend` (recharts) |
| `frontend/src/components/ui.tsx` | shadcn-style Button, Card, Badge, Dialog, Tabs, Switch, Input, Field, Progress, AnimatedNumber, Delta, Stat, LiveDot, Skeleton, Empty, PageHeader, Tip/InfoTip, SEVERITY_TONE/LABEL |
| `frontend/src/components/ErrorBoundary.tsx` | Route-level error boundary |
| `frontend/src/components/DemoGuide.tsx` | Guided 8-step demo (switch role → scan NABD-0003 → scenario clim → alert → apply → rewards → STEG → compare), reset button |
| `frontend/src/pages/Landing.tsx` | Landing: ticker, features, partner logos (Esprit, JICA, Association Tunisie-Japon — images only, no endorsement claim) |
| `frontend/src/pages/Login.tsx` | Demo account picker, login/register, shows demo password |
| `frontend/src/pages/Home.tsx` | Dashboard: live power, today kWh + cost, monthly forecast + goal, estimated STEG bill, tokens, eco-score, savings, device list, AI alerts, hourly today vs yesterday |
| `frontend/src/pages/Devices.tsx` | Device cards, QR camera scanner (`qr-scanner`), QR code generation (`qrcode`), adapter registry, pair form, device detail sheet (readings graph, baseline/threshold, daily, monitoring toggle, unpair) |
| `frontend/src/pages/Insights.tsx` | AI alerts (open/past), advice (recommendations with apply button), history (day/week/month/year/custom + comparison), forecast (month projection + goal line) |
| `frontend/src/pages/Rewards.tsx` | Tokens balance/today/cap/renewal, eco-score ring + parts, challenges, catalog redeem, solidarity donations, ledger history |
| `frontend/src/pages/Explore.tsx` | Compare (Tunisie–Japon), Flows (Sankey SVG), Learn (vampires game + 3-question quiz, tokens on complete), Profile |
| `frontend/src/pages/Company.tsx` | Enterprise view: 30-day kWh, CO₂, peak share, solidarity sponsored, projects financing |
| `frontend/src/pages/Steg.tsx` | `StegNetwork` (Tunisia map + regions), `StegBuildings`, `StegBuilding` (meter equation = monitored + untracked, per-household), `StegHousehold`, `StegIncidents`, `StegPeak` |
| `frontend/package.json` | React 19, Vite 6, Tailwind 4, Radix UI, Recharts, Motion, TanStack Query, React Router 7, qr-scanner, qrcode, d3-geo, world-atlas, Geist fonts |
| `frontend/vite.config.ts` | Build → `../assets/app` (committed), proxy `/api` and `/static` to `:8000` in dev |
| `assets/app/` | Committed built React app (served by Django in production) |

### Other
- `k-mod/` — design specs (`mieruka-00-index.md … 09-plan-and-pitch.md`) and `mieruka_demo.ino` (Arduino sketch, standalone, serial JSON only)
- `assets/3d/prototype.html` — standalone 3D adapter visualization (Three.js), simulated data, **not integrated** with the website
- `assets/kizuna/`, `assets/mieruka/` — brand assets (logos, partner images)
- `SUBJECT/` — KIZUNA 2026 playbook + team workspace HTML + photos
- `mobile/` — Android WebView client (Kotlin, Gradle), packaged APK CI, discovers Django via mDNS/LAN, falls back to `https://kizuna-temp.vercel.app/`
- `kizuna-loader.html`, `kizuna-2026-asset-sheet.html`, `DEV.md`, `README.md`, `run-kizuna.ps1`, `dj.sh`, `pyproject.toml`, `uv.lock`, `.env.example`, `.gitignore`
- `db.sqlite3` — local database (gitignored)

### Branch note
`mieruka-v0` is an older state (HEAD `6f40b49` "Build the Mieruka V0 in m11–m15 and keep m1–m5 as placeholders"). `master` is ahead of it (adds Google login M10, M5 backoffice, brand assets, Vercel APK pipeline, etc.). Current checkout is `master`.

---

## 3. CURRENT FUNCTIONALITY MATRIX

| Feature | Status | Evidence | Problems | Required action | Priority |
|---|---|---|---|---|---|
| A1 QR scanning (camera) | IMPLEMENTED AND WORKING | `Devices.tsx` `QrScanner`, `qr-scanner` package; camera permission fallback to manual entry | Needs camera permission on demo machine | Keep; test on demo hardware | P1 |
| A2 QR resolves to real adapter ID | IMPLEMENTED AND WORKING | `GET /api/adapters/check?id=` returns `{id}`; validates `NABD-\d{4}`; 404 unknown, 409 already paired | Docs say `MIERUKA-xxxx`, DB uses `NABD-xxxx` (inconsistency) | Align ID format in docs/DB | P0 |
| A3 Adapter registered in backend | IMPLEMENTED AND WORKING | `POST /api/devices` creates `Installation` linked to `Adapter` + `Household`; `registry` lists unpaired stock | One adapter → one appliance at a time (active installation) | Document single-channel pairing | P1 |
| A4 Associate appliances with channels | IMPLEMENTED AND WORKING | Pairing form: adapter ID + category + name + room; `Installation.category`/`name`/`room` | Port 01 vs Port 01 not modeled (no port_id column) | Add `port_id` (01/02) to Installation | P1 |
| A5 One user owns multiple adapters | IMPLEMENTED AND WORKING | `Household` has many `Installation`s; adapter has many `Installations` (history) | Demo pairs 5 adapters per household | None | P1 |
| A6 Distinguish PORT 01 vs PORT 02 | MISSING | No `port_id` anywhere; adapter treated as single channel | Physical adapter has 2 outlets | Add port field + two-channel device model | P1 |
| B1 Appliance: name/category/adapter/port | PARTIAL | name/category/adapter exist; no port | No port | Add port_id | P1 |
| B2 Estimated power (W) + energy (kWh) | IMPLEMENTED AND WORKING | `live.power`, `today_kwh`, `month_kwh`, source flag | All simulated; labelled | Keep labelling | P1 |
| B3 Operating status | IMPLEMENTED AND WORKING | `on` (power vs threshold), `monitoring` (pause) | None | None | P0 |
| B4 Historical consumption + trends | IMPLEMENTED AND WORKING | `device_detail` daily 30 days; `Insights` history; `ai.habits` | Simulated, labelled | None | P1 |
| B5 Abnormal-consumption indicators | IMPLEMENTED AND WORKING | `anomaly` flag on device + open `Alert`s | Rule-based, not ML | Keep (explainable) | P1 |
| C Real-time dashboard | IMPLEMENTED AND WORKING | `/api/live` refetch 2500 ms; 15 s series; power, today_kWh, tokens, score, savings, alerts | Simulated clock (`SimState` offset); numbers update dynamically | None | P0 |
| C1 Tokens today / balance / renewal | IMPLEMENTED AND WORKING | `rewards.ledger()`: balance, today, left_today, cap, renewal (midnight TN) | None | None | P0 |
| C2 Ecological score | IMPLEMENTED AND WORKING | `rewards.score_bundle()` score 0–100 + 4 parts + history | None | None | P0 |
| C3 Day/week/month consumption | IMPLEMENTED AND WORKING | `home()` forecast week/prev_week/month; `Insights` history tabs | None | None | P1 |
| C4 Energy-saving recommendations | IMPLEMENTED AND WORKING | `/api/ai` recommendations with kWh/TND/CO₂, applied flag, `reco_apply` | Contextual but rule-based | Enhance with behaviour profiling | P2 |
| C5 Connected appliances + consumption | IMPLEMENTED AND WORKING | Home device list + Devices detail | None | None | P0 |
| D History & analytics | IMPLEMENTED AND WORKING | `/api/history` (jour/semaine/mois/annee/perso) per-appliance stacked series + previous-period comparison | No hour-of-week heatmap, no appliance efficiency benchmarking | Add hour-of-week heatmap | P2 |
| E Anomaly detection | IMPLEMENTED (rule-based) | `m13/engine.py`: 3 consecutive readings >35% above baseline, evidence + confidence + cause + action; verified live (AC +74% → alert) | Not ML; hardcoded thresholds; no "active longer than expected" rule | Add duration rule; keep explainable | P0 |
| E1 Distinguish algorithmic vs hardcoded | N/A | All alerts are algorithmic (rules), with `evidence.rule`; some seeded demo alerts are hardcoded in `seed.py` (`cause="Historique"`) | Seeded historical alerts look real | Label seeded alerts | P1 |
| F Energy-saving recommendations | IMPLEMENTED | `reco_apply` creates `efficiency`/`standby_cut` events → `SavingAction`; verified savings → tokens | Generic category-based text, not per-user behaviour | Add usage-profile-based personalization | P2 |
| G Token balance | IMPLEMENTED AND WORKING | `ledger()` balance, earned, spent, today, cap 400/day, renewal | Tokens = computed, not stored per action (except fixed grants) | None | P0 |
| G1 Token calculation formula | IMPLEMENTED AND TRANSPARENT | 500 tokens/kWh avoided vs baseline; floor; daily cap; shown on screen | None | None | P0 |
| G2 Daily allocation / renewal | IMPLEMENTED AND WORKING | Renewal at midnight Tunisia time; `left_today` | None | None | P0 |
| G3 Reward history | IMPLEMENTED AND WORKING | `ledger.items` (last 30) + `daily` 14 days | None | None | P0 |
| G4 Eligibility rules | PARTIAL | Zero balance never cuts power; no code path switches power off; documented | Companies can't donate tokens (TND only); households donate tokens | Clarify | P2 |
| H Social impact | PARTIAL / VISUAL+MODEL | `SolidarityProject` + `Contribution` + `donate`/`contribute` APIs; fictive partners labelled; beneficiaries estimated | No real agreements; no corporate-benefit mechanism; not communicated on landing | Build company contribution flow + beneficiary counters (labelled simulated) | P2 |
| I Age-based educational section | PARTIAL / VISUAL | `Learn` page: 3-question quiz + "chasse aux vampires" game; `learn/complete` grants tokens | Not child-specific, no age tiers, no missions/progress beyond quiz completion | Add kid tier + missions + progress badges | P2 |
| J STEG backoffice | PARTIAL | React `/app/steg/*` via `m15` API: network map, buildings (meter equation), households (pseudonymised), incidents, peak | `/m5/` Django-template backoffice BROKEN (empty `m2/models.py`); React STEG is the working one | Fix or remove `/m5/`; rely on React STEG | P0 |
| J1 Admin / building / individual user | IMPLEMENTED (React) | `steg/overview`, `steg/buildings`, `steg/households/{code}`, `steg/incidents` | Requires staff/demo STEG account | None | P0 |
| K Physical hardware integration | MISSING (bridge not built) | `POST /api/mesures` contract exists and works; `mieruka_demo.ino` standalone serial JSON | No Python serial bridge; Arduino not connected; DHT11/ultrasonic/buttons/OLED/LCD not integrated; adapter passive | Build minimal Python serial bridge + Arduino sketch sending 2-channel JSON; OLED reflects state | P0 |

---

## 4. ARCHITECTURE ASSESSMENT

### Current architecture

```
[Browser: React SPA at /app]
      | HTTPS/same-origin (Vite dev proxies to :8000; prod: Django static)
      v
[Django 5.2] config/urls.py  →  app-specific urls → views/api
      |                                         |
      v                                         v
[SQLite db.sqlite3 (local)  /  Turso (Vercel)]   [allauth + Google OAuth]
      ^
      v
[m11/model.py] deterministic energy engine ← [m12/models.py] data model
```

**Data flow (intended hardware path, partially built):**
`Arduino UNO` → USB Serial → **Python bridge (MISSING)** → `POST /api/mesures` `{adaptateur_id, horodatage, watts, source}` → `Reading` → model overrides simulated power → React `/api/live` → dashboard.

**What is actually implemented vs intended:**
- `POST /api/mesures` (`m11/api.py`) — the intake contract is implemented, validated, deduplicated, with optional `X-Adapter-Key` (`MIERUKA_ADAPTER_KEY`). Working.
- Python serial bridge — **not implemented**. Nothing in the repo reads `/dev/ttyACM0` or `COMx`.
- Arduino sketch — `k-mod/mieruka_demo.ino` exists but is standalone: it simulates ONE air conditioner (`MIERUKA-0004`), prints JSON to Serial with millisecond timestamps (not ISO 8601), and does not match the `mesures` contract (`horodatage` field). Not connected.
- Physical adapter — passive, unmodified, not measuring. All W/kWh simulated.

**Gaps:**
1. No serial bridge (the single most demo-critical gap).
2. No port/channel modeling (adapter = single channel; physical adapter has 2 outlets).
3. m5 template backoffice broken (empty `m2/models.py`).
4. ID mismatch `MIERUKA-xxxx` (docs/Arduino) vs `NABD-xxxx` (DB/QR).

### Intended architecture (from k-mod specs)
One server, one SQLite database, no external services, Python AI rules called by API, labelled simulated data, QR = identifier only, no mains power cutoff. The current codebase matches this for the digital product; the hardware leg is absent.

### Mermaid diagram (intended)

```mermaid
flowchart LR
    subgraph Physical
    A[Arduino UNO<br/>DHT11 · Ultrasonic ·<br/>Buttons · OLED · LCD]
    end
    subgraph Bridge
    B[Python Serial Bridge<br/>reads JSON → POST /api/mesures]
    end
    subgraph Backend
    C[Django 5.2 + SQLite/Turso]
    D[m11 model<br/>deterministic W/kWh]
    E[m13 AI<br/>anomaly rules]
    F[m14 rewards<br/>tokens · eco-score]
    G[m15 STEG API]
    end
    subgraph Frontend
    H[React SPA /app<br/>dashboard · devices · insights · rewards · steg]
    end
    A -->|USB Serial (JSON)| B
    B -->|POST /api/mesures| C
    C --> D
    C --> E
    C --> F
    C --> G
    C --> H
    style B fill:#f96,stroke:#333
    style A fill:#f96,stroke:#333
```

Note: `B` (bridge) and the physical-to-digital link are NOT implemented — shown as the gap.

---

## 5. PRODUCT AND UX EVALUATION

### Strengths
- **Immediate clarity**: Landing states the value prop ("Voyez où part chaque kilowattheure"); demo accounts and password are shown on the login page; zero friction to start.
- **Guided demo**: `DemoGuide.tsx` walks the jury through the full story with one click per step and a reset button — significantly de-risks the live pitch.
- **Consistent, professional UI**: Tailwind design system, Geist typography, dark mode, Radix components, Recharts charts, motion transitions. Feels like a real product, not a student prototype.
- **Transparency**: Every screen shows "Simulé" / source; the token formula (500/kWh, cap 400/day) and STEG tariff source are shown on screen; "Mieruka ne coupe jamais l'alimentation" is explicit.
- **Role-aware UX**: household / entreprise / STEG / company each get a tailored shell navigation; STEG data is pseudonymised (`FY-xxxx`) with <10-household masking.
- **Responsive**: bottom tab bar on mobile, sidebar on desktop.

### Weaknesses
- **Onboarding not clear about simulation**: The landing says "données de démonstration simulées" only in the footer; a jury could mistake simulated watts for real measurements. Needs an explicit banner on first load.
- **QR flow is manual-entry friendly but camera scanning requires permission**: good fallback exists, but the "scan" flow's first step is a camera dialog that may fail on locked-down demo Wi-Fi machines.
- **No empty/loading polish on some STEG sub-pages**: `StegHousehold` shows skeletons only; incidents empty state exists.
- **The demo clock (`SimState` offset)** is powerful for rehearsals but confusing: the "live" time shown is offset from real time; a jury member checking their watch will see a mismatch.
- **No onboarding tutorial**: `homeFor` drops users straight at the dashboard; adding an adapter is discoverable (`+ Adaptateur`) but not explained.
- **Inconsistency**: `MIERUKA-xxxx` (spec/Arduino) vs `NABD-xxxx` (DB) will confuse anyone cross-referencing docs and screen.

### Specific recommendations
1. Add a first-load "Mode démo — toutes les valeurs énergie sont simulées" banner (dismissible), per the agreed labelling rule.
2. Add a short 3-step onboarding after first login: "Associez votre premier adaptateur" → points to `+ Adaptateur`.
3. Align adapter ID format (`NABD` vs `MIERUKA`) across docs, Arduino sketch, DB seed, and UI.
4. Display real time AND simulated time side-by-side in the shell when `SimState.offset_minutes != 0`.
5. Keep the guided demo; it is the best demo-risk mitigation in the repo.

---

## 6. TECHNICAL RISK ASSESSMENT

| Risk | Evidence / Location | Demo impact | Mitigation |
|------|---------------------|-------------|------------|
| No hardware→website link | No serial bridge; `mieruka_demo.ino` standalone; adapter passive | CRITICAL — central demo story cannot be shown | Build minimal Python serial bridge + Arduino 2-channel JSON sketch; pre-recorded backup video |
| `/m5/` backoffice broken | `m5/views.py` imports `m2.models.Adaptateur` etc.; `m2/models.py` empty | MEDIUM — STEG tab in React works, `/m5/` route 500s | Remove `/m5/` routes or stub `m2.models`; use React `/app/steg` |
| ID mismatch `MIERUKA`/`NABD` | specs vs DB seed | LOW — confusion during QR demo | Align to one format |
| CSRF token rotation after `auth/demo` login | Django rotates CSRF on login; frontend re-fetches `auth/me` | LOW — frontend handles it | Manual API tests must re-fetch token |
| Google OAuth not configured locally | `GOOGLE_CLIENT_ID/SECRET` empty → `google_ready=false` | LOW — demo accounts bypass it | Use `/api/auth/demo` for demo; don't rely on Google on stage |
| Simulated clock offset | `SimState.offset_minutes` shifts "now" | LOW — scenarios work any hour, but time looks off | Reset offset to 0 before demo (`sim` action `realtime`) |
| All energy simulated | `source: simulee` everywhere | MEDIUM — overclaiming risk | Keep "Simulé" labels; have backup video labelled as such |
| Single Chrome tab / session cookies | `useSwitch` changes role in one session | MEDIUM — switching foyer↔STEG mid-demo requires re-login | Use two browsers or two machines, or pre-login both |
| Network failure on stage | SPA proxies to :8000; no offline buffer in frontend (spec mentions it, not built) | HIGH — live demo dies if Wi-Fi dies | Run Django on the demo machine (localhost), pre-recorded video backup |
| `manage.py test` spawns kizunaserver (port 8001) side-effect | Observed during test run | LOW | Ignore; not demo-related |

**Demo-critical problems**: hardware bridge (missing), `/m5/` broken (avoid route), ID mismatch (confusing). All mitigable within the 25 h budget.

---

## 7. MISSING FUNCTIONALITY (AGREED, NOT IMPLEMENTED)

| Agreed item | Current state | Gap |
|---|---|---|
| PORT 01 / PORT 02 channel distinction | Not modeled | Add `port_id` to Installation; two appliances per adapter |
| DHT11 temperature + ultrasonic distance on website | Not connected | Serial bridge must forward these; UI tiles |
| Physical button → anomaly → website alert | Not connected | Bridge parses button JSON; triggers anomaly Event/Alert |
| OLED reflects website state | Not connected | Arduino updates OLED from serial/state |
| Age-based children's section | Generic `Learn` quiz + game | Kid tier, missions, progress badges |
| Real consumption prediction (ML) | Rule-based extrapolation only | Optional lightweight model (see Part 9) |
| Corporate STEG benefit mechanism | `Contribute` (TND) exists; no benefit/qualification logic | Propose model only, labelled |
| Offline data buffer in frontend | Spec'd, not built | Nice-to-have; video backup covers |

---

## 8. DIFFERENTIATION STRATEGY (TOP 3)

**1. Physical hardware → live website loop (demo impact: highest)**
- Originality: few teams will have a real Arduino + adapter on stage touching a live web dashboard.
- Feasibility: HIGH — the intake contract (`POST /api/mesures`) already exists; only the Python bridge + Arduino sketch are missing (~4–6 h).
- Jury impact: proves "real integration" and the passive-adapter honesty story (simulated values labelled).
- Demo: press anomaly button → Arduino → OLED → backend → website alert → STEG incident.

**2. Explainable, appliance-level AI with evidence (AI integration: highest)**
- Originality: most dashboards show aggregate charts; per-appliance anomaly with baseline, evidence readings, confidence %, cause, action, and verified kWh → tokens is unusual for a 25 h hackathon.
- Feasibility: HIGH — already implemented in `m13/engine.py` and verified.
- Jury impact: "AI that explains itself, not a black box." Avoids the fake-AI penalty.

**3. Tunisia–Japan context + social impact (social impact: high)**
- Originality: sourced cross-country comparison (STEG/IEA/Japanese MOE figures) + solidarity projects + solidarity scoring.
- Feasibility: MEDIUM — benchmark exists; social-impact UI exists as a proposed model.
- Jury impact: ties to JICA/ESPRIT partnership framing and the Tunisia–Japan theme without claiming official endorsement.

**Distractors to avoid (out of scope):** real 230 V modification, certified smart-plug hardware purchase, deep-learning model, native mobile features beyond the WebView, water/agriculture scope creep, claiming STEG/STEG endorsement or government partnerships.

---

## 9. AI/ML RECOMMENDATIONS

All are rule-based / lightweight; no deep learning (consistent with the project's documented decision: little data, every output must be explainable).

| # | Capability | Input | Output | Algorithm | Training data? | ≤25 h? | Demo | Evaluation |
|---|---|---|---|---|---|---|---|---|
| 1 | Appliance anomaly (already built) | 5 s power readings | Alert + cause + action + confidence + kWh-month | Sliding median + 3-consecutive rule | No (deterministic) | Yes (done) | Trigger via scenario button | Alert fires ≤ 3 readings; no false alert on 2 |
| 2 | Consumption forecast (already built) | Last 7–28 days daily kWh | Month kWh + low/high range + trend | Weighted average + trend clamp | No | Yes (done) | Show "fin de mois" vs goal | `month_kwh` within reasonable band |
| 3 | Appliance usage profiling | 14-day hourly matrix | Per-appliance kWh share, peak hour, evening share | Aggregation (already in `engine.habits`) | No | Yes (done) | "Journée type" bar chart | Shares sum to 100 % |
| 4 | Personalized savings (already built) | Profile + baseline | kWh/TND/CO₂ per recommendation | Savings = (reference − measured) × window | No | Yes (done) | Apply alert → savings/tokens update | Tokens increase after apply |
| 5 | Consumption prediction (optional) | Historical daily kWh | Next-day / next-week kWh | ARIMA or Prophet-lite (statsmodels) | Yes (28+ days) | Borderline (6–10 h) | Prediction line on history chart | MAE on held-out week |
| 6 | Anomaly ML (optional) | Per-appliance feature vectors | Anomaly score | Isolation Forest (scikit-learn) | Yes | Borderline | Compare rule vs ML side-by-side | Precision/recall on seeded anomalies |

**Recommendation:** Ship #1–#4 (already built, explainable). For #5, if time permits, use **clearly labelled synthetic data** for a controlled proof of concept: "Prévision (modèle léger, données d'essai)" — do not present it as real. Never present a fake-AI chatbot.

---

## 10. PRIORITIZED IMPLEMENTATION ROADMAP (≈25 h, 4 people)

### PRIORITY 0 — MUST FIX (demo credibility)
| # | Feature | Description | Deps | Time | Difficulty | Jury impact | Demo scenario |
|---|---|---|---|---|---|---|---|
| P0-1 | Python serial bridge | Read Arduino USB Serial JSON → POST `/api/mesures` | `mesures` API (done) | 4 h | Medium | High | Arduino data reaches website |
| P0-2 | Arduino 2-channel sketch | Two outlets (PC/phone charger), simulated W, DHT11 temp, ultrasonic distance, anomaly button → JSON to serial | Hardware | 5 h | Medium | High | Button press → screen alert |
| P0-3 | OLED displays channel info | OLED shows the two appliance powers/state | Arduino sketch | 2 h | Easy | Medium | OLET visible to jury |
| P0-4 | Fix `/m5/` or remove route | `m2/models.py` empty → `m5/views.py` ImportError | None | 1 h | Easy | Medium | Avoid broken URL |
| P0-5 | Align adapter IDs `MIERUKA`/`NABD` | Unify one format across docs, seed, Arduino, UI | None | 1 h | Easy | Low | QR code matches screen |
| P0-6 | Rehearsal + backup video | Record full demo; test on demo machine Wi-Fi | All above | 3 h | Easy | Critical | Backup if network fails |

### PRIORITY 1 — MUST IMPLEMENT (coherent product)
| # | Feature | Description | Deps | Time | Difficulty | Jury impact | Demo scenario |
|---|---|---|---|---|---|---|---|
| P1-1 | Port 01 / PORT 02 channel | Add `port_id` to Installation; two appliances per adapter in UI | DB migration | 2 h | Easy | Medium | Two appliances on one adapter |
| P1-2 | DHT11 temp + ultrasonic on website | Bridge forwards sensor JSON; UI tiles (live + history) | Bridge | 3 h | Easy | Medium | "Temp 24 °C · distance 12 cm" tiles |
| P1-3 | Explicit simulation banner | First-load dismissible "Mode démo — valeurs simulées" | None | 1 h | Easy | High | Jury sees honesty label |
| P1-4 | Onboarding: add first adapter | 3-step tooltip after first login | None | 2 h | Easy | Medium | New user pairs adapter |
| P1-5 | Hour-of-week heatmap | History view: hour × weekday | `matrix` data | 2 h | Easy | Low | Consumption pattern visible |

### PRIORITY 2 — HIGH-VALUE DIFFERENTIATORS
| # | Feature | Description | Deps | Time | Difficulty | Jury impact | Demo scenario |
|---|---|---|---|---|---|---|---|
| P2-1 | Kids' energy-education tier | Age-based simple explanations, missions, badges, progress | `learn` APIs | 5 h | Medium | High | Child completes "éco-mission", wins points |
| P2-2 | Social-impact module UI | Company contribution → beneficiaries counter; anonymized profiles | `solidarity`/`company` APIs | 4 h | Easy | High | "5 DT → 1 foyer équipé" counter |
| P2-3 | Duration-based anomaly | Appliance ON longer than expected | `engine.py` | 3 h | Easy | Medium | Radiator left on → alert |
| P2-4 | Consumption prediction (labelled synthetic) | Lightweight forecast on labelled synthetic data | History data | 6 h | Medium | Medium | "Prévision J+1 (essai)" line |

### PRIORITY 3 — OPTIONAL (only if time)
- Isolated-spike suppression tuning, more appliance types, export CSV, dark/light polish, more languages (Arabic), PWA installability.

### OUT OF SCOPE (do not attempt)
- Real 230 V current sensing or adapter modification (safety + we don't own sensors).
- Certified smart-plug hardware purchase/deployment.
- Deep-learning models, chatbots, LLMs.
- Claiming STEG/JICA/Esprit endorsement or official partnerships (images only on landing).
- Native mobile features beyond existing WebView.
- Water/agriculture scope creep.

**Time budget**: P0 ≈ 16 h, P1 ≈ 10 h, P2 ≈ 18 h → must choose P0 + part of P1 + at most one P2. Reserve ≥4 h for testing/rehearsal. Do not start P2 until P0 is solid.

---

## 11. END-TO-END DEMO PLAN (3–5 MINUTES)

### Roles
- **Presenter** — narrates, runs the website, speaks to jury.
- **Hardware operator** — handles Arduino, buttons, sensors, OLED.
- **Backend operator** — monitors API, ready to reset/sim if needed.
- **Backup/STEG operator** — switches to STEG backoffice, runs backup video if hardware fails.

### Script

| Time | Action | Screen / Hardware | What the jury sees |
|------|--------|-------------------|--------------------|
| 0:00–0:30 | Problem intro | Landing page | "Electricity is invisible; the bill arrives late." One aggregate number ≠ actionable info. |
| 0:30–1:00 | Physical adapter | Arduino + adapter + OLED | Two outlets: PC (port 01), phone charger (port 02). Passive adapter — no dangerous modification. |
| 1:00–1:30 | QR registration | Login (demo foyer) → Devices → `+ Adaptateur` → scan/enter `NABD-0003` | Adapter recognized; PC + charger appear in dashboard with names, rooms, categories. |
| 1:30–2:00 | Real-time dashboard | Home | Live W (updates every ~2.5 s), today kWh, tokens, eco-score, "Simulé" label visible. Two appliances listed with individual W/kWh. |
| 2:00–2:20 | Sensors | OLED / sensor tiles | DHT11 temperature and ultrasonic distance shown live on OLED and (if P1-2 done) website tiles. |
| 2:20–2:45 | Trigger anomaly | Hardware operator presses anomaly button | Arduino changes simulated state, OLED flashes red/buzzer, JSON to serial → backend → website alert: "Climatiseur salon +74 %" with cause, action, measured vs expected, confidence. |
| 2:45–3:00 | Recommendation + fix | Insights → Alerts → "Appliquer la correction" | Consumption drops on live graph; verified kWh and tokens increase; eco-score updates. "Mieruka ne coupe jamais l'alimentation." |
| 3:00–3:30 | STEG backoffice | Switch to STEG account → `/app/steg` | Building-level meter equation (monitored + untracked), incidents list, pseudonymised households (`FY-xxxx`), masking <10 households. |
| 3:30–4:00 | Social impact + close | Rewards / solidarity / Company | Token balance, eco-score, solidarity projects, beneficiaries counter; "simulated" labelling; vision statement. |

### What appears on each screen
- Login: demo accounts + password `mieruka2026`.
- Devices: QR scanner dialog + manual `NABD-0003` entry.
- Home: `live.power` AnimatedNumber, `LiveArea` series, device chips with anomaly badges.
- Alerts panel: measured vs expected vs écart, evidence readings graph (5 s), "Appliquer la correction" button.
- Rewards: token ring, balance, challenges, score parts.
- STEG: Tunisia map, buildings table, meter equation card, incidents dialog with rule + confidence.

### Backup plans
- **Hardware fails**: run the `sim` scenario (`clim`) purely via API; show the same alert flow without Arduino. Narrate "the bridge would send this JSON."
- **Network fails**: Django runs on localhost on the demo machine; SPA served from same origin. Pre-recorded 60-second video (labelled "enregistrement de démonstration") ready to play.
- **Demo data corrupt**: `mieruka_reset` reseeds in <1 s; `sim` action `reset` available in the DemoGuide.

---

## 12. FINAL JURY ASSESSMENT

Scoring as a demanding hackathon juror (1–10), against 113 other teams:

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Problem relevance | 8 | Real, specific problem (appliance-level visibility); Tunisia/Japan energy context is credible and well-scoped. |
| Innovation | 6 | Token incentives + explainable per-appliance AI are differentiated, but dashboard/QR/electricity-monitoring is a common hackathon pattern. |
| Technical depth | 7 | Real Django backend, deterministic energy model, tested (67 tests), STEG tariff with sources, anonymized STEG view. Hardware bridge is the missing depth. |
| AI integration | 6 | Rule-based, explainable, transparent — defensible and honest. Not ML, but the project admits it; better than fake AI. |
| Product quality | 8 | Polished, consistent UI; guided demo; role-based UX; responsive; loading/empty states; strong frontend craftsmanship. |
| Social impact | 6 | Solidarity model exists but is proposed/simulated; no real agreements; clearly labelled. Good idea, not yet proven. |
| Feasibility | 8 | Core digital product is finished and tested; remaining work (bridge, sketch) is small and well-defined. |
| Demo quality | 7 | Guided demo de-risks the pitch; hardware half unproven (bridge not built); simulated-data honesty is a strength if managed. |
| Scalability | 5 | SQLite single server; deterministic in-memory model; no real ingestion pipeline; Turso path exists for Vercel but untested at scale. |
| **Overall competitiveness** | **7.0** | Solid top-tier hackathon project; with a working hardware demo it could be top 3; without it, likely finalist but not winner. |

### Three reasons a demanding juror would SELECT this project for top 3
1. **Complete, end-to-end, tested product** — the user journey (QR registration → appliance monitoring → anomaly → recommendation → tokens → STEG view) genuinely works and is covered by 67 passing tests. Most hackathon projects are Figma mockups; this is running code.
2. **Honest, explainable AI** — anomaly detection comes with baselines, evidence readings, confidence scores, and plain-language causes/actions. A jury tired of "AI-powered" buzzwords will appreciate a transparent rule engine that admits its limits.
3. **Physical prototype integrity** — the team explicitly does *not* fake mains measurement: the adapter is passive, values are labelled simulated, and the honest "simulated" framing plus a real Arduino-to-web integration path is more credible than pretending a breadboard measures grid power.

### Three reasons a demanding juror might REJECT it
1. **The physical demo is not yet connected** — no Python serial bridge, Arduino not wired to the backend, and the passive adapter cannot demonstrate real consumption. If the pitch promises "hardware → website" and shows only simulated numbers, credibility collapses.
2. **Simulated-data overclaim risk** — nearly every watt/kWh on screen is simulated; if the presenters don't constantly reiterate "simulé," a juror will feel misled, which is fatal in a hackathon.
3. **Missing agreed product pieces** — no port/channel distinction (PORT 01 vs PORT 02), no children's section, broken `/m5/` backoffice, and `MIERUKA`/`NABD` ID inconsistency suggest the product is half-finished rather than demo-ready.

### Bottom line
This is a **strong finalist (7/10)** with a realistic path to top 3 **if and only if** the team spends the next hours on P0 (serial bridge + Arduino sketch + OLED + fix IDs + rehearsal) and presents the simulated-data framing as a feature, not a cover-up. Without the hardware link, it remains a very good web dashboard — respectable, but unlikely to win against teams with a working physical-digital demo.

---
*End of audit. Read-only inspection performed on branch `master` (current) with reference to `mieruka-v0`; no source files were modified.*