import { Chapter } from "../ui";

export function Roadmap() {
  return (
    <div className="roadmap-slide">
      <Chapter n={9} label="What comes next" />

      <h1 className="display roadmap-title">Next: From Prototype to Proof.</h1>

      <div className="roadmap-steps-grid">
        <div className="step-card">
          <div className="step-header">
            <span className="step-badge-num">Step 01</span>
            <span className="step-status">Priority Pilot</span>
          </div>
          <h2 className="step-card-title">Volunteer Household Pilot</h2>
          <p className="step-card-desc">
            Deploy in 20 volunteer homes. Measure whether families understand anomaly alerts and actually take corrective actions.
          </p>
          <div className="step-card-target">
            <span className="target-lbl">Primary Target</span>
            <b>Alert action rate & kWh avoided</b>
          </div>
        </div>

        <div className="step-card">
          <div className="step-header">
            <span className="step-badge-num">Step 02</span>
            <span className="step-status">Hardware Link</span>
          </div>
          <h2 className="step-card-title">Certified Hardware Intake</h2>
          <p className="step-card-desc">
            Connect commercially certified smart plugs to our existing intake API without modifying 230V hardware ourselves.
          </p>
          <div className="step-card-target">
            <span className="target-lbl">Primary Target</span>
            <b>Plug-and-play auto-pairing to POST /api/mesures</b>
          </div>
        </div>

        <div className="step-card">
          <div className="step-header">
            <span className="step-badge-num">Step 03</span>
            <span className="step-status">Machine Learning</span>
          </div>
          <h2 className="step-card-title">Rules vs. ML Benchmark</h2>
          <p className="step-card-desc">
            Train machine learning models on pilot datasets and benchmark against our explainable rules to refine edge-case detection.
          </p>
          <div className="step-card-target">
            <span className="target-lbl">Primary Target</span>
            <b>False-alarm rate &lt; 2% on real data</b>
          </div>
        </div>
      </div>

      <p className="roadmap-footnote">Everything above is scheduled post-hackathon. The web prototype is complete and operational today.</p>
    </div>
  );
}
