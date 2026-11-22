import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { BACKUP, DEMO_STEPS, SCRIPT, SLIDES } from "./content";
import { DEMO, LAST, START, go, next, prev, same, toggleBackup, type Pos } from "./nav";
import { deckId, listen, post, setPeer } from "./sync";

import { VIEWS } from "./slides";

import s01 from "../screens/01-household.png";
import s02 from "../screens/02-fault-live.png";
import s03 from "../screens/03-alert-dashboard.png";
import s04 from "../screens/04-insights.png";
import s05 from "../screens/05-evidence.png";
import s06 from "../screens/06-correction.png";
import s07 from "../screens/07-after.png";

const SHOTS: Record<string, string> = {
  "01-household": s01, "02-fault-live": s02, "03-alert-dashboard": s03, "04-insights": s04,
  "05-evidence": s05, "06-correction": s06, "07-after": s07,
};

function fromHash(): Pos {
  const m = /^#(\d+)(?:\.(\d+))?$/.exec(location.hash);
  if (!m) return START;
  const slide = Math.max(0, Math.min(LAST, Number(m[1]) - 1));
  return { slide, step: Math.min(SLIDES[slide].builds, Number(m[2] || 0)), backup: null };
}

interface View { pos: Pos }

export function Deck() {
  const [view, setView] = useState<View>(() => ({ pos: fromHash() }));
  const pos = view.pos;
  const [overview, setOverview] = useState(false);
  const [sel, setSel] = useState(0);
  const [help, setHelp] = useState(false);
  const [notes, setNotes] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const [idle, setIdle] = useState(false);
  const presenter = useRef<Window | null>(null);
  const [id] = useState(deckId);
  const state = useRef({ pos, overview, sel, help, startedAt });
  state.current = { pos, overview, sel, help, startedAt };

  const move = useCallback((p: Pos) => {
    setView((v) => {
      if (same(v.pos, p)) return v;
      return { pos: p };
    });
    setStartedAt((t) => t ?? Date.now());
  }, []);

  useEffect(() => {
    const hash = `#${pos.slide + 1}${pos.step ? `.${pos.step}` : ""}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
  }, [pos.slide, pos.step]);

  useEffect(() => { post(id, { kind: "state", pos, startedAt }); }, [id, pos, startedAt]);

  useEffect(() => listen((msg, from, source) => {
    if (from !== id && !(msg.kind === "hello" && from === "")) return;
    if (source && source !== window) { setPeer(source); presenter.current = source; }
    if (msg.kind === "set") move(msg.pos);
    if (msg.kind === "timer") setStartedAt(msg.startedAt);
    if (msg.kind === "hello") post(id, { kind: "state", pos: state.current.pos, startedAt: state.current.startedAt });
  }), [id, move]);

  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    let t = 0;
    const wake = () => { setIdle(false); clearTimeout(t); t = window.setTimeout(() => setIdle(true), 2200); };
    wake();
    window.addEventListener("mousemove", wake);
    window.addEventListener("keydown", wake);
    return () => { clearTimeout(t); window.removeEventListener("mousemove", wake); window.removeEventListener("keydown", wake); };
  }, []);

  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  const openPresenter = useCallback(() => {
    const p = window.open(`mieruka-pitch.html#presenter-${id}`, "presenter", "width=1280,height=800");
    if (p) { presenter.current = p; setPeer(p); }
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const { pos: p, overview: ov, sel: sl, help: hp } = state.current;
      const k = e.key;
      if (hp) { if (k === "Escape" || k === "?" || k === "h") setHelp(false); e.preventDefault(); return; }
      if (ov) {
        if (k === "ArrowRight" || k === "ArrowDown") setSel(Math.min(LAST, sl + (k === "ArrowDown" ? 4 : 1)));
        else if (k === "ArrowLeft" || k === "ArrowUp") setSel(Math.max(0, sl - (k === "ArrowUp" ? 4 : 1)));
        else if (k === "Enter" || k === " ") { move(go(sl)); setOverview(false); }
        else if (k === "Escape" || k === "o") setOverview(false);
        else if (/^[0-9]$/.test(k)) {
          const num = k === "0" ? 10 : Number(k);
          if (num <= SLIDES.length) { move(go(num - 1)); setOverview(false); }
        }
        e.preventDefault();
        return;
      }
      switch (k) {
        case "ArrowRight": case "PageDown": case " ": case "Enter": move(next(p)); break;
        case "ArrowLeft": case "PageUp": case "Backspace": move(prev(p)); break;
        case "Home": move(START); break;
        case "End": move(go(LAST)); break;
        case "Escape": if (p.backup !== null) move({ ...p, backup: null }); else { setSel(p.slide); setOverview(true); } break;
        case "o": setSel(p.slide); setOverview(true); break;
        case "b": case "B": move(toggleBackup(p)); break;
        case "f": case "F": fullscreen(); break;
        case "p": case "P": openPresenter(); break;
        case "n": case "N": setNotes((v) => !v); break;
        case "t": case "T": setStartedAt(Date.now()); break;
        case "?": case "h": setHelp(true); break;
        default:
          if (/^[0-9]$/.test(k)) {
            const num = k === "0" ? 10 : Number(k);
            if (num <= SLIDES.length) move(go(num - 1));
          }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, fullscreen, openPresenter]);

  const swipe = useRef<number | null>(null);
  const cur = pos.slide;
  const tone = pos.backup !== null ? "night" : SLIDES[cur].tone;

  return (
    <div className={`viewport ${tone}${idle ? " idle" : ""}`}
      onPointerDown={(e) => { if (e.pointerType !== "mouse") swipe.current = e.clientX; }}
      onPointerUp={(e) => {
        if (swipe.current === null) return;
        const dx = e.clientX - swipe.current;
        swipe.current = null;
        if (Math.abs(dx) > 60) move(dx < 0 ? next(pos) : prev(pos));
      }}>
      <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        {SLIDES.map((m, i) => {
          const View = VIEWS[m.id];
          const isCurrent = i === cur;
          return (
            <section key={m.id} className={`slide ${m.tone} s-${m.id} ${isCurrent ? "on" : ""}`}
              aria-hidden={!isCurrent} aria-label={`Slide ${i + 1} of ${SLIDES.length}: ${m.chapter}`}>
              <View />
            </section>
          );
        })}

        <Backup frame={pos.backup} />

        {SLIDES[cur].id !== "close" && !overview && (
          <div className={`progress ${tone}`} aria-hidden>
            <span className="count">{cur + 1} / {SLIDES.length}</span>
            <span className="segs">
              {SLIDES.map((m, i) => <i key={m.id} className={i < cur ? "done" : i === cur ? "now" : ""} />)}
            </span>
          </div>
        )}

        {notes && <Notes slide={cur} />}
        {overview && <Overview sel={sel} cur={cur} onPick={(i) => { move(go(i)); setOverview(false); }} onHover={setSel} />}
        {help && <Help onClose={() => setHelp(false)} />}
      </div>

      <div className="controls">
        <button onClick={() => { setSel(cur); setOverview(true); }} aria-label="Overview (Esc)" title="Overview (Esc)"><GridIcon /></button>
        <button onClick={openPresenter} aria-label="Presenter window (P)" title="Presenter window (P)"><NotesIcon /></button>
        <button onClick={fullscreen} aria-label="Full screen (F)" title="Full screen (F)"><FullIcon /></button>
        <button onClick={() => setHelp(true)} aria-label="Keyboard shortcuts (?)" title="Keyboard shortcuts (?)">?</button>
      </div>
    </div>
  );
}

function Backup({ frame }: { frame: number | null }) {
  const [last, setLast] = useState(0);
  useEffect(() => { if (frame !== null) setLast(frame); }, [frame]);
  const i = frame ?? last;
  const f = BACKUP[i];
  const step = DEMO_STEPS[f.step - 1];
  return (
    <div className={`backup${frame !== null ? " open" : ""}`} aria-hidden={frame === null}>
      <div className="bk-head">
        <span>Backup demo · screenshots of the running prototype, 22 Nov 2026 · simulated data</span>
        <span>{i + 1} / {BACKUP.length}</span>
      </div>
      <div className="bk-img" key={f.key}>
        <img src={SHOTS[f.key]} alt={f.title} />
        {f.rings.map((r, k) => (
          <span key={k} className="ring" style={{
            left: `${(r.x / 1600) * 100}%`, top: `${(r.y / 1000) * 100}%`,
            width: `${(r.w / 1600) * 100}%`, height: `${(r.h / 1000) * 100}%`,
          }}><b>{k + 1}</b></span>
        ))}
      </div>
      <div className="bk-side" key={`side-${f.key}`}>
        <span className="bk-step">Step {step.n} · {step.title}</span>
        <h3>{f.title}</h3>
        <p>{f.caption}</p>
        <ol>
          {f.rings.map((r, k) => <li key={k}><b>{k + 1}</b>{r.label}</li>)}
        </ol>
      </div>
      <div className="bk-dots">
        {BACKUP.map((b, k) => <i key={b.key} className={k === i ? "now" : k < i ? "done" : ""} />)}
      </div>
    </div>
  );
}

function Overview({ sel, cur, onPick, onHover }: { sel: number; cur: number; onPick: (i: number) => void; onHover: (i: number) => void }) {
  return (
    <div className="overview" role="dialog" aria-label="Slide overview">
      <div className="ov-head"><b>Overview</b><span>Arrows to choose, Enter to open, Esc to close</span></div>
      <div className="ov-grid">
        {SLIDES.map((m, i) => {
          const View = VIEWS[m.id];
          return (
            <button key={m.id} className={`ov-item${i === sel ? " sel" : ""}${i === cur ? " cur" : ""}`}
              onClick={() => onPick(i)} onMouseEnter={() => onHover(i)}>
              <span className={`ov-thumb ${m.tone}`}>
                <span className="ov-scale">
                  <section className={`slide ${m.tone} s-${m.id} on static`}><View /></section>
                </span>
              </span>
              <span className="ov-label"><b>{String(i + 1).padStart(2, "0")}</b>{m.chapter}<em>{fmt(m.start)}–{fmt(m.end)}</em></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function Notes({ slide }: { slide: number }) {
  return (
    <aside className="notes">
      <div className="notes-head"><b>Notes · {SLIDES[slide].chapter}</b><span>Visible to the audience. Press P for a private presenter window.</span></div>
      <div className="notes-body">
        {SCRIPT[SLIDES[slide].id].map((l, i) =>
          "say" in l ? <p key={i}>{l.say}</p> : <p key={i} className="cue">[{l.cue}]{l.note ? <em> {l.note}</em> : null}</p>)}
      </div>
    </aside>
  );
}

const KEYS: [string, string][] = [
  ["→  Space  Page Down", "Next slide"],
  ["←  Page Up", "Previous slide"],
  ["1 – 9, 0", "Jump to slide 1–10"],
  ["Esc  O", "Overview"],
  ["B", `Backup demo screenshots (slide ${DEMO + 1})`],
  ["P", "Presenter window: script, timer, Q&A"],
  ["F", "Full screen"],
  ["N", "Notes on this screen (the audience sees them)"],
  ["T", "Restart the timer"],
];

function Help({ onClose }: { onClose: () => void }) {
  return (
    <div className="help" role="dialog" aria-label="Keyboard shortcuts" onClick={onClose}>
      <div className="help-card" onClick={(e) => e.stopPropagation()}>
        <b>Keyboard</b>
        <dl>{KEYS.map(([k, v]) => <Row key={k} k={k} v={v} />)}</dl>
        <p>A presentation remote that sends Page Up / Page Down works too.</p>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return <><dt>{k.split("  ").map((x) => <kbd key={x}>{x}</kbd>)}</dt><dd>{v}</dd></>;
}

const GridIcon = () => <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><rect x="1.5" y="1.5" width="6" height="6" rx="1.5" /><rect x="10.5" y="1.5" width="6" height="6" rx="1.5" /><rect x="1.5" y="10.5" width="6" height="6" rx="1.5" /><rect x="10.5" y="10.5" width="6" height="6" rx="1.5" /></svg>;
const NotesIcon = () => <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><rect x="1.5" y="2.5" width="15" height="10" rx="2" /><path d="M6 16h6M9 12.5V16" /></svg>;
const FullIcon = () => <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><path d="M2 6.5V2h4.5M16 6.5V2h-4.5M2 11.5V16h4.5M16 11.5V16h-4.5" /></svg>;
