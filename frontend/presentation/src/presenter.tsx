import { useEffect, useRef, useState } from "react";
import { BACKUP, CHECKLIST, LAST_LINE, QA, SCRIPT, SHORT, SLIDES, fmtTime, type Line } from "./content";
import { START, go, next, prev, same, toggleBackup, type Pos } from "./nav";
import { listen, post, setPeer } from "./sync";

type Tab = "script" | "short" | "qa" | "check";
const TOTAL = 300;

/** "#presenter-abc123" follows deck abc123; a bare "#presenter" follows the first deck that answers. */
const BOUND = /^#presenter-(\w+)/.exec(location.hash)?.[1] ?? "";

export function Presenter() {
  const [pos, setPos] = useState<Pos>(START);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [linked, setLinked] = useState(false);
  const [tab, setTab] = useState<Tab>("script");
  const [now, setNow] = useState(() => Date.now());
  const posRef = useRef(pos);
  posRef.current = pos;
  const deck = useRef(BOUND);

  useEffect(() => {
    document.title = "Mieruka · presenter";
    document.body.classList.add("presenter-body");
    if (window.opener) setPeer(window.opener as Window);
    const stop = listen((msg, from, source) => {
      if (msg.kind !== "state") return;
      if (deck.current && from !== deck.current) return;
      deck.current = from;
      if (source && source !== window) setPeer(source);
      setLinked(true);
      setPos((p) => (same(p, msg.pos) ? p : msg.pos));
      setStartedAt(msg.startedAt);
    });
    const hello = () => post(deck.current, { kind: "hello" });
    hello();
    const helloTimer = window.setInterval(hello, 2000);
    const tick = window.setInterval(() => setNow(Date.now()), 250);
    return () => { stop(); clearInterval(helloTimer); clearInterval(tick); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const p = posRef.current;
      let target: Pos;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) target = next(p);
      else if (["ArrowLeft", "PageUp"].includes(e.key)) target = prev(p);
      else if (e.key === "b" || e.key === "B") target = toggleBackup(p);
      else if (/^[1-7]$/.test(e.key)) target = go(Number(e.key) - 1);
      else return;
      e.preventDefault();
      setPos(target);
      post(deck.current, { kind: "set", pos: target });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const send = (p: Pos) => { setPos(p); post(deck.current, { kind: "set", pos: p }); };
  const timer = (t: number | null) => { setStartedAt(t); post(deck.current, { kind: "timer", startedAt: t }); };

  const meta = SLIDES[pos.slide];
  const upcoming = SLIDES[pos.slide + 1];
  const elapsed = startedAt ? (now - startedAt) / 1000 : 0;
  const late = startedAt ? elapsed - meta.end : 0;
  const status = !startedAt ? "Timer starts on your first click" : late > 0 ? `${fmtTime(late)} over this section` : `${fmtTime(meta.end - elapsed)} left in this section`;
  const buildHint = meta.builds > pos.step ? "→ plays the build on this slide" : upcoming ? `→ goes to ${upcoming.chapter}` : "Last slide";

  return (
    <div className="pv">
      <header className="pv-top">
        <div className="pv-now">
          <span className="pv-n">{pos.slide + 1} / {SLIDES.length}</span>
          <b>{meta.chapter}</b>
          <span className="pv-window">plan {fmtTime(meta.start)}–{fmtTime(meta.end)}</span>
          {pos.backup !== null && <span className="pv-badge">Backup {pos.backup + 1}/{BACKUP.length}</span>}
        </div>
        <div className={`pv-clock${late > 0 ? " late" : ""}`}>
          <span className="pv-time">{fmtTime(elapsed)}</span>
          <span className="pv-of">/ 5:00</span>
        </div>
      </header>

      <div className="pv-bar" aria-hidden>
        {SLIDES.map((m, i) => (
          <i key={m.id} className={i === pos.slide ? "now" : i < pos.slide ? "done" : ""} style={{ flex: m.end - m.start }}>
            <em>{m.name}</em>
          </i>
        ))}
        {startedAt && <b className="pv-head" style={{ left: `${Math.min(100, (elapsed / TOTAL) * 100)}%` }} />}
      </div>

      <div className="pv-main">
        <section className="pv-script">
          <nav className="pv-tabs">
            {([["script", "Script"], ["short", "2-minute version"], ["qa", "Jury Q&A"], ["check", "Before going on"]] as [Tab, string][]).map(([k, l]) => (
              <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
            ))}
          </nav>
          <div className="pv-body">
            {tab === "script" && <Lines lines={SCRIPT[meta.id]} />}
            {tab === "short" && (
              <>
                {SHORT.map((s) => (
                  <div key={s.slide} className={s.slide === meta.id ? "pv-short now" : "pv-short"}>
                    <span className="pv-short-n">{SLIDES.findIndex((m) => m.id === s.slide) + 1}</span>
                    <Lines lines={s.lines} />
                  </div>
                ))}
                <p className="pv-last"><b>Cut off mid-sentence?</b> {LAST_LINE}</p>
              </>
            )}
            {tab === "qa" && (
              <dl className="pv-qa">{QA.map((q) => <div key={q.q}><dt>{q.q}</dt><dd>{q.a}</dd></div>)}</dl>
            )}
            {tab === "check" && <ol className="pv-check">{CHECKLIST.map((c) => <li key={c}>{c}</li>)}</ol>}
          </div>
        </section>

        <aside className="pv-side">
          <div className="pv-card">
            <span className="pv-k">Pace</span>
            <b className={late > 0 ? "late" : ""}>{status}</b>
            <span className="pv-k">Next press</span>
            <b>{buildHint}</b>
            {upcoming && <><span className="pv-k">Then</span><b>{upcoming.chapter}</b><p>{firstLine(SCRIPT[upcoming.id])}</p></>}
          </div>
          <div className="pv-buttons">
            <button onClick={() => send(prev(pos))}>← Back</button>
            <button className="primary" onClick={() => send(next(pos))}>Next →</button>
            <button onClick={() => send(toggleBackup(pos))}>{pos.backup === null ? "Open backup demo (B)" : "Close backup demo"}</button>
            <button onClick={() => timer(Date.now())}>{startedAt ? "Restart timer" : "Start timer"}</button>
          </div>
          <p className={`pv-link${linked ? " ok" : ""}`}>
            {linked ? "Connected to the deck" : "Waiting for the deck. Open this window from the deck with P."}
          </p>
        </aside>
      </div>
    </div>
  );
}

function Lines({ lines }: { lines: Line[] }) {
  return (
    <>
      {lines.map((l, i) =>
        "say" in l
          ? <p key={i} className="pv-say">{l.say}</p>
          : <p key={i} className="pv-cue"><span>[{l.cue}]</span>{l.note && <em>{l.note}</em>}</p>)}
    </>
  );
}

function firstLine(lines: Line[]) {
  const l = lines.find((x) => "say" in x);
  return l && "say" in l ? l.say : "";
}
