/* eslint-disable react-refresh/only-export-components -- the deck has no hot reload; VIEWS is the only non-component export */
import type { ComponentType } from "react";
import icon from "../../../assets/mieruka/mieruka-app-icon-v8-rounded.svg";
import dashboard from "../screens/03-alert-dashboard.png";
import household from "../screens/01-household.png";
import evidence from "../screens/05-evidence.png";
import { STEG_2014, STEG_2019, STEG_GROWTH } from "./data";

/**
 * Plain cuts: no transitions, no builds, no animation. Each slide is one idea.
 * Screenshot crops use CSS pixels of the 1600 × 1000 capture.
 */

function Crop({ src, x, y, w, h, width, label }: { src: string; x: number; y: number; w: number; h: number; width: number; label: string }) {
  const k = width / w;
  return (
    <div className="crop" style={{ width, height: h * k }} role="img" aria-label={label}>
      <img src={src} alt="" style={{ width: 1600 * k, left: -x * k, top: -y * k }} />
    </div>
  );
}

const fmt = (v: number) => Math.round(v).toLocaleString("en-US");

/* 1 · Cover: the opening question, then the product, then the team */
const TEAM = ["Emna Ben Othman", "Ilef Ghanmi", "Amine Missaoui", "Ahmed Ridha Lazhari"];

function Cover() {
  return (
    <div className="cover">
      <p className="top">KIZUNA 2026 · Smart Energy</p>
      <h1 className="q">Do you know where your electricity money actually goes?</h1>
      <div className="rule" />
      <div className="name"><img src={icon} alt="" width={120} height={120} /><span>Mieruka</span><i className="jp">見える化</i></div>
      <p className="tag">See the waste. Understand it. Act on it.</p>
      <div className="team">
        <b>Team Zero-Ichi</b>
        <ul>{TEAM.map((n) => <li key={n}>{n}</li>)}</ul>
      </div>
    </div>
  );
}

/* 2 · The problem: one statistic, one chart */
function Hook() {
  const base = 430;
  const h = (v: number) => (v / STEG_2019) * 340;
  return (
    <div className="hook">
      <p className="kicker">Tunisia · average household electricity use, 2014 vs 2019</p>
      <div className="big red">+{STEG_GROWTH}%</div>
      <p className="cap">more electricity per home in five years. The bill still shows one number.</p>
      <svg className="bars" width={560} height={520} role="img" aria-label={`Average household electricity: ${fmt(STEG_2014)} kWh in 2014, ${fmt(STEG_2019)} kWh in 2019`}>
        <rect x={20} y={base - h(STEG_2014)} width={220} height={h(STEG_2014)} className="b14" />
        <rect x={300} y={base - h(STEG_2019)} width={220} height={h(STEG_2019)} className="b19" />
        <text x={130} y={base - h(STEG_2014) - 20} textAnchor="middle" className="bv">{fmt(STEG_2014)}</text>
        <text x={410} y={base - h(STEG_2019) - 20} textAnchor="middle" className="bv">{fmt(STEG_2019)}</text>
        <text x={130} y={base + 44} textAnchor="middle" className="bl">2014</text>
        <text x={410} y={base + 44} textAnchor="middle" className="bl">2019</text>
      </svg>
      <p className="src">Source: STEG household survey 2019, via L’Économiste Maghrébin, 19 Feb 2023</p>
    </div>
  );
}

/* 3 · Validate: one verified statistic, one tiny chart, one news reference */
function Validate() {
  return (
    <div className="validate">
      <div className="big red">18%</div>
      <p className="cap">of household electricity now goes to air conditioners.</p>
      <div className="uses" role="img" aria-label="Share of household electricity: refrigerators about 36 percent, air conditioners 18 percent">
        <div className="row"><span>Refrigerators</span><i style={{ width: 360 }} /><b>≈36%</b></div>
        <div className="row hot"><span>Air conditioners</span><i style={{ width: 180 }} /><b>18%</b></div>
      </div>
      <p className="src">Source: ANME and STEG study, 2024, as reported below. Other uses are not itemized there.</p>
      <div className="news">
        <p className="head">“Tunisie : qui consomme le plus d’électricité à la maison ? Ce n’est pas le climatiseur !”</p>
        <p className="meta">L’Économiste Maghrébin · Dorsaf Selmi · 18 July 2026</p>
        <p className="url">leconomistemaghrebin.com/2026/07/18/tunisie-qui-consomme-le-plus-delectricite-a-la-maison/</p>
      </div>
    </div>
  );
}

