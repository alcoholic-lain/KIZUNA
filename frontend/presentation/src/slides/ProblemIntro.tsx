import { Chapter } from "../ui";
import { BILL } from "../data";

export function ProblemIntro() {
  return (
    <div className="prob-intro-slide">
      <Chapter n={2} label="The problem" />

      <h1 className="display prob-sentence">
        <span className="ln">Electricity bills tell you what you paid.</span>
        <span className="ln ice">It never tells you what you wasted.</span>
      </h1>

      <div className="prob-grid">
        <div className="prob-stat-card">
          <span className="prob-stat-tag">Silent Standby Waste</span>
          <div className="prob-big-num">9 W</div>
          <p className="prob-stat-label">
            Continuous silent drain from an unused TV box in standby all night — completely invisible on your monthly bill.
          </p>
          <span className="prob-placeholder">[ADD STAT: Up to 15% of home power lost to phantom loads]</span>
        </div>

        <div className="prob-bill-card">
          <div className="bill-head">
            <span>Monthly Electricity Bill</span>
            <span>STEG Low Voltage</span>
          </div>
          <div className="bill-total-row">
            <b>{BILL.total}</b>
            <span className="bill-curr">DT</span>
          </div>
          <div className="bill-kwh-line">{BILL.kwh} kWh total consumption</div>
          <div className="bill-sep" />
          <div className="bill-blind-notice">
            <span className="bill-badge">Blind Total</span>
            <p>5 appliances lumped into one single sum. You cannot fix what you cannot see.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
