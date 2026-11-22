import { AppIcon } from "../ui";
import { d, smooth } from "../util";

const PTS: [number, number][] = Array.from({ length: 29 }, (_, i) => [i * 40, 40 + Math.sin(i * 0.9) * 6 * Math.exp(-i / 14)]);
const PATH = smooth(PTS, 20, 60);
const END = PTS[PTS.length - 1];

export function Closing() {
  return (
    <div className="close">
      <div className="kanji" aria-hidden>
        <span className="k-outline">見える化</span>
        <span className="k-light">見える化</span>
      </div>

      <h1 className="display">
        <span className="ln rv" style={d(0.2)}>See the waste</span>
        <span className="ln ice rv" style={d(0.32)}>before you pay for it.</span>
      </h1>
      <p className="lead rv" style={d(0.6)}>Mieruka makes household energy visible, appliance by appliance.</p>

      <svg className="close-trace" width={1160} height={80} aria-hidden>
        <path d={PATH} pathLength={1} className="trace draw" style={d(0.8, { "--dur": "1.6s" })} />
        <circle cx={END[0]} cy={END[1]} r={7} className="end pop" style={d(2.3)} />
        <circle cx={END[0]} cy={END[1]} r={7} className="end-glow" style={d(2.4)} />
      </svg>

      <div className="sign rv" style={d(1.0)}>
        <AppIcon size={44} />
        <b>Mieruka</b>
        <span>Zero-Ichi · KIZUNA 2026, Smart Energy</span>
      </div>
    </div>
  );
}
