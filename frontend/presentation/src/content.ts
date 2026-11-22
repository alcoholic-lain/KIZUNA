/**
 * Everything the presenter says, clicks and answers. The deck, the presenter window and the
 * generated PRESENTER-GUIDE.md all read from this file, so they cannot drift apart.
 * Every number here was checked against the source or a live run (see DESIGN-LOG.md).
 */

export type Tone = "night" | "paper";

export interface SlideMeta {
  id: string;
  chapter: string;
  /** Short name used in the overview, the progress bar and the presenter window. */
  name: string;
  tone: Tone;
  /** Planned window, in seconds from the start of the talk. */
  start: number;
  end: number;
  /** Extra clicks inside the slide before → moves on. */
  builds: number;
}

export const SLIDES: SlideMeta[] = [
  { id: "hook", chapter: "The problem", name: "Hook", tone: "night", start: 0, end: 30, builds: 1 },
  { id: "idea", chapter: "The idea", name: "Mieruka", tone: "night", start: 30, end: 60, builds: 0 },
  { id: "demo", chapter: "Live demo", name: "Demo", tone: "night", start: 60, end: 150, builds: 0 },
  { id: "value", chapter: "Why it matters", name: "Value", tone: "paper", start: 150, end: 195, builds: 0 },
  { id: "tech", chapter: "How it works", name: "Technology", tone: "paper", start: 195, end: 240, builds: 1 },
  { id: "next", chapter: "What comes next", name: "Roadmap", tone: "paper", start: 240, end: 270, builds: 0 },
  { id: "close", chapter: "Mieruka", name: "Closing", tone: "night", start: 270, end: 300, builds: 0 },
];

/** A line of the script. `cue` lines are actions, never spoken. */
export type Line = { say: string } | { cue: string; note?: string };

export const SCRIPT: Record<string, Line[]> = {
  hook: [
    { say: "Your electricity bill tells you what you paid. It never tells you what you wasted." },
    { cue: "CLICK", note: "the bill turns transparent" },
    { say: "Look inside one bill. Five appliances share a single number. And here, the TV box sat on standby all night, drawing nine watts. Nothing on the bill says so." },
    { say: "By the time the bill arrives, the waste is already paid for. Households should see it while they can still act." },
  ],
  idea: [
    { say: "This is Mieruka. In Japanese, mieruka means “making visible”. In Japanese industry, you make a problem visible before you fix it. We bring that into the home." },
    { say: "Mieruka follows each appliance on its own. It monitors, it detects unusual behaviour, it explains the evidence, and it tells you what to do." },
    { say: "In this prototype the readings are simulated, and the app labels them that way. Let me show you." },
  ],
  demo: [
    { cue: "OPEN HOUSEHOLD DEMO", note: "switch to the browser: Amira’s dashboard" },
    { say: "This is Amira’s household, a demo account. Live power. Today’s energy and cost. The month against her goal, and a bill estimate from the public STEG tariff. And below, each appliance." },
    { cue: "TRIGGER THE AC FAULT", note: "Démo guidée, step 3: « Déclencher une panne : clim +70 % »" },
    { say: "Now I simulate a fault: the air conditioner starts drawing far more than usual. The live number jumps, but there is no alert yet. One reading is not enough." },
    { say: "Mieruka waits for three readings in a row, five seconds apart, each more than 35 percent above that appliance’s usual level." },
    { cue: "OPEN INSIGHTS", note: "Analyse IA, about 15 s after the fault" },
    { say: "Here it is: the air conditioner, plus [read the percentage on screen]." },
    { cue: "OPEN ALERT EVIDENCE", note: "click the alert" },
    { say: "And here is the evidence. Measured against usual. Every reading, with the usual line and the threshold. A likely cause, an action, and what it costs each month. Every number can be checked." },
    { cue: "APPLY CORRECTION", note: "click « Appliquer la correction »" },
    { say: "Amira applies the correction. Mieruka never cuts the power; it advises. The air conditioner is marked optimised, and from now on its savings are measured against its reference." },
    { cue: "RETURN TO PRESENTATION", note: "switch back, press → (live fails? press B for the backup screenshots)" },
  ],
  value: [
    { say: "What you just saw was one alert. It matters for the home, for the grid, and for the climate." },
    { say: "The home knows which appliance, why, and what it costs, before the bill." },
    { say: "STEG gets the same alert as an incident, with the household pseudonymised, and sees each building’s meter split into monitored and untracked use." },
    { say: "And for the climate, only verified savings count. They become CO₂ avoided, and tokens." },
    { say: "All of this works in the prototype, on simulated data. The real-world impact is what we still have to prove." },
  ],
  tech: [
    { say: "Under the hood: a React and TypeScript app on a Django back end. Today the readings come from a simulated energy model. Real hardware would use an intake API that already exists." },
    { say: "The detection is rule-based, on purpose: we have little data, and every alert has to explain itself. Five rules." },
    { cue: "CLICK", note: "the rule plays out reading by reading" },
    { say: "The main one: the usual level is the median of the last three days. The threshold is 35 percent above it. One spike is ignored. Three readings in a row raise an alert." },
    { say: "Twenty-five automated tests cover the energy modules, and they pass." },
  ],
  next: [
    { say: "Next, in this order. One: test with real households. Do they understand the alerts, and do they act on them?" },
    { say: "Two: connect certified measuring hardware to that intake API. We chose not to modify a 230-volt adapter ourselves." },
    { say: "Three: tune the rules on real data, compare them with a learned model, and prepare for deployment." },
  ],
  close: [
    { say: "Today, a household pays for energy it cannot see. Mieruka makes it visible, appliance by appliance, with the evidence and something to do about it." },
    { say: "See the waste before you pay for it." },
    { say: "We are Zero-Ichi. Thank you." },
  ],
};

