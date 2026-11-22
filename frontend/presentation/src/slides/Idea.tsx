import { useId } from "react";
import { ALERT, num } from "../data";
import { Chapter, SimTag } from "../ui";
import { d, smooth } from "../util";

/** One trace across the four stations: calm readings, a run above the threshold, the gap, the fix. */
const USUAL = 150;
const THRESH = 95;
const HIGH = 58;
const AFTER = 160;
const wob = (i: number, a = 5) => Math.sin(i * 1.3) * a + Math.cos(i * 0.7) * (a * 0.6);

const PTS: [number, number][] = [];
for (let x = 0; x <= 440; x += 40) PTS.push([x, USUAL + wob(x / 40)]);
PTS.push([470, USUAL + 2]);
for (let x = 500; x <= 1300; x += 40) PTS.push([x, HIGH + wob(x / 40, 3)]);
PTS.push([1320, HIGH + 1]);
PTS.push([1350, AFTER]);
for (let x = 1390; x <= 1680; x += 40) PTS.push([x, AFTER + wob(x / 40, 2.5)]);
const PATH = smooth(PTS, 40, 175);
const READINGS = PTS.filter(([x]) => x <= 440);
const RUN = PTS.filter(([x]) => x >= 540 && x <= 620);

const STATIONS = [
  { verb: "Monitor", line: "Every appliance, reading by reading.", note: "a reading every 5 s", dot: "var(--ice)" },
  { verb: "Detect", line: "Three readings above its usual level.", note: "3-day median + 35 %", dot: "var(--red)" },
  { verb: "Explain", line: "The evidence, a likely cause, the cost.", note: "measured against usual", dot: "var(--amber)" },
  { verb: "Act", line: "One correction. Savings verified.", note: "never cuts the power", dot: "var(--emerald)" },
];

export function Idea() {
  const g = useId().replace(/:/g, "");
  return (
    <div className="idea">
      <Chapter n={2} label="The idea" />
      <p className="kicker rv" style={d(0.08)}><span className="jp">見える化</span><span>mieruka, “making visible”</span></p>
      <h1 className="display">
        <span className="ln rv" style={d(0.16)}>From a bill you pay</span>
        <span className="ln ice rv" style={d(0.24)}>to energy you can act on.</span>
      </h1>

      <div className="flow">
        <svg width={1680} height={230} aria-hidden>
          <defs>
            <linearGradient id={g} x1={0} x2={1680} y1={0} y2={0} gradientUnits="userSpaceOnUse">
              <stop offset={0.27} stopColor="var(--ice)" />
              <stop offset={0.295} stopColor="var(--red)" />
              <stop offset={0.785} stopColor="var(--red)" />
              <stop offset={0.805} stopColor="var(--emerald)" />
            </linearGradient>
          </defs>
          <g className="refs rv" style={d(1.0, { "--ry": "0px" })}>
            <line x1={440} x2={1320} y1={THRESH} y2={THRESH} className="thresh" />
            <line x1={440} x2={1320} y1={USUAL} y2={USUAL} className="usual" />
            <text x={960} y={THRESH - 12} className="t-amber">threshold: usual + 35 %</text>
            <text x={960} y={USUAL + 30} className="t-sage">usual: {num(ALERT.usual)} W</text>
          </g>
          <path d={PATH} pathLength={1} className="trace draw" stroke={`url(#${g})`} style={d(0.35, { "--dur": "1.9s" })} />
          {READINGS.map(([x, y], i) => (
            <circle key={x} cx={x} cy={y} r={4.5} className="dot-read pop" style={d(0.4 + i * 0.05)} />
          ))}
          {RUN.map(([x, y], i) => (
            <circle key={x} cx={x} cy={y} r={8} className="dot-run pop" style={d(0.95 + i * 0.12)} />
          ))}
          <g className="rv" style={d(1.35, { "--ry": "0px" })}>
            <path d={`M894 ${HIGH + 6} H904 V${USUAL - 6} H894`} className="bracket" />
            <text x={884} y={THRESH + 34} textAnchor="end" className="t-gap">+{num(ALERT.gap)} W</text>
          </g>
          <g className="pop" style={d(1.75)}>
            <circle cx={1320} cy={HIGH + 1} r={17} className="act-node" />
            <path d={`M1312 ${HIGH + 1} l5.5 5.5 l10 -11`} className="act-check" />
          </g>
        </svg>
        <div className="pulse" style={{ offsetPath: `path("${PATH}")` }} />
      </div>

      <div className="stations">
        {STATIONS.map((s, i) => (
          <div key={s.verb} className="station rv" style={d(0.55 + i * 0.4, { "--dot": s.dot })}>
            <h3><i />{s.verb}</h3>
            <p>{s.line}</p>
            <p className="mono">{s.note}</p>
          </div>
        ))}
      </div>

      <SimTag style={d(2.2)}>Prototype: readings are simulated, and labelled that way in the app.</SimTag>
    </div>
  );
}
