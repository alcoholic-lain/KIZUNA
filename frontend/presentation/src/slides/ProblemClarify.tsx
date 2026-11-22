import { Chapter } from "../ui";
import s01 from "../../screens/01-household.png";
import s02 from "../../screens/02-fault-live.png";
import s03 from "../../screens/03-alert-dashboard.png";

export function ProblemClarify() {
  return (
    <div className="prob-clarify-slide">
      <Chapter n={4} label="Problem statement" />

      <h1 className="display clarify-title">
        This poses <span className="ice">3 problems:</span>
      </h1>

      <div className="clarify-row">
        <div className="clarify-column">
          <div className="clarify-img-frame">
            <img src={s01} alt="Lump-sum bill total" className="clarify-img" />
          </div>
          <div className="clarify-tag">Problem 01</div>
          <h2 className="clarify-h"><b>Lump-Sum</b> Blindness</h2>
          <p className="clarify-desc">Monthly utility bills display one single total with zero per-appliance breakdown.</p>
        </div>

        <div className="clarify-column">
          <div className="clarify-img-frame">
            <img src={s02} alt="Fault overconsumption" className="clarify-img" />
          </div>
          <div className="clarify-tag">Problem 02</div>
          <h2 className="clarify-h"><b>Silent</b> Faults</h2>
          <p className="clarify-desc">Compressor failures, clogged filters, and phantom loads waste power for weeks undetected.</p>
        </div>

        <div className="clarify-column">
          <div className="clarify-img-frame">
            <img src={s03} alt="Delayed feedback alert" className="clarify-img" />
          </div>
          <div className="clarify-tag">Problem 03</div>
          <h2 className="clarify-h"><b>Delayed</b> Feedback</h2>
          <p className="clarify-desc">Households only discover the waste weeks later when the money is already paid.</p>
        </div>
      </div>
    </div>
  );
}
