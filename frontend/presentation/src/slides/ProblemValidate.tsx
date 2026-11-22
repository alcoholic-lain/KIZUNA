import { Chapter } from "../ui";
import building from "../../screens/08-steg-building.png";

export function ProblemValidate() {
  return (
    <div className="prob-val-slide">
      <Chapter n={3} label="Validate the problem" />

      <h1 className="h2 val-title">Official data proves household energy waste is real and systemic.</h1>

      <div className="val-columns">
        <div className="val-card">
          <span className="val-chip">National Benchmark</span>
          <div className="val-metric">
            <span className="big-stat">1,636</span>
            <span className="unit">kWh / yr</span>
          </div>
          <p className="val-text">Average annual consumption per Tunisian household.</p>
          <span className="val-source">Source: STEG National Household Survey</span>
        </div>

        <div className="val-card alert-card">
          <span className="val-chip red">Unseen Fault Surge</span>
          <div className="val-metric red">
            <span className="big-stat">+72%</span>
            <span className="unit">surge</span>
          </div>
          <p className="val-text">Silent overconsumption when an AC compressor or heating element degrades.</p>
          <span className="val-source">Verified in Mieruka test run</span>
        </div>

        <div className="val-evidence-card">
          <span className="val-chip">Grid Evidence</span>
          <div className="val-quote-box">
            <p className="val-headline">
              "[ADD HEADLINE / SOURCE: STEG reports record summer peak demand driven by residential air conditioning surges]"
            </p>
          </div>
          <div className="val-crop-wrap">
            <img src={building} alt="STEG collective grid meter" className="val-crop-img" />
            <span className="val-crop-sub">STEG building view: aggregate peaks without household-level visibility</span>
          </div>
        </div>
      </div>
    </div>
  );
}
