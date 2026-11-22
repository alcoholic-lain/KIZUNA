import { Chapter } from "../ui";
import evidence from "../../screens/05-evidence.png";

export function Demo() {
  return (
    <div className="demo-slide">
      <Chapter n={6} label="Live demo" />

      <div className="demo-header-bar">
        <span className="demo-badge">LIVE DEMONSTRATION</span>
        <h1 className="display demo-big-label">DEMO</h1>
        <p className="demo-subtitle">
          Real-time anomaly detection, explainable evidence curve, and 1-click optimization.
        </p>
      </div>

      <div className="demo-main-area">
        <div className="demo-screen-card">
          <img src={evidence} alt="Key Screen: Mieruka Alert Evidence and 1-Click Correction" className="demo-screen-shot" />
          <div className="demo-screen-footer">
            <span className="key-screen-title">Key Screen: Anomaly Evidence & Action</span>
            <span className="key-screen-stats">1,624 W measured vs 947 W baseline · 70.7 kWh/month at stake</span>
          </div>
        </div>

        <div className="demo-walkthrough">
          <div className="demo-step-row">
            <span className="step-badge">1</span>
            <div>
              <b className="step-name">Trigger Fault</b>
              <p className="step-detail">Simulate AC compressor surge (+72% draw).</p>
            </div>
          </div>
          <div className="demo-step-row">
            <span className="step-badge">2</span>
            <div>
              <b className="step-name">Inspect Evidence</b>
              <p className="step-detail">Mieruka flags 3-reading streak in 15 seconds.</p>
            </div>
          </div>
          <div className="demo-step-row">
            <span className="step-badge">3</span>
            <div>
              <b className="step-name">One-Click Fix</b>
              <p className="step-detail">Apply correction; verified savings tracked.</p>
            </div>
          </div>

          <div className="demo-prompt-box">
            <b>Switch to live browser tab (Alt+Tab)</b>
            <span>Press <b>B</b> anytime for instant offline backup screenshots</span>
          </div>
        </div>
      </div>
    </div>
  );
}
