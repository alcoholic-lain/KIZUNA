import type { SceneDevice } from "../data/types";
import { CATEGORY_ORDER, catalogEntry, type CatalogEntry, type V3 } from "../models/catalog";

/** Pure layout of the gallery: one bay per installation, grouped by room. */

export type Bay = {
  id: number;
  code: string;
  spec: CatalogEntry;
  x0: number;
  width: number;
  centerX: number;
  socketX: number;
  modelX: number;
  /** Absolute cord points from the adapter outlet to the appliance inlet (empty when not modelled). */
  cable: V3[];
};

export type RoomSpan = { label: string; x0: number; x1: number };
export type GalleryLayout = { bays: Bay[]; rooms: RoomSpan[]; width: number };

const SOCKET_OFFSET = 0.22;
const LEAD = 0.5;
const TAIL = 0.3;
/** Where the cord leaves the adapter (round plug) or the charger brick, relative to the socket centre. */
const PLUG_OUT: V3 = [0, -0.026, 0.084];
const CHARGER_OUT: V3 = [0, -0.06, 0.078];

function cablePoints(spec: CatalogEntry, socketX: number, modelX: number): V3[] {
  if (!spec.modelled) return [];
  const o = spec.atSocket ? CHARGER_OUT : PLUG_OUT;
  const start: V3 = [socketX + o[0], spec.socketY + o[1], o[2]];
  const inlet: V3 = [modelX + spec.inlet[0], spec.elevation + spec.inlet[1], spec.inlet[2]];
  const via = (spec.via ?? []).map((p): V3 => [modelX + p[0], spec.elevation + p[1], p[2]]);
  const low = inlet[1] < 0.45 || via.some((p) => p[1] < 0.1) ? 0.012 : Math.max(0.012, Math.min(start[1], inlet[1]) - 0.15);
  const pts: V3[] = [start, [start[0], Math.max(low + 0.05, start[1] - 0.06), 0.055]];
  const nextX = via.length ? via[0][0] : inlet[0];
  const nextZ = via.length ? via[0][2] : inlet[2];
  pts.push([start[0] + (nextX - start[0]) * 0.18, low, Math.max(0.03, nextZ * 0.5)]);
  if (!via.length) pts.push([inlet[0] - (inlet[0] - start[0]) * 0.12, low, Math.max(0.03, inlet[2] * 0.85)]);
  pts.push(...via);
  if (!via.length && inlet[1] - low > 0.08) pts.push([inlet[0], Math.max(low, inlet[1] - 0.06), inlet[2]]);
  pts.push(inlet);
  return pts;
}

const orderOf = (code: string) => {
  const i = CATEGORY_ORDER.indexOf(code);
  return i < 0 ? CATEGORY_ORDER.length : i;
};

export function layoutGallery(devices: Pick<SceneDevice, "id" | "category" | "room" | "name">[]): GalleryLayout {
  const sorted = [...devices].sort((a, b) =>
    a.room.localeCompare(b.room, "fr") || orderOf(a.category) - orderOf(b.category) || a.name.localeCompare(b.name, "fr") || a.id - b.id);
  const bays: Bay[] = [];
  const rooms: RoomSpan[] = [];
  let x = 0;
  for (const d of sorted) {
    const spec = catalogEntry(d.category);
    const width = LEAD + spec.footprint + TAIL;
    const socketX = x + SOCKET_OFFSET;
    const modelX = x + LEAD + spec.footprint / 2;
    bays.push({ id: d.id, code: d.category, spec, x0: x, width, centerX: x + width / 2, socketX, modelX, cable: [] });
    const last = rooms[rooms.length - 1];
    if (last && last.label === d.room) last.x1 = x + width;
    else rooms.push({ label: d.room, x0: x, x1: x + width });
    x += width;
  }
  // Centre the gallery on x = 0.
  const shift = -x / 2;
  for (const b of bays) {
    b.x0 += shift; b.centerX += shift; b.socketX += shift; b.modelX += shift;
    b.cable = cablePoints(b.spec, b.socketX, b.modelX);
  }
  for (const r of rooms) { r.x0 += shift; r.x1 += shift; }
  return { bays, rooms, width: x };
}

export type Framing = { cx: number; cy: number; cz: number; w: number; h: number };

export function framingFor(layout: GalleryLayout, selectedId: number | null): Framing {
  const b = layout.bays.find((x) => x.id === selectedId);
  if (!b) return { cx: 0, cy: 1.2, cz: 0.3, w: Math.max(2.4, layout.width + 0.4), h: 2.6 };
  const [fx, fy, fw, fh] = b.spec.focus;
  return { cx: b.modelX + fx, cy: b.spec.elevation + fy, cz: 0.3, w: fw, h: fh };
}
