import type { CSSProperties, ReactNode } from "react";
import icon from "../../../assets/mieruka/mieruka-app-icon-v8-rounded.svg";
import { d } from "./util";

export function Chapter({ n, label }: { n: number; label: string }) {
  return (
    <div className="chapter rv" style={d(0)}>
      <span className="num">{String(n).padStart(2, "0")}</span>
      <span>{label}</span>
    </div>
  );
}

/** The one honesty label, styled like the app's own "Données simulées" pill. */
export function SimTag({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span className="simtag rv" style={style}>
      <i />
      {children}
    </span>
  );
}

export function AppIcon({ size }: { size: number }) {
  return <img src={icon} alt="" width={size} height={size} className="appicon" />;
}

/**
 * Shows part of a real screenshot. Coordinates are CSS pixels of the 1600 × 1000 capture;
 * the crop is scaled to `width`.
 */
export function Crop({ src, x, y, w, h, width, label }: { src: string; x: number; y: number; w: number; h: number; width: number; label: string }) {
  const k = width / w;
  return (
    <div className="crop" style={{ width, height: h * k }} role="img" aria-label={label}>
      <img src={src} alt="" style={{ width: 1600 * k, left: -x * k, top: -y * k }} />
    </div>
  );
}
