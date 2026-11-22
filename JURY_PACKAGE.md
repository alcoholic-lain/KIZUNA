# Mieruka — Jury Package: Story, Use Cases & Theory

**Product:** Mieruka (見える化, "visibility") · **Team:** Zero-Ichi · **Event:** KIZUNA 2026 (ESPRIT · JICA · Tunisie–Japon, Water/Energy/Agriculture tracks) · **Repo:** `C:\Users\moonm\OneDrive\Desktop\KIZUNA` (branch `master`)

---

## 1. The one-sentence pitch

> Mieruka makes household electricity visible appliance by appliance, warns about waste before the bill arrives, and rewards every avoided kilowatt-hour — while giving STEG an anonymous, aggregated view of the grid.

---

## 2. The story (problem → solution → product)

### The problem: electricity is invisible

A Tunisian household receives one lump-sum bill at the end of the month. The bill arrives late and contains no breakdown: no per-appliance consumption, no time-of-use detail, no warning that the air conditioner is running at +74% above normal. Without feedback there is no behavior change, and waste is only discovered when the bill arrives — too late to act.

The same invisibility exists upstream: STEG sees aggregate load per building or region, but not which household or appliance drives the peak. Peak management and incident detection therefore operate blind.

### The insight

Visibility precedes change. If a household sees, in real time, that the living-room AC is drawing 917 W — 35%+ above its own sliding median — with a plain-language cause ("consigne trop basse or filtre encrassé"), a one-tap fix, and a verified kWh/token reward, waste becomes actionable before the bill.

Appliance-level metering via a **passive adapter** (no contact with 230 V mains, no modification of the device) makes the approach safe, honest, and deployable today. The QR code carries only an identifier; it measures nothing.

### The solution: Mieruka

A five-role energy-visibility platform built on one Django server and one database:

| Role | What it sees | What it does |
|------|-------------|--------------|
| **Foyer / Étudiant / Famille** | Live per-appliance W and kWh (today / month), bill estimate, eco-score, tokens | Pair adapters by QR, receive explainable AI alerts, apply fixes, claim challenges, redeem/donate tokens |
| **Entreprise** | Site-level 30-day kWh, CO₂, peak share, sponsored solidarity | Fund solidarity projects (TND contributions), track business equipment |
| **STEG** | Anonymous regional/building overview, meter equation, incidents, peak heatmap, adapter atlas | Drill region → building → pseudonymized household, resolve incidents, mask <10-household areas |

**Core promise:** see where every kilowatt-hour goes, fix waste before the bill, get rewarded for it, and let the utility manage the grid without ever seeing a name or address.

---

## 3. Theoretical foundations (what the jury needs to grasp)

### 3.1 Appliance-level visibility via a passive adapter

Each adapter meters one channel (one appliance). Pairing binds an adapter ID to an appliance in a household. Disaggregation is **by-installation, not by ML NILM**: because every tracked appliance carries its own adapter, attribution is certain — the dashboard never has to guess which appliance a watt belongs to.

The measurement contract is frozen: `POST /api/mesures {adaptateur_id, horodatage, watts, source}` with deduplication on (adapter, timestamp), batch up to 100, optional `X-Adapter-Key`. The prototype runs on **simulated data, labelled `source: "simulee"` everywhere on screen**. The same contract accepts real hardware readings once a serial bridge is connected (the one missing piece — see §9).

**Safety rule:** we never touch mains. The adapter is passive, unmodified, and cannot switch power off.

### 3.2 Explainable, rule-based AI (not a black box)

Module M3 (`m13/engine.py`) runs deterministic rules with full evidence:

| Rule | Trigger | Output |
|------|---------|--------|
| Overconsumption | 3 consecutive readings >35% above the appliance's sliding median (last 3 days) | Alert + cause + action + confidence + kWh/month avoided + evidence readings graph |
| Standby | Night average (01:00–06:00) >5 W on an idle appliance | "Multiprise à interrupteur" recommendation |
| Simultaneous use | ≥2 appliances >800 W and >2.5 kW total | "Décaler l'appareil le plus flexible" |
| Peak | Shiftable appliance >0.3 kWh in an hour, 18:00–22:00 | "Programmer après 22 h" |
| Goal | Month forecast > goal +5% | Objective alert with ratio |

