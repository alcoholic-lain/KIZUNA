import { AppIcon } from "../ui";

export function Closing() {
  return (
    <div className="closing-slide">
      <div className="kanji-bg" aria-hidden>
        <span className="kanji-watermark">見える化</span>
      </div>

      <h1 className="display closing-punchline">
        <span className="ln">See the waste</span>
        <span className="ln ice">before you pay for it.</span>
      </h1>

      <p className="closing-lead">
        Mieruka makes household energy visible, appliance by appliance, with verified proof.
      </p>

      <div className="closing-meta">
        <div className="closing-brand">
          <AppIcon size={64} />
          <div>
            <b className="closing-brand-name">Mieruka</b>
            <span className="closing-team">Team Zero-Ichi · KIZUNA 2026, Smart Energy</span>
          </div>
        </div>

        <div className="closing-contact">
          <span className="contact-tag">Open for Q&A</span>
          <b className="contact-cta">[ADD CONTACT / REPO: github.com/... | contact@mieruka.tn]</b>
        </div>
      </div>
    </div>
  );
}
