import type { CSSProperties } from "react";

/** Transition delay for one element, in seconds, plus any extra CSS custom properties. */
export const d = (s: number, extra: Record<string, string | number> = {}) =>
  ({ "--d": `${s}s`, ...extra }) as CSSProperties;

const f = (v: number) => Math.round(v * 10) / 10;

/** Catmull-Rom spline through the points, with control points clamped to [lo, hi] in y. */
export function smooth(pts: [number, number][], lo = -Infinity, hi = Infinity) {
  const c = (v: number) => Math.min(hi, Math.max(lo, v));
  let out = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    out += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(c(p1[1] + (p2[1] - p0[1]) / 6))} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(c(p2[1] - (p3[1] - p1[1]) / 6))} ${f(p2[0])} ${f(p2[1])}`;
  }
  return out;
}