/** Two-minute version, for when the jury asks you to finish early. Keys are slide ids. */
export const SHORT: { slide: string; lines: Line[] }[] = [
  { slide: "hook", lines: [{ say: "Your electricity bill tells you what you paid. It never tells you what you wasted." }] },
  { slide: "idea", lines: [
    { say: "Mieruka, Japanese for “making visible”, follows each appliance, detects unusual behaviour, explains the evidence and says what to do. In this prototype the readings are simulated." },
  ] },
  { slide: "demo", lines: [
    { cue: "PRESS B, THEN → TO FRAME 5", note: "the evidence screenshot; skip the live demo" },
    { say: "Here the air conditioner stayed more than 35 percent above its usual level for three readings in a row. Mieruka shows what it measured against the usual level, every reading, the threshold, a likely cause and the monthly cost. One click applies the correction, and Mieruka never cuts the power." },
  ] },
  { slide: "value", lines: [
    { say: "The same alert helps the household, reaches STEG with the household pseudonymised, and only verified savings turn into tokens." },
  ] },
  { slide: "next", lines: [{ say: "Next: real households, certified hardware, and rules tuned on real data." }] },
  { slide: "close", lines: [{ say: "See the waste before you pay for it. Thank you." }] },
];

/** If the jury stops you mid-sentence: one breath. */
export const LAST_LINE =
  "Mieruka shows each household which appliance wastes energy, why, and what to do, before the bill. See the waste before you pay for it.";

export interface BackupFrame {
  key: string;
  step: 1 | 2 | 3 | 4;
  title: string;
  caption: string;
  /** Highlights in CSS pixels of the 1600 × 1000 capture. */
  rings: { x: number; y: number; w: number; h: number; label: string }[];
}

export const DEMO_STEPS = [
  { n: 1, title: "Understand the household", action: "Open the household dashboard" },
  { n: 2, title: "Detect the anomaly", action: "Simulate a fault, then open Insights" },
  { n: 3, title: "Reveal the evidence", action: "Open the alert" },
  { n: 4, title: "Take action", action: "« Appliquer la correction »" },
] as const;

