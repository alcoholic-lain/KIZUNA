import { ALERT, RULE_READINGS, RULE_RUN, RULE_SPIKE, num } from "../data";
import { Chapter } from "../ui";
import { d } from "../util";

const NODES = [
  { t: "Readings", s: "Simulated energy model, 17 appliance profiles", extra: "hardware: POST /api/mesures" },
  { t: "Django API", s: "Python back end and SQLite database" },
  { t: "Rules engine", s: "5 explainable rules, no black box", key: true },
  { t: "Tariff & rewards", s: "STEG 2022 tariff, tokens for verified kWh" },
  { t: "React app", s: "Household, company and STEG views" },
];

/** Chart geometry, local to the chart card. */
const X0 = 40;
const X1 = 1180;
const TOP = 60;
const BOT = 320;
const LO = 700;
const HI = 1800;
const y = (w: number) => BOT - ((w - LO) / (HI - LO)) * (BOT - TOP);
const x = (i: number) => 56 + i * 36;
const STEP = 0.1;

export function Tech() {
  const last = RULE_RUN[RULE_RUN.length - 1];
  const runX0 = x(RULE_RUN[0]) - 16;
  const runX1 = x(last) + 16;
  const runTop = Math.min(...RULE_RUN.map((i) => y(RULE_READINGS[i]))) - 26;
  const line = RULE_READINGS.map((w, i) => `${i ? "L" : "M"}${x(i)} ${y(w).toFixed(1)}`).join(" ");
  const alertAt = last * STEP + 0.35;

  return (
    <div className="tech">
      <Chapter n={5} label="How it works" />
      <h1 className="h2 rv" style={d(0.1)}>Simple on purpose. Explainable by design.</h1>

      <div className="pipe">
        {NODES.map((n, i) => (
          <div key={n.t} className={n.key ? "node key rv" : "node rv"} style={d(0.25 + i * 0.08)}>
            <b>{n.t}</b>
            <span>{n.s}</span>
            {n.extra && <span className="extra">{n.extra}</span>}
          </div>
        ))}
        <svg className="pipe-links" width={1680} height={160} aria-hidden>
          {[0, 1, 2, 3].map((i) => {
            const x0 = 300 + i * 345;
            return <path key={i} d={`M${x0 + 8} 80 H${x0 + 37} m-7 -7 l7 7 l-7 7`} className="arrow draw" pathLength={1} style={d(0.5 + i * 0.1, { "--dur": "0.5s" })} />;
          })}
        </svg>
      </div>

      <div className="rule rv" style={d(0.55)}>
        <div className="rule-head">
          <b>The overconsumption rule</b>
          <span>Real readings from the demo alert, 5 s apart. The single spike is added to show the rule.</span>
        </div>
        <svg width={1220} height={370} role="img"
          aria-label="Readings every 5 seconds. One reading above the threshold is ignored; three in a row raise an alert.">
          <line x1={X0} x2={X1} y1={y(ALERT.usual)} y2={y(ALERT.usual)} className="r-usual" />
          <text x={X1} y={y(ALERT.usual) + 32} textAnchor="end" className="t-sage">usual: {num(ALERT.usual)} W, the median of 3 days</text>
          <line x1={X0} x2={X1} y1={y(ALERT.threshold)} y2={y(ALERT.threshold)} className="r-thresh" />
          <text x={X1} y={y(ALERT.threshold) - 14} textAnchor="end" className="t-amber">threshold: usual + 35 % = {num(ALERT.threshold)} W</text>
          <text x={X0} y={BOT + 32} className="t-axis">one reading every 5 s →</text>

          <g className="g1">
            <path d={line} pathLength={1} className="r-line" style={d(0, { "--dur": `${last * STEP + 0.2}s` })} />
            {RULE_READINGS.map((w, i) => {
              const cls = i === RULE_SPIKE ? "r-dot spike" : RULE_RUN.includes(i) ? "r-dot run" : "r-dot";
              return <circle key={i} cx={x(i)} cy={y(w)} r={RULE_RUN.includes(i) ? 9 : 7} className={cls} style={d(i * STEP)} />;
            })}
            <text x={x(RULE_SPIKE)} y={y(RULE_READINGS[RULE_SPIKE]) - 24} textAnchor="middle" className="t-note spike-note" style={d(RULE_SPIKE * STEP + 0.3)}>
              1 reading: ignored
            </text>
            <g className="run-note" style={d(alertAt)}>
              <path d={`M${runX0} ${runTop + 10} V${runTop} H${runX1} V${runTop + 10}`} className="r-bracket" />
              <text x={(runX0 + runX1) / 2} y={runTop - 14} textAnchor="middle" className="t-note red">3 in a row</text>
            </g>
            <g className="r-alert" style={d(alertAt + 0.3)}>
              <rect x={runX1 + 24} y={y(1700) - 36} width={306} height={72} rx={14} />
              <circle cx={runX1 + 50} cy={y(1700) - 8} r={7} />
              <text x={runX1 + 68} y={y(1700)} className="a1">Alert raised</text>
              <text x={runX1 + 68} y={y(1700) + 25} className="a2">{ALERT.seconds} s after the fault</text>
            </g>
          </g>
        </svg>
      </div>

      <div className="facts">
        {[
          ["5", "explainable rules: overconsumption, standby, simultaneous loads, peak hours, monthly goal"],
          ["25", "automated tests on the energy modules, all passing"],
          ["0", "power cuts: Mieruka advises, it never switches anything off"],
        ].map(([n, t], i) => (
          <div key={n} className="fact rv" style={d(0.7 + i * 0.1)}>
            <b>{n}</b>
            <span>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
