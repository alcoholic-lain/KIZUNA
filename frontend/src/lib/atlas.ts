/* Shared types and helpers for the energy atlas (Kinto's M1 map). */
export type State = "economic" | "elevated" | "high" | "offline";
export type Region = { id: string; city: string; latitude: number | null; longitude: number | null; count: number; active_count: number };
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

/** Base map that follows the app theme (CARTO light / dark, OpenStreetMap data). */
export function themedTiles(map: L.Map) {
  const url = () => `https://{s}.basemaps.cartocdn.com/${document.documentElement.classList.contains("dark") ? "dark_all" : "voyager"}/{z}/{x}/{y}{r}.png`;
  const layer = L.tileLayer(url(), {
    subdomains: "abcd", maxNativeZoom: 20, maxZoom: 21, referrerPolicy: "strict-origin-when-cross-origin",
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
  });
  const watch = new MutationObserver(() => layer.setUrl(url()));
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  map.on("unload", () => watch.disconnect());
  return layer;
}