export const BACKUP: BackupFrame[] = [
  {
    key: "01-household", step: 1, title: "Amira’s household",
    caption: "Live power, today’s energy and cost, the month against the goal, and a bill estimated with the STEG residential tariff.",
    rings: [
      { x: 377, y: 112, w: 708, h: 318, label: "Live power, summed over appliances" },
      { x: 1105, y: 340, w: 343, h: 90, label: "Bill estimate, STEG tariff" },
      { x: 377, y: 604, w: 634, h: 344, label: "Each appliance, one by one" },
    ],
  },
  {
    key: "02-fault-live", step: 2, title: "A simulated fault",
    caption: "The air conditioner jumps from about 950 W to 1.59 kW. No alert for it yet: one reading is not enough.",
    rings: [
      { x: 392, y: 168, w: 250, h: 92, label: "Live power jumps" },
      { x: 1032, y: 604, w: 416, h: 344, label: "No alert for the AC yet" },
    ],
  },
  {
    key: "03-alert-dashboard", step: 2, title: "Three readings later",
    caption: "In this run the alert appeared 15.3 s after the fault, and the appliance is flagged.",
    rings: [
      { x: 397, y: 656, w: 594, h: 52, label: "“Anomalie” on the air conditioner" },
      { x: 1050, y: 656, w: 380, h: 76, label: "The alert, with a likely cause" },
    ],
  },
  {
    key: "04-insights", step: 2, title: "Insights",
    caption: "The open alert, with its likely cause and severity.",
    rings: [{ x: 385, y: 137, w: 530, h: 68, label: "Climatiseur salon +72 %" }],
  },
  {
    key: "05-evidence", step: 3, title: "The evidence",
    caption: "1.62 kW measured against 947 W usual. Every 5-second reading with the usual line and the +35 % threshold, then confidence, cause, action and the monthly stake.",
    rings: [
      { x: 1049, y: 111, w: 527, h: 68, label: "Measured, usual, gap" },
      { x: 1049, y: 198, w: 527, h: 197, label: "Readings, usual line, threshold" },
      { x: 1049, y: 423, w: 527, h: 208, label: "Confidence, cause, action, stake" },
    ],
  },
  {
    key: "06-correction", step: 4, title: "« Appliquer la correction »",
    caption: "The correction is recorded. The app confirms that savings are now measured continuously.",
    rings: [{ x: 618, y: 22, w: 364, h: 78, label: "“Réglage appliqué”" }],
  },
  {
    key: "07-after", step: 4, title: "After the correction",
    caption: "The air conditioner reads 765 W and is marked “Optimisé”. In the simulation this new level is modelled, not measured.",
    rings: [
      { x: 392, y: 168, w: 200, h: 92, label: "Live power back down" },
      { x: 397, y: 656, w: 594, h: 52, label: "“Optimisé”" },
    ],
  },
];

