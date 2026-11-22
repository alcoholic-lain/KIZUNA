import { useId } from "react";
import { BILL, DAY, STANDBY, num } from "../data";
import { AppIcon, Chapter } from "../ui";
import { d, smooth } from "../util";

const W = 512;
const LANE = 86;
const BAND_TOP = 32;
const BAND_H = 44;
const PEAK = Math.max(...DAY.flatMap((l) => l.hourly));
const xAt = (h: number) => (h * W) / 23;

function lane(hourly: number[], i: number) {
  const y0 = i * LANE + BAND_TOP + BAND_H;
  // Square-root scale so small loads stay visible; the exact daily kWh is printed beside each lane.
  const pts = hourly.map((v, h) => [xAt(h), y0 - Math.sqrt(v / PEAK) * BAND_H] as [number, number]);
  const line = smooth(pts, y0 - BAND_H, y0);
  return { line, area: `${line} L${W} ${y0} L0 ${y0} Z`, y0 };
}

export function Hook() {
  const clip = useId().replace(/:/g, "");
  const s = STANDBY;
  const tvY = s.lane * LANE;
  const box = { x: xAt(s.from) - 8, y: tvY + BAND_TOP - 1, w: xAt(s.to) - xAt(s.from) + 16, h: BAND_H + 7 };
  const r = 8;
  const boxPath = `M${box.x + r} ${box.y} H${box.x + box.w - r} Q${box.x + box.w} ${box.y} ${box.x + box.w} ${box.y + r} V${box.y + box.h - r} Q${box.x + box.w} ${box.y + box.h} ${box.x + box.w - r} ${box.y + box.h} H${box.x + r} Q${box.x} ${box.y + box.h} ${box.x} ${box.y + box.h - r} V${box.y + r} Q${box.x} ${box.y} ${box.x + r} ${box.y} Z`;
  const nightW = (DAY[s.lane].hourly.slice(s.from, s.to).reduce((a, b) => a + b, 0) / (s.to - s.from)) * 1000;

  return (
    <div className="hook">
      <Chapter n={1} label="The problem" />
      <div className="brand rv" style={d(0.05)}>
        <AppIcon size={36} />
        <b>Mieruka</b>
        <span>KIZUNA 2026</span>
      </div>

      <h1 className="display">
        <span className="ln rv" style={d(0.12)}>Your electricity bill</span>
        <span className="ln rv" style={d(0.2)}>tells you what you paid.</span>
        <span className="ln ice rv gap" style={d(1.05)}>It never tells you</span>
        <span className="ln ice rv" style={d(1.13)}>what you wasted.</span>
      </h1>

      <div className="bill rv" style={d(0.5, { "--ry": "40px" })}>
        <div className="bill-top"><span>Electricity bill</span><span>November</span></div>
        <div className="bill-total"><b>{BILL.total}</b><span>DT</span></div>
        <div className="bill-kwh">{BILL.kwh} kWh this month</div>
        <div className="bill-rule" />
        <div className="bill-inside">
          <span className="q">What’s inside?</span>
          <span className="a">Inside one day · 21 November</span>
        </div>
        <div className="lanes">
          <svg className="blank" width={W} height={LANE * 5} aria-hidden>
            {DAY.map((_, i) => (
              <line key={i} x1={0} x2={W} y1={i * LANE + BAND_TOP + BAND_H} y2={i * LANE + BAND_TOP + BAND_H} />
            ))}
          </svg>
          <svg className="data" width={W} height={LANE * 5} role="img"
            aria-label="Hourly consumption of five appliances on one day; the TV stays on standby all night">
            {DAY.map((l, i) => {
              const { line, area, y0 } = lane(l.hourly, i);
              const total = l.hourly.reduce((a, b) => a + b, 0);
              const hot = i === s.lane;
              return (
                <g key={l.name} className={hot ? "lane hot" : "lane"}>
                  <text x={0} y={i * LANE + 20} className="lane-name">{l.name}</text>
                  <text x={W} y={i * LANE + 20} className="lane-kwh" textAnchor="end">{num(total, 2)} kWh</text>
                  <path d={area} className="lane-area" />
                  <path d={line} className="lane-line" />
                  <line x1={0} x2={W} y1={y0} y2={y0} className="lane-base" />
                </g>
              );
            })}
            <g className="standby">
              <clipPath id={clip}><path d={boxPath} /></clipPath>
              <path d={lane(DAY[s.lane].hourly, s.lane).line} clipPath={`url(#${clip})`} className="night-line" />
              <path d={boxPath} pathLength={1} className="box" />
              <text x={box.x + box.w + 16} y={tvY + 20}>standby all night · ~{Math.round(nightW)} W</text>
            </g>
          </svg>
          <div className="scan" />
        </div>
      </div>

      <p className="foot rv" style={d(1.4)}>
        Demo household in the Mieruka prototype. The bill estimate and the curves are simulated.
      </p>
    </div>
  );
}
