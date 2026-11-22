/* Zoomable map of Tunisia (Kinto's atlas behaviour in the console theme):
   region bubbles at country scale; zoom into a city to see its mapped
   buildings and every adapter with its live state. */
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Minimize2, ZoomIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApi } from "@/lib/api";
import { type Atlas, type Device, ll, pack, pinAt, STATES } from "@/lib/atlas";
import { n, timeS, watts } from "@/lib/format";

export type Bubble = { id: string; name: string; lat: number; lon: number; radius: number; color: string; label?: string; dashed?: boolean; title: string };

const TUNISIA: L.LatLngBoundsExpression = [[30.2, 7.5], [37.55, 11.6]];
const DETAIL_ZOOM = 13;

export default function NetworkMap({ bubbles, selected, onSelect, className = "h-[560px]" }: {
  bubbles: Bubble[]; selected?: string; onSelect?: (id: string) => void; className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<{ bubbles?: L.LayerGroup; city?: L.LayerGroup; pins?: L.LayerGroup }>({});
  const pins = useRef(new Map<string, L.Marker>());
  const latest = useRef(new Map<string, Device>());
  const fitNext = useRef(false);
  const [zoom, setZoom] = useState(6);
  const [city, setCity] = useState<string | null>(null);
  const handlers = useRef({ onSelect });
  handlers.current = { onSelect };

  // Atlas sectors (where the mapped neighbourhoods are) and the devices of the one in view.
  const { data: sectors } = useApi<Atlas>("atlas");
  const { data: detail } = useApi<Atlas>(city ? `atlas?region=${city}` : null, { refetch: 3000 });

  useEffect(() => {
    const m = L.map(box.current!, { minZoom: 5, maxZoom: 21, zoomSnap: 0.5, zoomControl: true });
    m.attributionControl.setPrefix(false);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxNativeZoom: 19, maxZoom: 21, className: "atlas-tiles",
      attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>',
    }).addTo(m);
    m.fitBounds(TUNISIA, { animate: false });
    layers.current = { bubbles: L.layerGroup().addTo(m), city: L.layerGroup().addTo(m), pins: L.layerGroup().addTo(m) };
    const onZoom = () => setZoom(m.getZoom());
    m.on("zoomend", onZoom);
    onZoom();
    map.current = m;
    const ps = pins.current;
    return () => { m.remove(); map.current = null; ps.clear(); };
  }, []);

  // Which atlas sector is in view once the user is zoomed in.
  useEffect(() => {
    const m = map.current;
    if (!m || !sectors) return;
    const pick = () => {
      if (m.getZoom() < DETAIL_ZOOM) return setCity(null);
      const c = m.getCenter();
      let best: string | null = null, bestKm = 40;
      for (const r of sectors.regions) {
        if (r.latitude === null || r.longitude === null) continue;
        const km = 111.2 * Math.hypot(c.lat - r.latitude, (c.lng - r.longitude) * Math.cos((c.lat * Math.PI) / 180));
        if (km < bestKm) { best = r.id; bestKm = km; }
      }
      setCity(best);
    };
    pick();
    m.on("moveend", pick);
    return () => { m.off("moveend", pick); };
  }, [sectors]);

  // Country-scale bubbles.
  useEffect(() => {
    const g = layers.current.bubbles;
    if (!g) return;
    g.clearLayers();
    if (zoom >= DETAIL_ZOOM) return;
    for (const b of bubbles) {
      const size = Math.round(b.radius * 2);
      const html = `<span class="net-bubble${b.dashed ? " is-masked" : ""}${b.id === selected ? " is-selected" : ""}" style="width:${size}px;height:${size}px;background:${b.color}">${b.label ?? ""}</span><b class="net-label">${b.name}</b>`;
      L.marker([b.lat, b.lon], { title: b.title, keyboard: true, icon: L.divIcon({ className: "net-pin", html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] }) })
        .on("click", () => {
          handlers.current.onSelect?.(b.id);
          fitNext.current = true;
          map.current?.flyTo([b.lat, b.lon], DETAIL_ZOOM + 1, { duration: 1 });
        })
        .addTo(g);
    }
  }, [bubbles, selected, zoom]);

  // City detail: OSM buildings and streets of the sector in view.
  useEffect(() => {
    const g = layers.current.city;
    g?.clearLayers();
    layers.current.pins?.clearLayers();
    pins.current.clear();
    if (!city || !g || city === "outside") return;
    let gone = false;
    pack(city).then((p) => {
      if (gone) return;
      for (const road of p.streets) L.polyline(road.map(ll), { className: "atlas-street atlas-street-thin", interactive: false }).addTo(g);
      L.polygon(p.buildings.map((poly: number[][][]) => poly.map((ring) => ring.map(ll))), { className: "atlas-building", interactive: false }).addTo(g);
      L.polygon(p.homes.map((h: any) => h.rings.map((ring: number[][]) => ring.map(ll))), { className: "atlas-home", interactive: false }).addTo(g);
      if (fitNext.current) {
        fitNext.current = false;
        const [w, s, e, nn] = p.bounds;
        map.current?.flyToBounds([[s, w], [nn, e]], { padding: [20, 20], maxZoom: 18, duration: 0.8 });
      }
    }).catch(() => {});
    return () => { gone = true; };
  }, [city]);

  // Live device pins.
  useEffect(() => {
    const m = map.current, g = layers.current.pins;
    if (!m || !g || !detail || !city) return;
    const devices = detail.devices;
    const live = new Set(devices.map((d) => d.adaptateur_id));
    for (const [id, mk] of pins.current) if (!live.has(id)) { g.removeLayer(mk); pins.current.delete(id); }
    for (const d of devices) {
      const id = d.adaptateur_id;
      latest.current.set(id, d);
      let mk = pins.current.get(id);
      if (!mk) {
        mk = L.marker(pinAt(d), { title: `${d.name} · ${id}`, alt: id, riseOnHover: true, keyboard: true,
          icon: L.divIcon({ className: "atlas-pin", iconSize: [18, 18], iconAnchor: [9, 9] }) })
          .bindPopup(() => popup(latest.current.get(id)!, detail.horodatage), { className: "atlas-popup", closeButton: false, autoPanPaddingTopLeft: [56, 16], autoPanPaddingBottomRight: [16, 48] })
          .addTo(g);
        pins.current.set(id, mk);
      } else mk.setLatLng(pinAt(d));
      const el = mk.getElement();
      if (el) {
        for (const s of Object.keys(STATES)) el.classList.toggle(`atlas-${s}`, s === d.state);
        if (el.textContent !== STATES[d.state].symbol) el.textContent = STATES[d.state].symbol;
      }
      if (mk.isPopupOpen()) mk.setPopupContent(popup(d, detail.horodatage));
    }
  }, [detail, city]);

  const detailCount = city && detail ? detail.devices.length : 0;
  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      <div ref={box} className="atlas-map size-full" aria-label="Carte de Tunisie : zoomez sur une ville pour voir ses bâtiments et ses adaptateurs" />
      <div className="pointer-events-none absolute inset-x-2 bottom-2 z-[500] flex flex-wrap items-end justify-between gap-2">
        <span className="rounded-lg border border-line bg-card/95 px-3 py-1.5 text-xs text-ink-2 shadow-sm backdrop-blur">
          {zoom < DETAIL_ZOOM ? (
            <span className="flex items-center gap-1.5"><ZoomIn className="size-3.5" />Cliquez ou zoomez sur une ville pour voir ses bâtiments et ses adaptateurs</span>
          ) : city && detail ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <b className="font-medium text-ink">{detail.regions.find((r) => r.id === city)?.city} · {n(detailCount)} adaptateurs</b>
              {(Object.keys(STATES) as (keyof typeof STATES)[]).map((s) => <span key={s}><span style={{ color: STATES[s].color }}>{STATES[s].symbol}</span> {STATES[s].label}</span>)}
            </span>
          ) : "Aucun quartier cartographié ici"}
        </span>
        {zoom >= DETAIL_ZOOM && (
          <button onClick={() => map.current?.flyToBounds(TUNISIA, { duration: 0.8 })}
            className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-line bg-card/95 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur hover:bg-muted">
            <Minimize2 className="size-3.5" />Tunisie
          </button>
        )}
      </div>
    </div>
  );
}

function popup(d: Device, now: string) {
  const st = STATES[d.state];
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const src = d.location.source === "phone_gps" ? `GPS du téléphone · ± ${n(d.location.accuracy_m ?? 0)} m` : "Position simulée";
  return `<div class="grid gap-0.5"><b class="text-sm">${esc(d.name)}</b><span class="font-mono text-[11px] text-ink-3">${esc(d.adaptateur_id)}</span>
    <span class="mt-1 text-lg font-semibold tabular">${d.active ? watts(d.watts) : "Inactif"}</span>
    <span class="text-xs" style="color:${st.color}">${st.symbol} ${d.active ? st.label : "Aucune mesure en direct"} · réf. ${watts(d.reference_watts)}</span>
    <span class="text-[11px] text-ink-3">${src} · ${timeS(now)}</span>
    <a class="mt-1 text-xs font-medium text-brand" href="/app/steg/atlas?r=${encodeURIComponent(d.region_id)}&d=${encodeURIComponent(d.adaptateur_id)}">Ouvrir dans l'atlas →</a></div>`;
}
