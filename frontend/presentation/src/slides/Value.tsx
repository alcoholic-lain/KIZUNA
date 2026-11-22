import { Chapter, Crop, SimTag } from "../ui";
import evidence from "../../screens/05-evidence.png";
import building from "../../screens/08-steg-building.png";
import after from "../../screens/07-after.png";

export function Value() {
  return (
    <div className="impact-slide">
      <Chapter n={8} label="Why it matters" />

      <h1 className="h2 impact-title">Triple Impact: The Home, The Grid, The Climate.</h1>

      <div className="impact-grid">
        <div className="impact-card">
          <div className="impact-num-head">
            <span className="big-impact-num">0</span>
            <span className="impact-unit">Power Cuts</span>
          </div>
          <div className="impact-crop-box">
            <Crop src={evidence} x={1045} y={104} w={536} h={118} width={420} label="Appliance alert evidence" />
          </div>
          <h3 className="impact-target">The Home</h3>
          <p className="impact-summary">
            Mieruka advises, it never cuts power. Families see exact dinars at stake before the utility bill arrives.
          </p>
          <span className="impact-tagline">Actionable evidence & monthly savings</span>
        </div>

        <div className="impact-card">
          <div className="impact-num-head">
            <span className="big-impact-num">100%</span>
            <span className="impact-unit">Pseudonymized</span>
          </div>
          <div className="impact-crop-box">
            <Crop src={building} x={380} y={168} w={470} h={134} width={420} label="STEG building meter breakdown" />
          </div>
          <h3 className="impact-target">The Grid</h3>
          <p className="impact-summary">
            STEG sees building-level collective meters split into monitored vs untracked loads with zero privacy leakage.
          </p>
          <span className="impact-tagline">Early warnings on district overloads</span>
        </div>

        <div className="impact-card">
          <div className="impact-num-head">
            <span className="big-impact-num">500</span>
            <span className="impact-unit">Tokens / kWh</span>
          </div>
          <div className="impact-crop-box">
            <Crop src={after} x={1106} y={451} w={342} h={133} width={420} label="Verified energy and CO2 savings" />
          </div>
          <h3 className="impact-target">The Climate</h3>
          <p className="impact-summary">
            Only verified avoided kilowatt-hours turn into CO₂ avoided and community reward tokens.
          </p>
          <span className="impact-tagline">Proven savings prevent gaming</span>
        </div>
      </div>

      <SimTag>Prototype: tested on simulated data; pilot needed for real-world validation.</SimTag>
    </div>
  );
}