/* 4 · Problem statement: three columns */
function Clarify() {
  return (
    <div className="clarify">
      <h1>This poses 3 problems.</h1>
      <div className="cols">
        <div className="col">
          <div className="frame"><Crop src={household} x={377} y={604} w={1072} h={396} width={520} label="Each appliance shown on its own in the household dashboard" /></div>
          <span className="n">01</span>
          <h2>Invisible</h2>
          <p>One total hides every appliance.</p>
        </div>
        <div className="col">
          <div className="frame"><Crop src={household} x={1106} y={340} w={342} h={90} width={520} label="Estimated STEG bill" /></div>
          <span className="n">02</span>
          <h2>Late</h2>
          <p>The bill arrives after the waste.</p>
        </div>
        <div className="col">
          <div className="frame"><Crop src={evidence} x={1049} y={423} w={527} h={208} width={520} label="Cause and action on an alert" /></div>
          <span className="n">03</span>
          <h2>Passive</h2>
          <p>Nothing says what to change.</p>
        </div>
      </div>
    </div>
  );
}

/* 5 · Solution */
function Solution() {
  return (
    <div className="solution">
      <p className="jp">見える化</p>
      <h1>Mieruka</h1>
      <p className="one">Shows each household which appliance wastes energy, why, and what to do.</p>
      <img className="shot" src={dashboard} alt="Mieruka household dashboard with an anomaly alert" />
      <p className="sim">Simulated data</p>
    </div>
  );
}

/* 6 · Demo */
function Demo() {
  return (
    <div className="demo">
      <h1>DEMO</h1>
      <p className="sim">Simulated data · live prototype</p>
      <img className="shot" src={evidence} alt="Alert evidence panel with the correction button" />
    </div>
  );
}

/* 7 · Architecture */
function Architecture() {
  return (
    <div className="arch">
      <h1>How it is built</h1>
      <div className="flow">
        <div className="box">
          <span className="lbl">Data</span>
          <b>Energy model</b>
          <span className="n">17 appliance profiles</span>
          <span className="mono">next: POST /api/mesures</span>
        </div>
        <svg className="arrow" width={120} height={40} aria-hidden><path d="M0 20 H110 M92 6 L110 20 L92 34" /></svg>
        <div className="box dark">
          <span className="lbl">Back end</span>
          <b>Django 5.2</b>
          <span className="n">SQLite</span>
          <span className="n">5 explainable rules</span>
        </div>
        <svg className="arrow" width={120} height={40} aria-hidden><path d="M0 20 H110 M92 6 L110 20 L92 34" /></svg>
        <div className="box">
          <span className="lbl">Front end</span>
          <b>React 19</b>
          <span className="n">TypeScript · Vite</span>
          <span className="n">Tailwind CSS</span>
        </div>
      </div>
      <p className="foot">40 automated tests on the energy modules pass.</p>
    </div>
  );
}

/* 8 · Next steps */
function Next() {
  const rows = ["Real households", "Certified hardware", "Rules vs. a learned model"];
  return (
    <div className="next">
      <h1>Next</h1>
      <ol>
        {rows.map((r, i) => <li key={r}><span>0{i + 1}</span>{r}</li>)}
      </ol>
      <p className="foot">None of this is built yet.</p>
    </div>
  );
}

/* 9 · Thank you */
function Close() {
  return (
    <div className="close">
      <h1>See the waste before you pay for it.</h1>
      <div className="sign"><img src={icon} alt="" width={56} height={56} /><b>Mieruka</b><span>Team Zero-Ichi · KIZUNA 2026</span></div>
    </div>
  );
}

export const VIEWS: Record<string, ComponentType> = {
  cover: Cover,
  "intro-problem": Hook,
  "validate-problem": Validate,
  "clarify-problem": Clarify,
  solution: Solution,
  demo: Demo,
  architecture: Architecture,
  roadmap: Next,
  close: Close,
};
