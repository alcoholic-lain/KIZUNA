import { useId } from "react";
import { Chapter } from "../ui";
import { d } from "../util";

const STOPS = [
  { tag: "Today", title: "Working prototype", text: "Dashboard, explainable alerts, STEG building view and rewards, on simulated data.", note: "built" },
  { tag: "Next 1", title: "Real households", text: "A pilot with volunteer homes. Do people understand the alerts, and act on them?", note: "measure: alerts acted on" },
  { tag: "Next 2", title: "Certified hardware", text: "A certified measuring plug, sending readings to the intake API. We chose not to modify a 230 V adapter.", note: "POST /api/mesures" },
  { tag: "Next 3", title: "Smarter rules", text: "Tune the rules on real data, compare them with a learned model, then harden for deployment.", note: "rules vs. model, on real data" },
];

const COL = 440;
const R = 12;
const LINE_Y = 420;

export function Roadmap() {
  const m = useId().replace(/:/g, "");
  return (
    <div className="next">
      <Chapter n={6} label="What comes next" />
      <h1 className="display rv" style={d(0.1)}>Next: from prototype to proof.</h1>

      <svg className="timeline" width={1680} height={40} style={{ top: LINE_Y - 20 }} aria-hidden>
        <defs>
          <mask id={m} maskUnits="userSpaceOnUse" x={0} y={0} width={1680} height={40}>
            <rect className="wipe" x={R} y={0} width={1680 - R} height={40} fill="white" style={d(0.35, { "--dur": "1.6s" })} />
          </mask>
        </defs>
        <g mask={`url(#${m})`}>
          <path d={`M${R} 20 H${COL + R}`} className="tl-done" />
          <path d={`M${COL + R} 20 H1680`} className="tl-next" />
        </g>
        {STOPS.map((s, i) => (
          <circle key={s.tag} cx={i * COL + R} cy={20} r={R - 1.5} className={i ? "tl-node pop" : "tl-node now pop"} style={d(0.4 + i * 0.32)} />
        ))}
      </svg>

      <div className="stops">
        {STOPS.map((s, i) => (
          <div key={s.tag} className={i ? "stop rv" : "stop now rv"} style={d(0.5 + i * 0.32)}>
            <span className="tag">{s.tag}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
            <span className="mono">{s.note}</span>
          </div>
        ))}
      </div>

      <p className="foot rv" style={d(1.7)}>Nothing after “Today” is built yet. This is the plan.</p>
    </div>
  );
}
