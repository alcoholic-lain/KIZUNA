import { Chapter, SimTag } from "../ui";
import household from "../../screens/01-household.png";

export function Solution() {
  return (
    <div className="solution-slide">
      <Chapter n={5} label="Showcase your solution" />

      <div className="sol-top">
        <span className="sol-kicker">見える化</span>
        <h1 className="sol-brand">MIERUKA</h1>
      </div>

      <p className="sol-one-sentence">
        Mieruka makes household energy visible by tracking individual appliances in real time to detect waste and alert you before the bill arrives.
      </p>

      <div className="sol-layout">
        <div className="sol-preview-frame">
          <img src={household} alt="Mieruka Household Dashboard" className="sol-dashboard-img" />
        </div>

        <div className="sol-pillars">
          <div className="sol-pillar-card">
            <span className="pillar-num">01</span>
            <div>
              <b className="pillar-title">Real-Time Tracking</b>
              <p className="pillar-text">5-second interval monitoring per appliance via smart intake.</p>
            </div>
          </div>

          <div className="sol-pillar-card">
            <span className="pillar-num">02</span>
            <div>
              <b className="pillar-title">Explainable Alerts</b>
              <p className="pillar-text">Median 3-day baseline catches sudden spikes and long-tail standby.</p>
            </div>
          </div>

          <div className="sol-pillar-card">
            <span className="pillar-num">03</span>
            <div>
              <b className="pillar-title">Actionable Advice</b>
              <p className="pillar-text">Shows exact dinars at stake; empowers users without cutting power.</p>
            </div>
          </div>
        </div>
      </div>

      <SimTag>Prototype: simulated data validated against public STEG residential tariffs.</SimTag>
    </div>
  );
}