Every alert carries: measured vs expected, écart, confidence %, plain-language cause and action, appliance category, and an "Appliquer la correction" button. Applying a fix creates a `SavingAction`, records verified kWh avoided, and mints tokens. **Mieruka never cuts power** — stated on screen.

Why rules, not ML: little training data, and every alert must be explainable and defensible to a jury and to a user. A transparent rule engine that admits its limits beats a fake-AI chatbot.

### 3.3 Behavioral economics: tokens & eco-score

- **Tokens:** 500 per kWh avoided vs the household's own reference, computed over the action window (24 h / 72 h for standby). Daily cap 400 tokens, renewed at midnight (Tunis time). Tokens are rewards only: a zero balance never limits electricity, and no code path can switch power off.
- **Eco-score 0–100** in four parts: Progress vs own 3-week baseline (max 40), standby share (max 25), actions taken (max 20), regularity — days under daily target (max 15).
- **Challenges:** `veille-zero` (night without standby), `sous-reference` (day under own reference), `soiree-douce` (<35% evening share), `atelier-pointe` (enterprise, no heavy load after 18:00).
- **Redemption:** catalog (LED bulbs −20%, switchable power strip, energy diagnosis) and solidarity donations (tokens or TND).

### 3.4 STEG tariff & bill estimation

The monthly bill uses the **STEG residential low-voltage tariff (barème since 01/05/2022)**, labelled as an estimate on screen, with source URL. CO₂ uses the IEA screening factor for the Tunisian grid: **0.468 kg/kWh**.

### 3.5 Tunisia–Japan context (sourced benchmarks)

| | Tunisie | Japon |
|---|---------|-------|
| Household kWh/year | 1,635.9 (2019) | 3,911 (2023) |
| Source | STEG household energy survey | Japan MOE household CO₂ survey |
| Focus | Appliance-level visibility, summer AC peak, vulnerable/rural households | Smart buildings, peak management, post-disaster resilience |

End-use shares (Tunisie 2019): cooking 28%, heating/water 21%, refrigeration 11%, TV 6%, AC 5%, lighting 4%, other 25%. AC and water heating are the high-wattage, shiftable targets — exactly what Mieruka surfaces first.

### 3.6 Privacy & honesty by design

- **Simulated data is labelled** `Simulé` / `source: simulee` on every screen; never presented as real measurement.
- **QR = identifier only**, measures nothing, carries no location by itself (location comes from an optional, consented phone GPS fix).
- **STEG view is pseudonymized:** households shown as `FY-xxxx`, no names/addresses, and regions with <10 households are masked (no aggregates leaked).
- **Weather forecast** (Open-Meteo, mission page) receives only the household's broad region coordinates — never building/GPS location — and is cached 30 minutes with a four-second timeout.
- **No real credentials in frontend:** OpenAI Realtime voice agent uses a short-lived server-minted token; explicit user consent before connection; no device-control tool; names, addresses, raw history excluded.

---

## 4. Use cases / user stories

Format: *As a [role], I want [goal] so that [benefit].*

### Household roles (foyer / étudiant / famille)

**UC-F1 — Pair an adapter.** As a household user, I want to scan a QR code (or enter `NABD-0003` manually) so that my physical adapter is recognized and its appliance appears on my dashboard.
- Flow: login → Devices → `+ Adaptateur` → camera scan or manual entry → adapter validated (`NABD-\d{4}`) → choose category/name/room → appears in dashboard.

**UC-F2 — See where each kWh goes.** As a household user, I want live per-appliance power (W) and today/month kWh so that I know which appliance wastes and how much it costs.
- Dashboard: live W updating ~every 2.5 s, today kWh + estimated cost, monthly forecast vs goal, estimated STEG bill (DT), tokens, eco-score, device list with anomaly badges.

**UC-F3 — Be warned before the bill.** As a household user, I want an explainable anomaly alert with evidence so that I understand the cause and can fix it.
- Alert panel: measured vs expected, écart, evidence readings graph (5 s samples), cause, action, confidence %, "Appliquer la correction".

