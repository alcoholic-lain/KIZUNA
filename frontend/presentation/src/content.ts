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
  /** Extra clicks inside the slide before → moves on. Plain cuts only: 0. */
  builds: number;
}

export const SLIDES: SlideMeta[] = [
  { id: "cover", chapter: "Introduction", name: "Cover", tone: "night", start: 0, end: 20, builds: 0 },
  { id: "intro-problem", chapter: "Introduce the problem", name: "Problem", tone: "night", start: 20, end: 50, builds: 0 },
  { id: "validate-problem", chapter: "Validate the problem", name: "Validation", tone: "night", start: 50, end: 80, builds: 0 },
  { id: "clarify-problem", chapter: "Clarify the problem", name: "Statement", tone: "night", start: 80, end: 110, builds: 0 },
  { id: "solution", chapter: "Showcase solution", name: "Solution", tone: "night", start: 110, end: 140, builds: 0 },
  { id: "demo", chapter: "Product demo", name: "Demo", tone: "night", start: 140, end: 215, builds: 0 },
  { id: "architecture", chapter: "System architecture", name: "Architecture", tone: "paper", start: 215, end: 240, builds: 0 },
  { id: "impact", chapter: "Why it matters", name: "Impact", tone: "paper", start: 240, end: 265, builds: 0 },
  { id: "roadmap", chapter: "What comes next", name: "Roadmap", tone: "paper", start: 265, end: 285, builds: 0 },
  { id: "close", chapter: "Conclusion", name: "Closing", tone: "night", start: 285, end: 300, builds: 0 },
];

/** A line of the script. `cue` lines are actions, never spoken. */
export type Line = { say: string } | { cue: string; note?: string };

export const SCRIPT: Record<string, Line[]> = {
  cover: [
    { say: "Hello judges, we are Team Zero-Ichi, and this is Mieruka: making household energy waste visible before you pay for it." },
  ],
  "intro-problem": [
    { say: "Electricity bills tell you what you paid. It never tells you what you wasted." },
    { say: "A single forgotten TV decoder draws 9 watts on standby all night, completely lost inside an opaque monthly total." },
  ],
  "validate-problem": [
    { say: "STEG national data confirms the average Tunisian home consumes 1,636 kilowatt-hours per year, with unmonitored cooling spikes straining the grid." },
    { say: "A silent compressor fault drives power 72 percent over normal, remaining undetected until the bill arrives." },
  ],
  "clarify-problem": [
    { say: "This poses three problems: lump-sum blindness with zero per-appliance breakdown, silent faults running for weeks, and delayed feedback received long after waste has occurred." },
  ],
  solution: [
    { say: "This is Mieruka, from the Japanese principle of making problems visible before fixing them." },
    { say: "Mieruka tracks individual appliances in real time to detect energy waste and alert households before the bill arrives." },
  ],
  demo: [
    { cue: "OPEN HOUSEHOLD DEMO", note: "switch to browser: Amira’s dashboard" },
    { say: "Here is Amira's household: live power, today's energy cost, and real-time appliance usage." },
    { cue: "TRIGGER THE AC FAULT", note: "Démo guidée step 3: clim +70%" },
    { say: "Now we simulate a compressor defect: power spikes, and within 15 seconds over three consecutive readings, Mieruka raises an alert." },
    { cue: "OPEN ALERT EVIDENCE", note: "click the alert" },
    { say: "Here is the evidence: 1,624 watts measured against a 947-watt baseline, the monthly financial stake, and an actionable recommendation." },
    { cue: "APPLY CORRECTION", note: "click Appliquer la correction" },
    { say: "Amira resolves the issue with one click. Mieruka advises without ever cutting power, and verified savings are measured immediately." },
    { cue: "RETURN TO PRESENTATION", note: "switch back, press → (or press B for backup)" },
  ],
  architecture: [
    { say: "Our architecture pairs a React 19 frontend with a Django REST backend and an open hardware intake endpoint." },
    { say: "Detection uses five explainable rules with a 3-day sliding median baseline, verified by 25 passing automated tests." },
  ],
  impact: [
    { say: "One alert delivers triple impact: households save money with zero forced shutoffs, STEG receives anonymized peak overload alerts, and verified reductions earn eco-tokens." },
  ],
  roadmap: [
    { say: "Next, we transition from prototype to proof: launching a 20-home volunteer pilot, connecting certified smart plug hardware, and benchmarking ML models against our rules." },
  ],
  close: [
    { say: "See the waste before you pay for it. We are Team Zero-Ichi. Thank you, and we welcome your questions!" },
  ],
};

/** Two-minute version, for when the jury asks you to finish early. Keys are slide ids. */
export const SHORT: { slide: string; lines: Line[] }[] = [
  { slide: "cover", lines: [{ say: "We are Team Zero-Ichi, presenting Mieruka: making household energy waste visible." }] },
  { slide: "intro-problem", lines: [{ say: "Electricity bills tell you what you paid, never what you wasted: silent standby alone draws 9 watts continuously." }] },
  { slide: "validate-problem", lines: [{ say: "With 1,636 kWh average home consumption, unmonitored appliance faults silently surge 72 percent above baseline." }] },
  { slide: "clarify-problem", lines: [{ say: "This creates three problems: lump-sum blindness, silent faults, and delayed monthly feedback." }] },
  { slide: "solution", lines: [{ say: "Mieruka tracks appliances in real time to detect waste and alert households before the bill arrives." }] },
  { slide: "demo", lines: [
    { cue: "PRESS B, THEN → TO FRAME 5", note: "the evidence screenshot; skip live demo if short on time" },
    { say: "Here an AC surge was caught in 15 seconds: measured vs baseline, exact dinars at stake, and one-click fix without cutting power." },
  ] },
  { slide: "architecture", lines: [{ say: "Built on React 19, Django, and 5 explainable rules with 25 passing automated tests." }] },
  { slide: "impact", lines: [{ say: "Zero power cuts for homes, 100% pseudonymized grid protection for STEG, and 500 tokens per verified kWh." }] },
  { slide: "roadmap", lines: [{ say: "Next: volunteer household pilot, certified smart plugs, and ML benchmarking." }] },
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
    caption: "The air conditioner jumps from about 950 W to 1.59 kW. No alert for it yet: one reading is not enough.",
    rings: [
      { x: 392, y: 168, w: 250, h: 92, label: "Live power jumps" },
      { x: 1032, y: 604, w: 416, h: 344, label: "No alert for the AC yet" },
    ],
  },
  {
    key: "03-alert-dashboard", step: 2, title: "Three readings later",
    caption: "In this run the alert appeared 15.3 s after the fault, and the appliance is flagged.",
    rings: [
      { x: 397, y: 656, w: 594, h: 52, label: "“Anomalie” on the air conditioner" },
      { x: 1050, y: 656, w: 380, h: 76, label: "The alert, with a likely cause" },
    ],
  },
  {
    key: "04-insights", step: 2, title: "Insights",
    caption: "The open alert, with its likely cause and severity.",
    rings: [{ x: 385, y: 137, w: 530, h: 68, label: "Climatiseur salon +72 %" }],
  },
  {
    key: "05-evidence", step: 3, title: "The evidence",
    caption: "1.62 kW measured against 947 W usual. Every 5-second reading with the usual line and the +35 % threshold, then confidence, cause, action and the monthly stake.",
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
    caption: "The air conditioner reads 765 W and is marked “Optimisé”. In the simulation this new level is modelled, not measured.",
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
