import { Chapter } from "../ui";

export function Architecture() {
  return (
    <div className="arch-slide">
      <Chapter n={7} label="System architecture" />

      <h1 className="h2 arch-title">Simple on purpose. Explainable by design.</h1>

      <div className="arch-tiers-row">
        <div className="arch-box">
          <span className="arch-tier-label">Frontend Client</span>
          <b className="arch-box-title">React 19 Application</b>
          <div className="arch-tech-tags">
            <span>TypeScript</span>
            <span>Vite</span>
            <span>Tailwind CSS</span>
          </div>
          <p className="arch-box-desc">
            Responsive UI: Amira household dashboard, admin backoffice, and STEG collective grid view.
          </p>
        </div>

        <div className="arch-arrow">→</div>

        <div className="arch-box">
          <span className="arch-tier-label">Backend & Database</span>
          <b className="arch-box-title">Django 5.2 Server</b>
          <div className="arch-tech-tags">
            <span>Python 3.12</span>
            <span>SQLite</span>
            <span>Turso libSQL</span>
          </div>
          <p className="arch-box-desc">
            REST API, official STEG 2022 tariff calculation, and verified eco-token ledger.
          </p>
        </div>

        <div className="arch-arrow">→</div>

        <div className="arch-box key-box">
          <span className="arch-tier-label key-tier">Intelligence Core</span>
          <b className="arch-box-title">Anomaly Engine</b>
          <div className="arch-tech-tags">
            <span>5 Explainable Rules</span>
            <span>3-Day Sliding Median</span>
          </div>
          <p className="arch-box-desc">
            Zero black-box delay: detects 3-reading streaks exceeding the +35% threshold above baseline.
          </p>
        </div>

        <div className="arch-arrow">←</div>

        <div className="arch-box">
          <span className="arch-tier-label">Hardware Intake</span>
          <b className="arch-box-title">Intake Endpoint</b>
          <div className="arch-tech-tags">
            <span>POST /api/mesures</span>
            <span>Batch JSON</span>
          </div>
          <p className="arch-box-desc">
            Open ingestion contract for certified smart plugs and hardware sensors (5s sampling).
          </p>
        </div>
      </div>

      <div className="arch-stats-banner">
        <div className="arch-stat-unit">
          <b className="arch-num">25</b>
          <span className="arch-stat-lbl">Automated tests on energy modules, all passing</span>
        </div>
        <div className="arch-stat-unit">
          <b className="arch-num">0</b>
          <span className="arch-stat-lbl">Opaque neural network black boxes</span>
        </div>
        <div className="arch-stat-unit">
          <b className="arch-num">5 s</b>
          <span className="arch-stat-lbl">Continuous reading frequency per device</span>
        </div>
      </div>
    </div>
  );
}