**UC-F4 — Fix waste and get rewarded.** As a household user, I want to apply a recommendation and see verified savings plus tokens so that good behavior is reinforced.
- Applying a fix creates a `SavingAction`; live graph shows consumption drop; verified kWh → tokens (500/kWh, daily cap 400); eco-score updates.

**UC-F5 — Track progress and redeem.** As a household user, I want my eco-score, challenges, token ledger and catalog so that I can gamify saving and turn tokens into equipment or donations.
- Rewards page: balance/today/cap/renewal, eco-score ring + 4 parts, challenges, catalog redeem, solidarity donations, 30-item ledger + 14-day daily chart.

### Étudiant (extends foyer)

**UC-E1 — Campus studio context.** As a student, I use the same household tools in a studio within a campus building (BAT-SOU-01, Sousse), with student-appropriate challenges (`veille-zero`, `soiree-douce`).

### Famille (extends foyer)

**UC-Fam1 — Shared household goal.** As a family member, I see a shared household aggregate, multiple installations, a family monthly goal, and solidarity pooling so the whole household saves together.

### Entreprise

**UC-Ent1 — Site-level visibility.** As an enterprise user, I want 30-day kWh, CO₂, peak share and sponsored solidarity so I can report and reduce my site's footprint.
- Company page: business installations (compresseur, machine industrielle, éclairage pro, serveurs), 30-day totals, CO₂, peak-share, contribution to solidarity projects.

**UC-Ent2 — Sponsor solidarity (TND).** As an enterprise, I can contribute dinars (not tokens) to solidarity projects; household users donate tokens. Labelled simulated payment.

### STEG (utility)

**UC-ST1 — Anonymous national/regional overview.** As a STEG analyst, I want an aggregated view (overview, buildings, peak, incidents) with no personal data so I can manage the grid while respecting privacy.
- Meter equation: meter = monitored adapters + untracked uses + common areas. Regions with <10 households → `masked: true`, no aggregates.

**UC-ST2 — Drill region → building → household.** As a STEG analyst, I want to drill from region to building to pseudonymized household (`FY-xxxx`) so I can locate anomalies without identifying individuals.

**UC-ST3 — Incident management.** As a STEG analyst, I want an incident list, resolve action, and peak heatmap so I can act on network-wide drift.
- `steg/incidents`, `resolve`, `steg/peak`, atlas of ~1,000 simulated adapters on Tunisian building footprints.

### Cross-cutting

**UC-X1 — Guided demo.** An 8-step coach-mark walks the jury through: switch role → scan NABD-0003 → scenario clim → alert → apply → rewards → STEG → compare, with a reset button. De-risks the live pitch.

**UC-X2 — Role switching (demo only).** Five demo accounts (foyer/étudiant/famille/entreprise/steg), password `mieruka2026`, switchable in one session for the pitch. Real accounts keep one fixed role.

**UC-X3 — Backup/demo resilience.** If hardware or network fails, run the `sim` scenario purely via API; a pre-recorded, labelled backup video covers the same flow.

---

## 5. The demo story (4-minute pitch script)

| Time | Part | What the jury sees |
|------|------|-------------------|
| 0:00–0:20 | Hook | Landing: "L'électricité est invisible. La facture arrive trop tard." One aggregate number ≠ actionable info. |
| 0:20–0:50 | Problem | Who: a Tunisian household. Why it matters: late bill, no breakdown, waste discovered too late. Evidence: STEG 2019 survey, AC share. |
| 0:50–1:20 | Solution | Mieruka: adapter → live per-appliance W/kWh → explainable alert → one-tap fix → tokens → STEG anonymous view. |
| 1:20–2:20 | Live demo | Login demo foyer → scan/enter `NABD-0003` → dashboard live W, today kWh, tokens, eco-score ("Simulé" label visible) → trigger anomaly (AC +74%) → alert with evidence → apply fix → graph drops, tokens rise. |
| 2:20–2:45 | Innovation & impact | Rule-based explainable AI with confidence + evidence; token formula 500/kWh shown on screen; STEG tariff sourced; "Mieruka ne coupe jamais l'alimentation." |
| 2:45–3:00 | Closing | "Nous n'avons pas construit un autre tableau de bord. Nous avons construit un outil de décision qui transforme chaque watt en action — avant que la facture n'arrive." |

