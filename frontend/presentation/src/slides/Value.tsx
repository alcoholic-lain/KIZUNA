import { ALERT, num } from "../data";
import { Chapter, Crop, SimTag } from "../ui";
import { d } from "../util";
import evidence from "../../screens/05-evidence.png";
import building from "../../screens/08-steg-building.png";
import after from "../../screens/07-after.png";

const CARD_X = 740;
const CARD_H = 200;
const CARDS_Y = [330, 545, 760];
const EVENT = { x: 120, y: 495, w: 480, h: 300 };

const CARDS = [
  {
    title: "The home",
    line: "Which appliance, why, and what it costs, before the bill.",
    built: "Evidence, cause and action on every alert",
    prove: "Households act on it",
    crop: { src: evidence, x: 1045, y: 104, w: 536, h: 118, label: "Prototype screen: measured, usual and gap for the alert" },
  },
  {
    title: "The grid",
    line: "STEG sees each building’s meter, monitored and untracked, without names.",
    built: "Pseudonyms; regions under 10 homes masked",
    prove: "Useful for targeting STEG’s work",
    crop: { src: building, x: 380, y: 168, w: 470, h: 134, label: "Prototype screen: building meter split into monitored and untracked use" },
  },
  {
    title: "The climate",
    line: "Only verified savings count: CO₂ avoided, and tokens.",
    built: "500 tokens per kWh avoided, 400 a day at most",
    prove: "Real reductions, at scale",
    crop: { src: after, x: 1106, y: 451, w: 342, h: 133, label: "Prototype screen: verified savings in kWh and CO₂" },
  },
];

export function Value() {
  const cy = EVENT.y + EVENT.h / 2;
  return (
    <div className="value">
      <Chapter n={4} label="Why it matters" />
      <h1 className="h2 rv" style={d(0.1)}>One alert: the home, the grid, the climate.</h1>

      <div className="event rv" style={{ left: EVENT.x, top: EVENT.y, width: EVENT.w, height: EVENT.h, ...d(0.3) }}>
        <span className="event-label">The alert from the demo</span>
        <span className="event-device">Air conditioner</span>
        <b>+{ALERT.pct}{" "}%</b>
        <span className="mono">{num(ALERT.measured)} W measured, {num(ALERT.usual)} W usual</span>
        <span className="mono">3 readings over {num(ALERT.threshold)} W</span>
      </div>

      <svg className="links" width={1920} height={1080} aria-hidden>
        {CARDS_Y.map((y, i) => {
          const ty = y + CARD_H / 2;
          return (
            <path key={y} pathLength={1} className="link draw" style={d(0.55 + i * 0.12, { "--dur": "0.9s" })}
              d={`M${EVENT.x + EVENT.w} ${cy} C${EVENT.x + EVENT.w + 80} ${cy} ${CARD_X - 80} ${ty} ${CARD_X} ${ty}`} />
          );
        })}
      </svg>

      {CARDS.map((c, i) => (
        <section key={c.title} className="vcard rv" style={{ left: CARD_X, top: CARDS_Y[i], height: CARD_H, ...d(0.75 + i * 0.12) }}>
          <div className="vcard-shot">
            <Crop {...c.crop} width={c.crop.w > 420 ? 420 : c.crop.w} />
          </div>
          <div className="vcard-text">
            <h3>{c.title}</h3>
            <p>{c.line}</p>
            <div className="status">
              <span className="built">{c.built}</span>
              <span className="prove">To prove: {c.prove}</span>
            </div>
          </div>
        </section>
      ))}

      <SimTag style={{ left: 120, bottom: 112, ...d(1.3) }}>Working in the prototype, on simulated data.</SimTag>
    </div>
  );
}
