/**
 * Everything the presenter says, clicks and answers. The deck, the presenter window and the
 * generated PRESENTER-GUIDE.md all read from this file, so they cannot drift apart.
 * Every number here was checked against the source or a live run (see DESIGN-LOG.md).
 */

export type Tone = "red" | "paper" | "ink";

export interface SlideMeta {
  id: string;
  chapter: string;
  /** Short name used in the overview, the progress bar and the presenter window. */
  name: string;
  tone: Tone;
  /** Planned window, in seconds from the start of the talk. */
  start: number;
  end: number;
  /** Extra clicks inside the slide before → moves on. Plain cuts only: always 0. */
  builds: number;
}

export const SLIDES: SlideMeta[] = [
  { id: "cover", chapter: "Cover", name: "Cover", tone: "red", start: 0, end: 15, builds: 0 },
  { id: "intro-problem", chapter: "The problem", name: "Problem", tone: "paper", start: 15, end: 40, builds: 0 },
  { id: "validate-problem", chapter: "Proof it is real", name: "Proof", tone: "ink", start: 40, end: 60, builds: 0 },
  { id: "clarify-problem", chapter: "Problem statement", name: "3 problems", tone: "paper", start: 60, end: 90, builds: 0 },
  { id: "solution", chapter: "Solution", name: "Solution", tone: "paper", start: 90, end: 115, builds: 0 },
  { id: "demo", chapter: "Demo", name: "Demo", tone: "ink", start: 115, end: 215, builds: 0 },
  { id: "architecture", chapter: "Architecture", name: "Build", tone: "paper", start: 215, end: 245, builds: 0 },
  { id: "roadmap", chapter: "Next steps", name: "Next", tone: "paper", start: 245, end: 275, builds: 0 },
  { id: "close", chapter: "Thank you", name: "Close", tone: "red", start: 275, end: 300, builds: 0 },
];

/** A line of the script. `cue` lines are actions, never spoken. */
export type Line = { say: string } | { cue: string; note?: string };

export const SCRIPT: Record<string, Line[]> = {
  cover: [
    { say: "Do you know where your electricity money actually goes?" },
    { cue: "PAUSE", note: "let the question land, then look at the jury" },
    { say: "We are Zero-Ichi, and this is Mieruka: see the waste, understand it, act on it." },
  ],
  "intro-problem": [
    { say: "Between 2014 and 2019, the average Tunisian household used 8.5 percent more electricity. And the bill only ever shows one number." },
  ],
  "validate-problem": [
    { say: "And it is getting harder to see. The latest ANME and STEG study puts air conditioners at 18 percent of household electricity, second only to refrigerators. L’Économiste Maghrébin reported it in July. A bill shows none of that." },
  ],
  "clarify-problem": [
    { say: "That poses three problems. It is invisible: one total hides every appliance. It is late: the bill arrives after the waste. And it is passive: nothing tells you what to change." },
  ],
  solution: [
    { say: "Mieruka shows each household which appliance wastes energy, why, and what to do. In this prototype the readings are simulated." },
  ],
  demo: [
    { cue: "OPEN HOUSEHOLD DEMO", note: "switch to the browser: Amira’s dashboard" },
    { say: "This is a demo household: live power, today’s cost, and every appliance on its own." },
    { cue: "TRIGGER THE AC FAULT", note: "Démo guidée, step 3: « Déclencher une panne : clim +70 % »" },
    { say: "I simulate a fault on the air conditioner. One reading is not enough. Mieruka waits for three in a row, more than 35 percent above that appliance’s usual level." },
    { cue: "OPEN INSIGHTS, THEN THE ALERT", note: "Analyse IA, 10 to 15 s after the fault" },
    { say: "Here is the alert, and the evidence: measured against usual, every reading, a likely cause and the monthly cost." },
    { cue: "APPLY CORRECTION", note: "click « Appliquer la correction »" },
    { say: "One click applies the correction. Mieruka never cuts the power." },
    { cue: "RETURN TO PRESENTATION", note: "switch back, press → (live fails? press B for the backup screenshots)" },
  ],
  architecture: [
    { say: "A React front end, a Django back end, and an energy model that produces the readings today. Five explainable rules do the detection, and 40 automated tests pass." },
  ],
  roadmap: [
    { say: "Next: real households, certified measuring hardware, and our rules compared with a learned model. None of it is built yet." },
  ],
  close: [{ say: "See the waste before you pay for it. We are Zero-Ichi. Thank you." }],
};

