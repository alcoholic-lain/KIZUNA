# Mieruka pitch deck: design log

Five-minute jury deck for Mieruka (team Zero-Ichi) at KIZUNA 2026, Smart Energy.
Started 2026-11-22.

## Facts the deck relies on (checked in the source, 2026-11-22)

| Claim | Where it was checked |
|---|---|
| Overconsumption rule: 3 consecutive readings (5 s apart) > sliding median + 35 %, also above the appliance threshold and more than max(10 W, 8 % of the median) above it | `m13/engine.py` (`RATIO`, `STREAK`, `_scan`) |
| Usual level = median of in-use power over the 3 previous days, readings flagged anomalous excluded | `m11/model.py` `baseline()` |
| Five rules: overconsumption, standby (1–6 h > 5 W), simultaneous heavy loads, peak hours, monthly goal | `m13/engine.py` docstring and code |
| Confidence is a heuristic: 0.70 + min(0.25, (gap % − 35) / 200), capped at 0.97 | `m13/engine.py` |
| "Appliquer la correction" records a `SavingAction` and, in the simulator, applies an efficiency factor (0.82 for the AC setpoint) | `m14/rewards.py` `apply_code`, `EFFECTS` |
| Tokens: 500 per verified kWh avoided, floor, max 400 a day | `m14/rewards.py` |
| CO₂ factor 0.468 kg/kWh (IEA) | `m12/data.py` |
| Bill estimate uses the STEG residential low-voltage tariff in force since 01/05/2022 | `m14/tariff.py` |
| STEG view: households pseudonymised (FY-xxxx), regions with fewer than 10 households masked | `m15/aggregates.py`, `m15/tests.py` |
| A household alert appears in STEG incidents with the household code only | `m15/aggregates.py` `incident_json`; verified through the API on a DB copy |
| 17 appliance profiles in the energy model | `m11/profiles.py` `CATALOG` |
| Hardware intake contract `POST /api/mesures` (single reading or batch) | `m11/api.py` `mesures` |
| 25 automated tests in m11–m15 pass | `manage.py test m11 m12 m13 m14 m15`, run 2026-11-22: 25 tests, OK |
| All energy values are simulated and labelled "Données simulées" in the app | screenshots, `Shell.tsx` |

Recorded run on a disposable copy of the database (2026-11-22; demo reset, simulated clock
moved to 18:25 Tunis so the AC runs normally at ~915 W): the simulated AC fault raised
"Climatiseur salon +72 %" 15.3 s after it started: 1 624.3 W measured (mean of the three
readings 1 593.6 / 1 621 / 1 658.2 W), 946.6 W usual, threshold 1 277.9 W, confidence 88 %,
70.7 kWh/month at stake, severity "Élevée". The same alert appears in the STEG incident list
as household FY-2EF2, Résidence Les Jasmins, Grand Tunis. After the correction the AC read
765 W and was marked "Optimisé"; that drop comes from the simulator's efficiency factor and is
not a measurement. Bill estimate at that moment: 64.61 DT for 253.3 kWh. The backup
screenshots, the numbers on slides 2, 4 and 5 and the hook's bill all come from this run.
An earlier run at 02:00 simulated time worked the same way but started from standby, so its
evidence chart was less clear; it was discarded.

## Exploration

Three directions were rendered side by side for the hook slide:

- **A · Night trace.** Midnight stage. The bill appears as an object, then turns
  transparent to show the appliances inside it. **Picked for the story slides**: a
  non-technical juror reads a bill instantly, and the hidden standby is real model output.
- **B · Paper ledger.** Off-white editorial page with navy ink; the total splits into a
  stacked bar. The most legible option on a projector, but a stacked bar is a common
  device. **Picked for the evidence slides.**
- **C · Ma.** The kanji 見える化 acts as a light source in negative space. The most
  memorable, but too abstract for a 30-second hook. **Kept for the closing.**

The combined idea: night for the problem and the promise, daylight for the evidence. Moving
from dark to light is the product's own metaphor (見える化, "making visible").

Signature moments:
1. The bill turns transparent and reveals the TV's overnight standby (slide 1, on click).
2. One trace runs through Monitor → Detect → Explain → Act, with the readings as dots (slide 2).
3. The detection rule plays out reading by reading: one spike ignored, three in a row alert (slide 5, on click).

## System

- Canvas: 1920 × 1080, scaled to fit. Text edge at x = 120 on every slide.
- Type: Geist Variable (the app's typeface); Geist Mono for readings, cues and code.
  Display 96–120 px, headline 84 px, lead 36 px, body 26–28 px, labels ≥ 20 px.
- Night: `#070B14` stage, `#0C1424` raised, ink `#F2F5F9` / `#A9B4C6` / `#7D889C`.
- Paper: `#F4F2EC` page, `#FBFAF7` raised, ink `#0B1424` / `#465066` / `#646D80`.
- Signal colours, same meaning as the app's evidence chart: ice `#8FC1EA` (energy),
  amber `#F0B44C` (threshold), red `#E5484D` (anomaly), emerald `#2FA672` (resolved),
  sage `#9DB8A4` (usual level).
- Motion: ease-out `cubic-bezier(.16,1,.3,1)` for entrances, ease-in-out
  `cubic-bezier(.65,0,.35,1)` for sweeps and drawing. Entrances 0.7–0.9 s, staggered
  0.08 s. Reduced motion: fades only, no movement, no loops.

## Critique rounds

See the bottom of this file (written after verification).

## Rework (2026-11-22, second pass)

Rebuilt to the hackathon pitch rules: nine slides in the required order, one idea each, plain cuts
only (no transitions, builds or animation), key numbers very large. Theme changed from navy and
ice-blue with glows to flat red, cream and ink taken from the Mieruka app icon: no gradients,
shadows or glass. The hook and proof charts are drawn from the STEG survey figures in
`kizuna/benchmarks.py` (1,508 → 1,636 kWh, 25 % "Other"). Removed because the repository does not
support them: "20 volunteer homes", "< 2 % false alarms", "100 % pseudonymized", "0 black boxes",
"Python 3.12", "5 s smart intake". The earlier Impact slide was dropped to keep the deck short.
Placeholders left on purpose: team member names, a news headline for slide 3.

## Final pass (2026-11-22)

- **Cover** is now an elevator-style opening: the question "Do you know where your electricity money
  actually goes?", then Mieruka, then "See the waste. Understand it. Act on it.", then the team
  (Emna Ben Othman, Ilef Ghanmi, Amine Missaoui, Ahmed Ridha Lazhari).
- **Slide 3 corrected.** The "25 % filed under Other" claim was wrong: the 2019 survey lists six uses
  summing to 75 % and has no "Other" category (the repo's `Autres 25` is a remainder). Replaced with
  the verified 18 % (air conditioning) and ≈ 36 % (refrigerators) from the ANME/STEG 2024 study, with
  the L'Économiste Maghrébin article of 18 July 2026 cited on the slide. No donut: only two shares are
  published, so only two are drawn.
- **Slide 2** shows no unit on the 1 508 / 1 636 bars: the press report writes "kw".
- **Test count** on slide 7 is 40 (was 25): `manage.py test m11 m12 m13 m14 m15`, all pass.
- **Screenshots recaptured** from the current app. It now has an experimental 3D appliance panel, so
  the device list and alert card sit below the fold; frames 3 and 7 scroll to them.
- Decision: the 3D panel is shown as is (it is the app served by this checkout), and documented.
