/* Shared types and helpers for the energy atlas (Kinto's M1 map). */
export type State = "economic" | "elevated" | "high" | "offline";
export type Region = { id: string; city: string; latitude: number | null; longitude: number | null; count: number; active_count: number; confirmed_count: number };
export type Loc = { x: number; y: number; z: number | null; source: string; accuracy_m?: number; captured_at?: string; building_id?: number; roof?: { x: number; y: number } };
export type Device = {
  adaptateur_id: string; name: string; region_id: string; city: string; installed: boolean; latitude: number; longitude: number;
  location: Loc; reference_watts: number; active: boolean; watts: number | null; state: State; horodatage: string | null;
};
export type Atlas = { horodatage: string; regions: Region[]; devices: Device[]; policy: { elevated_max_ratio: number } };

export const STATES: Record<State, { symbol: string; label: string; color: string }> = {
  economic: { symbol: "●", label: "Économe", color: "var(--color-good)" },
  elevated: { symbol: "▲", label: "À surveiller", color: "var(--color-warn)" },
  high: { symbol: "◆", label: "Élevée", color: "var(--color-bad)" },
  offline: { symbol: "○", label: "Inactif", color: "var(--color-c0)" },
};

const packs = new Map<string, Promise<any>>();
/** OSM extract (streets, buildings, homes) of one demo neighbourhood. */
export function pack(id: string) {
  if (!packs.has(id)) {
    packs.set(id, fetch(`/static/atlas/${id}.json`).then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .catch((e) => { packs.delete(id); throw e; }));
  }
  return packs.get(id)!;
}
export const ll = ([x, y]: number[]) => [y, x] as [number, number];
export const pinAt = (d: Device): [number, number] => { const p = d.location.roof ?? d.location; return [p.y, p.x]; };

import L from "leaflet";

/** OpenStreetMap base map (darkened by CSS in the dark theme).
 *  OSM's tile servers block requests without a Referer, and the site's
 *  Referrer-Policy is same-origin, so the tile requests send the origin explicitly. */
export function themedTiles(_map: L.Map) {
  return L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxNativeZoom: 19, maxZoom: 21, className: "atlas-tiles", referrerPolicy: "strict-origin-when-cross-origin",
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  });
}