/** Two-minute version, for when the jury asks you to finish early. Keys are slide ids. */
export const SHORT: { slide: string; lines: Line[] }[] = [
  { slide: "cover", lines: [{ say: "Do you know where your electricity money actually goes? We are Zero-Ichi, and this is Mieruka." }] },
  { slide: "intro-problem", lines: [{ say: "Your bill shows one number. It never shows what you wasted." }] },
  { slide: "clarify-problem", lines: [{ say: "Invisible, late and passive: three problems." }] },
  { slide: "solution", lines: [{ say: "Mieruka shows each household which appliance wastes energy, why, and what to do. The readings are simulated." }] },
  { slide: "demo", lines: [
    { cue: "PRESS B, THEN → TO FRAME 5", note: "the evidence screenshot; skip the live demo" },
    { say: "Three readings more than 35 percent above the usual level raise an alert, with the evidence and a correction. Mieruka never cuts the power." },
  ] },
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
    key: "01-household", step: 1, title: "A demo household",
    caption: "Live power, today’s energy and cost, a bill estimated with the STEG residential tariff, and every appliance on its own.",
    rings: [
      { x: 377, y: 112, w: 708, h: 318, label: "Live power, summed over appliances" },
      { x: 1105, y: 340, w: 343, h: 90, label: "Bill estimate, STEG tariff" },
      { x: 377, y: 604, w: 1072, h: 396, label: "Each appliance, one by one" },
    ],
  },
  {
    key: "02-fault-live", step: 2, title: "A simulated fault",
    caption: "The air conditioner jumps from about 950 W to about 1.6 kW. One reading is not enough for an alert.",
    rings: [
      { x: 392, y: 168, w: 250, h: 92, label: "Live power jumps" },
      { x: 396, y: 376, w: 200, h: 36, label: "The air conditioner is the cause" },
    ],
  },
  {
    key: "03-alert-dashboard", step: 2, title: "Three readings later",
    caption: "In this run the alert appeared 10.7 s after the fault. The appliance is flagged, and the alert is listed with a likely cause.",
    rings: [
      { x: 398, y: 410, w: 594, h: 54, label: "“Anomalie” on the air conditioner" },
      { x: 1054, y: 410, w: 373, h: 70, label: "The alert, with a likely cause" },
    ],
  },
  {
    key: "04-insights", step: 2, title: "Insights",
    caption: "The open alert, with its likely cause and severity.",
    rings: [{ x: 385, y: 137, w: 530, h: 68, label: "Climatiseur salon +68 %" }],
  },
  {
    key: "05-evidence", step: 3, title: "The evidence",
    caption: "1.60 kW measured against 948 W usual. Every 5-second reading with the usual line and the +35 % threshold, then confidence, cause, action and the monthly stake.",
    rings: [
      { x: 1049, y: 111, w: 527, h: 68, label: "Measured, usual, gap" },
      { x: 1049, y: 198, w: 527, h: 197, label: "Readings, usual line, threshold" },
      { x: 1049, y: 423, w: 527, h: 208, label: "Confidence, cause, action, stake" },
    ],
  },
  {
    key: "06-correction", step: 4, title: "« Appliquer la correction »",
    caption: "The correction is recorded. The app confirms that savings are now measured continuously.",
    rings: [{ x: 623, y: 24, w: 355, h: 73, label: "“Réglage appliqué”" }],
  },
  {
    key: "07-after", step: 4, title: "After the correction",
    caption: "The air conditioner reads 763 W and is marked “Optimisé”. In the simulation this new level is modelled, not measured.",
    rings: [
      { x: 398, y: 410, w: 594, h: 54, label: "“Optimisé”, power back down" },
      { x: 541, y: 218, w: 156, h: 44, label: "Same appliance, lower power" },
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
    a: "The idea comes from Japanese industry: make a problem visible before you fix it. The app also compares a Tunisian household (about 1,636 a year in the STEG 2019 survey; the press report of it writes the unit as “kw”) with a Japanese one (3,911 kWh, Japan’s Ministry of the Environment, fiscal 2023), with sources on screen. The deck itself uses only the growth, +8.5 % from 2014 to 2019.",
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