export const QA: { q: string; a: string }[] = [
  {
    q: "Are these real measurements?",
    a: "No. Every watt in the demo comes from a deterministic energy model with 17 appliance profiles, and the app labels it “Données simulées”. We did not modify a 230 V adapter. Readings from real hardware would arrive through POST /api/mesures, which exists, validates and deduplicates readings and accepts batches; we tested it with a headless simulator, not with real hardware.",
  },
  {
    q: "Is this AI? Is there machine learning?",
    a: "It is rule-based on purpose. We have little data, and every alert must explain itself. Five rules: overconsumption, standby, simultaneous heavy loads, peak hours, monthly goal. A learned model is on the roadmap, to be compared against these rules on real data.",
  },
  {
    q: "How do you avoid false alarms?",
    a: "A single spike never triggers an alert: it takes three consecutive readings. The usual level is a median over three days, which outliers barely move, and readings already flagged as anomalous are excluded. The gap must also exceed 10 W or 8 % of the usual level. After a correction, the rule stays quiet for two minutes. We have not measured the false-alarm rate on real homes yet; the pilot is how we would.",
  },
  {
    q: "What does “confidence 88 %” mean?",
    a: "It is a heuristic that grows with the size of the gap: 70 % at the threshold, capped at 97 %. It is not a calibrated probability. Calibrating it needs labelled real data.",
  },
  {
    q: "What does “Appliquer la correction” actually do?",
    a: "It records the action and the appliance’s reference power, marks the appliance optimised, and starts measuring savings against that reference. In the simulation the corrected setting is applied as an efficiency factor; in a real home the person changes the setting. Mieruka never switches anything off.",
  },
  {
    q: "How are tokens calculated? Can people game them?",
    a: "500 tokens per kWh avoided against the appliance’s own reference, rounded down, at most 400 a day. Only verified savings count. Whether that resists gaming in real homes is part of what a pilot has to show.",
  },
  {
    q: "What does STEG get, and what about privacy?",
    a: "A building view: the collective meter split into monitored appliances and the untracked rest, incidents, peak load. Households appear only as pseudonyms (FY-xxxx), and regions with fewer than ten households are masked. A test checks that no names leak. This is our proposal; STEG is not a partner.",
  },
  {
    q: "Are STEG, JICA or ESPRIT partners?",
    a: "No. The event and partner logos on our landing page are there because we built this at KIZUNA 2026; they do not imply endorsement. We only use public data: the STEG residential tariff in force since 1 May 2022, STEG’s 2019 household survey and an IEA emission factor.",
  },
  {
    q: "How accurate is the bill estimate?",
    a: "It applies the public STEG residential low-voltage tariff (since 1 May 2022) to simulated consumption, including an estimate for appliances without an adapter. It is labelled an estimate in the app.",
  },
  {
    q: "What would real hardware need?",
    a: "A certified measuring plug or meter that can send an adapter ID, a timestamp and watts to POST /api/mesures, one reading or a batch. An optional adapter key protects the endpoint, and an invalid batch is rejected as a whole.",
  },
  {
    q: "Does it scale?",
    a: "Not proven. The prototype runs on Django with SQLite locally, and the repository has configuration for a hosted libSQL (Turso) database. We have not load-tested it. That is part of preparing for deployment.",
  },
  {
    q: "Why would households use it?",
    a: "Our hypothesis: specific, appliance-level advice with a cost attached, plus rewards for verified savings. We have not tested it with real households yet; that is the first step of the roadmap.",
  },
  {
    q: "Where is the Tunisia–Japan link?",
    a: "The idea comes from Japanese industry: make a problem visible before you fix it. The app also compares a Tunisian household (1,636 kWh a year, STEG survey 2019) with a Japanese one (3,911 kWh, Japan’s Ministry of the Environment, fiscal 2023), with sources on screen.",
  },
];

export const CHECKLIST: string[] = [
  "Run Django on the presenting laptop (uv run manage.py runserver). Do not depend on venue Wi-Fi.",
  "Open http://127.0.0.1:8000/login in a browser and sign in with the household demo account (Amira).",
  "In « Démo guidée », reset the demo (↺) so the alert list is clean, then mark steps 1–2 done (« Passer cette étape ») so step 3, the AC fault, is one click away.",
  "Set the browser zoom to 125 %, close other tabs and silence notifications.",
  "Open mieruka-pitch.html in a second window, press F for full screen and P for the presenter window (on the laptop screen when the projector extends the display).",
  "Rehearse switching between the deck and the app (Alt+Tab) until it takes under two seconds.",
  "After each rehearsal, reset the demo again: an applied correction closes the AC alert.",
  "If the live demo fails, press B on the demo slide: seven real screenshots from the running prototype.",
];

export function words(lines: Line[]) {
  return lines.reduce((n, l) => ("say" in l ? n + l.say.split(/\s+/).filter(Boolean).length : n), 0);
}

export const fmtTime = (s: number) => {
  const sign = s < 0 ? "−" : "";
  const a = Math.abs(Math.round(s));
  return `${sign}${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
};
