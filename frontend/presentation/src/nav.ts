import { BACKUP, SLIDES } from "./content";

/** Where the talk is: slide, build step inside it, and the backup frame when the backup is open. */
export interface Pos {
  slide: number;
  step: number;
  backup: number | null;
}

export const LAST = SLIDES.length - 1;
export const DEMO = SLIDES.findIndex((s) => s.id === "demo");
export const START: Pos = { slide: 0, step: 0, backup: null };

export function next(p: Pos): Pos {
  if (p.backup !== null) {
    return p.backup < BACKUP.length - 1 ? { ...p, backup: p.backup + 1 } : { slide: DEMO + 1, step: 0, backup: null };
  }
  if (p.step < SLIDES[p.slide].builds) return { ...p, step: p.step + 1 };
  if (p.slide < LAST) return { slide: p.slide + 1, step: 0, backup: null };
  return p;
}

export function prev(p: Pos): Pos {
  if (p.backup !== null) return p.backup > 0 ? { ...p, backup: p.backup - 1 } : { ...p, backup: null };
  if (p.step > 0) return { ...p, step: p.step - 1 };
  if (p.slide > 0) return { slide: p.slide - 1, step: SLIDES[p.slide - 1].builds, backup: null };
  return p;
}

export function go(slide: number): Pos {
  return { slide: Math.max(0, Math.min(LAST, slide)), step: 0, backup: null };
}

/** Opening the backup always lands on the demo slide; closing it stays there. */
export function toggleBackup(p: Pos): Pos {
  return p.backup === null ? { slide: DEMO, step: 0, backup: 0 } : { ...p, backup: null };
}

export function same(a: Pos, b: Pos) {
  return a.slide === b.slide && a.step === b.step && a.backup === b.backup;
}