Screens shown: Login, Devices (QR), Home (LiveArea chart, device chips), AlertPanel (measured vs expected), Rewards (token ring), STEG (Tunisia map, buildings, incidents).

---

## 6. Technical theory (architecture in one page)

**Stack:** Django 5.2 (Python 3.14+) monolith · React 19 + Vite + Tailwind 4 SPA · SQLite locally / Turso on Vercel · django-allauth + Google OAuth · React Router · TanStack Query · Recharts · Leaflet.

**Data model (single source of truth, `m12/models.py`):**
`Region → Building → Household → Profile(role) → Adapter(NABD-xxxx) → Installation(appliance, room, category) → Reading(watts, source) → Alert(kind, cause, action, confidence, evidence) → SavingAction → TokenTx → ChallengeEntry / SolidarityProject / Contribution / LearningProgress`. `SimState` drives the demo clock. A parallel `m2` model set serves only the legacy `/m5/` template back office (currently broken — see §9).

**Deterministic energy model (`m11/model.py`, `m11/profiles.py`):** catalog of 18 appliance profiles with W/standby/duty/hourly probability; Tunisia UTC+1; weather factor for heating/AC loads; `power_at()` is a pure function of adapter, seed and simulated minute — so history, live ticks and forecasts stay consistent. Nothing switches mains power.

**Measurement contract:** `POST /api/mesures` accepts single object or batch (≤100), deduplicates on (adapter, timestamp), returns `acquittees/stored/duplicate`. Same contract used by the Node.js headless simulator (`m1/simulator/server.mjs`, port 8787) and ready for a Python serial bridge → Arduino.

**AI (`m13/engine.py`):** explainable rules above; forecast = weighted 7-day average + trend clamp; habits = 14-day hourly appliance shares; recommendations priced in kWh/TND/CO₂ using the STEG tariff and IEA factor.

**Rewards (`m14/rewards.py`):** 500 tokens/kWh avoided vs baseline; daily cap 400; eco-score 4 parts; challenges verified on measurements.

**STEG back office (`m15/aggregates.py`):** overview, buildings (meter equation), pseudonymized households, incidents, peak, regions with <10-household masking. All `require_steg` guarded.

**Roles:** `foyer / etudiant / famille / entreprise / steg`. One role per profile; STEG has no household. Frontend routes are role-gated (`Guard`). Demo switching only among the five hard-coded demo accounts.

**Honest framing:** all energy values are computed by the deterministic simulator unless real `Reading` rows exist; simulated values are labelled `simulee`. No real hardware is connected yet (serial bridge is the P0 gap).

---

## 7. Jury Q&A — anticipated questions and answers

**Q: Why rule-based AI instead of machine learning?**
A: Two reasons. First, little historical data in a hackathon prototype, so a model would be unverifiable. Second, every alert must be explainable: a user — and a jury — deserves to know *why* an alert fired, with measured vs expected and evidence readings. Rules give that; a black-box score doesn't. We evaluate against a simple baseline (sliding median) and our tests prove the 3-reading rule fires correctly without false alerts on 2 readings.

**Q: Is the data real or simulated?**
A: All energy values in the demo are **simulated and labelled `Simulé`** on every screen. The measurement contract (`POST /api/mesures`) is identical for real and simulated data, so the same dashboard accepts hardware readings the moment a serial bridge is connected. We never present simulation as reality.

**Q: Can Mieruka cut off someone's power?**
A: No, and it is designed never to. The adapter is passive — no contact with 230 V mains, no modification. "Mieruka ne coupe jamais l'alimentation" is stated on screen. Tokens are rewards only; a zero balance never limits electricity.

**Q: Do you have STEG's or JICA's endorsement?**
A: No. Partner images (ESPRIT, JICA, Association Tunisie-Japon) appear on the landing as visual context only, with no endorsement claim. The Tunisie–Japan benchmark uses publicly sourced figures (STEG 2019 survey, Japan MOE 2023), each cited with a URL.

