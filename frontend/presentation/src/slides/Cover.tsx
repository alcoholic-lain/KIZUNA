import { AppIcon, Chapter } from "../ui";

export function Cover() {
  return (
    <div className="cover-slide">
      <Chapter n={1} label="Introduction" />

      <div className="cover-brand">
        <AppIcon size={88} />
        <div>
          <h1 className="cover-title">MIERUKA</h1>
          <p className="cover-jp">見える化 · Making Energy Waste Visible</p>
        </div>
      </div>

      <div className="cover-pitch">
        <h2 className="cover-headline">
          Real-time appliance monitoring and anomaly detection to stop energy waste before the bill arrives.
        </h2>
      </div>

      <div className="cover-meta-grid">
        <div className="cover-card">
          <span className="card-lbl">Team</span>
          <b className="card-val">Team Zero-Ichi</b>
          <span className="card-sub">[ADD TEAM MEMBERS: Name 1, Name 2, Name 3, Name 4]</span>
        </div>
        <div className="cover-card">
          <span className="card-lbl">Track</span>
          <b className="card-val">Smart Energy</b>
          <span className="card-sub">KIZUNA 2026 Hackathon</span>
        </div>
        <div className="cover-card">
          <span className="card-lbl">Presentation</span>
          <b className="card-val">Pitch & Live Demo</b>
          <span className="card-sub">5 Minutes · Prototype & Physical API</span>
        </div>
      </div>
    </div>
  );
}
