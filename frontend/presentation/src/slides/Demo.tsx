import { DEMO_STEPS } from "../content";
import { Chapter, SimTag } from "../ui";
import { d } from "../util";
import household from "../../screens/01-household.png";

export function Demo() {
  return (
    <div className="demo">
      <Chapter n={3} label="Live demo" />
      <h1 className="display">
        <span className="ln rv" style={d(0.1)}>Live, on the</span>
        <span className="ln rv" style={d(0.18)}>prototype.</span>
      </h1>

      <ol className="steps">
        {DEMO_STEPS.map((s, i) => (
          <li key={s.n} className="step rv" style={d(0.35 + i * 0.1)}>
            <span className="n">{s.n}</span>
            <div>
              <b>{s.title}</b>
              <span>{s.action}</span>
            </div>
          </li>
        ))}
      </ol>

      <figure className="shot-frame rv" style={d(0.3, { "--ry": "48px" })}>
        <img src={household} alt="Mieruka household dashboard for the demo account" />
      </figure>
      <p className="shot-caption rv" style={d(0.6)}>
        <span className="live"><i />Live prototype</span>
        <span>Amira’s household, a demo account</span>
      </p>

      <SimTag style={d(0.8)}>Every reading in the demo is simulated.</SimTag>
    </div>
  );
}