**Q: What is the measurable impact?**
A: Per avoided kWh: 500 tokens, CO₂ = kWh × 0.468 kg (IEA), cost = kWh × STEG tariff average price. Alerts carry a kWh/month avoided estimate. Challenges verify savings on measurements. These are simulated estimates with documented assumptions — clearly separated from real-world results, per the playbook's rule: cite real data or label simulations.

**Q: What happens if the model / hardware fails on stage?**
A: Three layers: (1) the live Django app runs locally on the demo machine (localhost, no internet dependency for the core flow), (2) the `sim` scenario reproduces the full alert flow purely via API, (3) a pre-recorded, labelled backup video plays if everything else fails. We never pretend a recording is live.

**Q: How does STEG see data without violating privacy?**
A: Pseudonymized household codes (`FY-xxxx`), no names/addresses, region-level masking below 10 households, and read-only aggregated APIs. STEG analysts can resolve incidents and drill building → household, but never identify an individual.

**Q: What is the business model / cost?**
A: Out of scope for the hackathon, but the architecture is deliberately cheap: one server, one database, no external services (Open-Meteo weather is optional and key-free), passive adapters. Tokens are an in-app reward, not currency.

**Q: Who would actually use this?**
A: Tunisian households wanting to cut bills before they arrive; students in campus housing; families sharing a goal; enterprises reporting site footprint; and STEG for anonymous grid oversight. The adapter works in any environment, not only homes.

**Q: What would you build next?**
A: (1) the Python serial bridge + Arduino 2-channel sketch so the physical adapter drives the live dashboard (the current P0 gap), (2) port/channel modelling (PORT 01 vs PORT 02), (3) the children's energy-education tier, (4) optionally a lightly labelled consumption-prediction proof of concept.

---

## 8. Honest framing for the jury (risks & limitations, presented as managed transparency)

| Item | Status | How we frame it |
|------|--------|-----------------|
| Energy data | Simulated, labelled `simulee` | A feature, not a cover-up: we measure nothing we cannot verify, and the same contract accepts real hardware |
| Hardware → website | Serial bridge not yet built | Contract (`POST /api/mesures`) is implemented and tested; the bridge is a 4–6 hour, well-defined integration |
| `/m5/` template back office | Broken (`m2/models.py` empty) | The working STEG view is the React `/app/steg/*` via the `m15` API; `/m5/` is avoided in the demo |
| Adapter ID format | Docs `MIERUKA-xxxx` vs DB `NABD-xxxx` | Alignment is a 1-hour fix; the demo uses the DB format on screen |
| Children's section | Generic quiz + game only, not age-tiered | Explicitly out of MVP per scope rules; a P2 addition |
| Google OAuth | Not configured locally | Demo accounts (`mieruka2026`) bypass it entirely for the pitch |

**Bottom line for the jury:** this is a complete, tested, end-to-end digital product (67 Django tests pass, `manage.py check` clean, guided demo de-risks the pitch) with an honest, explainable AI and a clear, small path to a working physical-digital demo. It is a strong finalist; with the hardware bridge live, it is a top-3 contender.

---

## 9. Deliverable locations in the repo

- Pitch/demo script: `DEV.md` §11 (end-to-end demo plan, 3–5 minutes) and this document
- Story/scope: `k-mod/mieruka-00-index.md` and `k-mod/mieruka-09-plan-and-pitch.md`
- Full audit (strengths, gaps, jury scoring): `KIZUNA_FULL_PROJECT_AUDIT.md`
- 3D experience audit & opportunity map: `MIERUKA_3D_EXPERIENCE_TECHNICAL_AUDIT.md`
- Hackathon playbook (jury psychology, pitch structure, Q&A): `SUBJECT/kizuna-2026-playbook.html`
- Code: `kizuna/` (core), `m11/` (model/simulator), `m12/` (data model), `m13/` (AI), `m14/` (rewards/tariff), `m15/` (STEG), `frontend/` (React SPA), `mobile/` (Android WebView), `k-mod/mieruka_demo.ino` (Arduino reference)
