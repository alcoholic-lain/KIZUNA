/* Energy atlas: Kinto's M1 map (density by region, building-level street map,
   QR scan + phone GPS) rebuilt in the Mieruka console theme. */
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowLeft, Camera, Crosshair, LocateFixed, MapPin, QrCode, Search } from "lucide-react";
import QrScanner from "qr-scanner";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, CardTitle, Dialog, Input, LiveDot, PageHeader, Skeleton, Stat } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import { n, timeS, watts } from "@/lib/format";
import { type Atlas, type Device, ll, pack, pinAt, type Region, type State, STATES, themedTiles } from "@/lib/atlas";
import { type Fix, readGps } from "@/lib/gps";
import NetworkMap, { type Bubble } from "@/components/NetworkMap";
import { cn } from "@/lib/utils";

const ID_RE = /^NABD-\d{4}$/;

export default function AtlasPage() {
  const [params, setParams] = useSearchParams();
  const region = params.get("r");
  const [selected, setSelected] = useState<string | null>(params.get("d"));
  const [scanning, setScanning] = useState(false);
  const { data, error } = useApi<Atlas>(region ? `atlas?region=${encodeURIComponent(region)}` : "atlas", { refetch: 3000 });
  const open = (r: string | null, d: string | null = null) => {
    setSelected(d);
    setParams(r ? (d ? { r, d } : { r }) : {}, { replace: false });
  };

  const totals = useMemo(() => {
    const rs = data?.regions ?? [];
    const count = rs.reduce((s, r) => s + r.count, 0), active = rs.reduce((s, r) => s + r.active_count, 0);
    return { count, active };
  }, [data]);
  const site = data?.regions.find((r) => r.id === region);

  return (
    <div className="grid gap-5">
      <PageHeader title={region ? site?.city ?? "Atlas" : "Atlas énergétique"}>
        <Badge>Données simulées</Badge>
        <Button variant="brand" onClick={() => setScanning(true)}><QrCode />Scanner un adaptateur</Button>
      </PageHeader>

      {error && !data && <Card className="text-sm text-bad">{(error as Error).message}</Card>}
      {!data ? <Skeleton className="h-[520px]" /> : region ? (
        <RegionView key={region} site={site} data={data} selected={selected} onSelect={setSelected} onBack={() => open(null)} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label={<><LiveDot />Adaptateurs enregistrés</>} value={n(totals.count)} sub={`${data.regions.filter((r) => r.count).length} secteurs`} />
            <Stat label="Actifs" value={n(totals.active)} sub={`mesure ${timeS(data.horodatage)}`} />
            <Stat label="Inactifs" value={n(totals.count - totals.active)} sub="hors ligne ou non mesurés" />
          </div>
          <div className="grid gap-5 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardTitle right={<span className="text-xs text-ink-3">Surface ∝ nombre d'appareils · zoomez pour le détail</span>}>Densité du parc</CardTitle>
              <DensityMap regions={data.regions} onOpen={(id) => open(id)} />
            </Card>
            <Card className="lg:col-span-2 p-0">
              <div className="px-5 pt-5"><CardTitle right={<span className="text-xs text-ink-3 tabular">{n(totals.count)}</span>}>Secteurs</CardTitle></div>
              <ul className="divide-y divide-line">
                {[...data.regions].sort((a, b) => b.count - a.count).map((r) => (
                  <li key={r.id}>
                    <button onClick={() => open(r.id)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-muted/60">
                      <MapPin className="size-4 text-ink-3" />
                      <span className="flex-1"><b className="block text-sm font-medium">{r.city}</b><span className="text-xs text-ink-3">{n(r.active_count)} actifs</span></span>
                      <span className="text-sm font-medium tabular">{n(r.count)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
      <p className="text-xs text-ink-3">
        Règle de démonstration : économe jusqu'à la référence, à surveiller jusqu'à +{n(((data?.policy.elevated_max_ratio ?? 1.35) - 1) * 100)} %, élevée au-delà.
        Seuils simulés, indépendants de la facturation STEG. Bâtiments et rues © OpenStreetMap contributors (ODbL).
      </p>
      <ScanDialog open={scanning} onClose={() => setScanning(false)} onPaired={(d) => { setScanning(false); open(d.region_id, d.adaptateur_id); }} />
    </div>
  );
}

/* ------------------------------------------------------------------ National view */
function DensityMap({ regions, onOpen }: { regions: Region[]; onOpen: (id: string) => void }) {
  const bubbles = useMemo<Bubble[]>(() => regions.filter((r) => r.latitude !== null && r.count).map((r) => ({
    id: r.id, name: r.city, lat: r.latitude!, lon: r.longitude!, radius: Math.max(10, 1.6 * Math.sqrt(r.count)), label: String(r.count),
    color: `color-mix(in oklch, var(--color-c1) ${Math.round(45 + 50 * (r.count ? r.active_count / r.count : 0))}%, transparent)`,
    title: `${r.city} · ${r.count} appareils, ${r.active_count} actifs`,
  })), [regions]);
  return <NetworkMap bubbles={bubbles} onSelect={onOpen} />;
}

/* ------------------------------------------------------------------ Region view */
function RegionView({ site, data, selected, onSelect, onBack }: {
  site?: Region; data: Atlas; selected: string | null; onSelect: (id: string | null) => void; onBack: () => void;
}) {
  const [term, setTerm] = useState("");
  const [picking, setPicking] = useState(false);
  const [roofMsg, setRoofMsg] = useState("");
  const qc = useQueryClient();
  const devices = data.devices;
  const current = devices.find((d) => d.adaptateur_id === selected) ?? null;
  const shown = useMemo(() => {
    const t = term.trim().toLocaleLowerCase("fr");
    return devices.filter((d) => `${d.name} ${d.adaptateur_id}`.toLocaleLowerCase("fr").includes(t));
  }, [devices, term]);
  useEffect(() => { // default selection: first active device
    if (!selected && devices.length) onSelect((devices.find((d) => d.active) ?? devices[0]).adaptateur_id);
  }, [devices.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function pickRoof(x: number, y: number) {
    if (!current) return;
    setPicking(false);
    try {
      await api("atlas/roof", { method: "POST", body: { adaptateur_id: current.adaptateur_id, captured_at: current.location.captured_at, x, y } });
      setRoofMsg("");
      qc.invalidateQueries();
    } catch (e: any) { setRoofMsg(e.message); }
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-5">
      <Card className="relative overflow-hidden p-0 lg:col-span-3">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft />Tunisie</Button>
          <span className="flex items-center gap-2 text-xs text-ink-3"><LiveDot />{timeS(data.horodatage)}</span>
        </div>
        <StreetMap siteId={site?.id ?? "outside"} center={site} devices={devices} selected={current} onSelect={onSelect}
          picking={picking} onPick={pickRoof} />
        {(picking || roofMsg) && (
          <div className="absolute inset-x-3 bottom-3 z-[500] flex items-center gap-3 rounded-xl border border-line bg-card/95 px-4 py-2.5 text-sm shadow-lg backdrop-blur">
            <Crosshair className="size-4 shrink-0 text-brand" />
            <span role="status" className="flex-1">{roofMsg || "Touchez le toit de ce bâtiment. Le relevé GPS est conservé."}</span>
            <Button size="sm" variant="ghost" onClick={() => { setPicking(false); setRoofMsg(""); }}>Fermer</Button>
          </div>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-xs text-ink-2">
          {(Object.keys(STATES) as State[]).map((s) => <span key={s}><span style={{ color: STATES[s].color }}>{STATES[s].symbol}</span> {STATES[s].label}</span>)}
        </div>
      </Card>

      <div className="grid content-start gap-5 lg:col-span-2">
        {current && <DeviceCard d={current} onRoof={() => { setRoofMsg(""); setPicking(true); }} />}
        <Card className="p-0">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <Search className="size-4 text-ink-3" />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Nom ou identifiant" aria-label="Rechercher un appareil"
              className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" />
            <span className="text-xs text-ink-3 tabular">{n(shown.length)}</span>
          </div>
          <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
            {shown.map((d) => (
              <li key={d.adaptateur_id}>
                <button onClick={() => onSelect(d.adaptateur_id)} aria-pressed={d.adaptateur_id === selected}
                  className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-muted/60", d.adaptateur_id === selected && "bg-muted")}>
                  <span aria-hidden style={{ color: STATES[d.state].color }}>{STATES[d.state].symbol}</span>
                  <span className="min-w-0 flex-1"><b className="block truncate text-sm font-medium">{d.name}</b><span className="font-mono text-[11px] text-ink-3">{d.adaptateur_id}</span></span>
                  <span className="text-sm tabular">{d.active ? watts(d.watts) : <span className="text-ink-3">Inactif</span>}</span>
                </button>
              </li>
            ))}
            {!shown.length && <li className="px-4 py-6 text-center text-sm text-ink-3">Aucun appareil correspondant.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function DeviceCard({ d, onRoof }: { d: Device; onRoof: () => void }) {
  const st = STATES[d.state];
  const loc = d.location;
  const gps = loc.source === "phone_gps";
  return (
    <Card>
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-3">Appareil sélectionné</div>
      <h2 className="mt-1 text-lg font-semibold tracking-tight">{d.name}</h2>
      <p className="font-mono text-xs text-ink-3">{d.adaptateur_id} · {d.city}{d.installed && " · installé chez un foyer"}</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <b className="text-3xl font-semibold tabular">{d.active ? watts(d.watts) : "Inactif"}</b>
        <Badge className="mb-1" tone={d.state === "economic" ? "good" : d.state === "elevated" ? "warn" : d.state === "high" ? "bad" : "neutral"}>{d.active ? st.label : "Aucune mesure en direct"}</Badge>
      </div>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-ink-3">Référence</dt><dd className="tabular">{watts(d.reference_watts)}</dd>
        {d.horodatage && <><dt className="text-ink-3">Mesure</dt><dd className="tabular">{timeS(d.horodatage)}</dd></>}
        <dt className="text-ink-3">Position</dt><dd className="font-mono text-xs leading-5">{loc.y.toFixed(6)}°, {loc.x.toFixed(6)}°{loc.z !== null && ` · ${n(loc.z)} m`}</dd>
        <dt className="text-ink-3">Source</dt>
        <dd>{gps ? `GPS du téléphone · ± ${n(loc.accuracy_m ?? 0)} m` : "Position simulée dans un bâtiment cartographié"}{loc.roof && " · toit indiqué"}</dd>
      </dl>
      {gps && <Button variant="outline" size="sm" className="mt-4" onClick={onRoof}><Crosshair />Préciser le toit sur la carte</Button>}
    </Card>
  );
}

/* ------------------------------------------------------------------ Leaflet street map */
function StreetMap({ siteId, center, devices, selected, onSelect, picking, onPick }: {
  siteId: string; center?: Region; devices: Device[]; selected: Device | null; onSelect: (id: string) => void;
  picking: boolean; onPick: (x: number, y: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const homes = useRef(new Map<number, L.Polygon>());
  const extra = useRef<{ roof?: L.Polygon; accuracy?: L.Circle }>({});
  const fitted = useRef(false);
  const handlers = useRef({ onSelect, onPick });
  handlers.current = { onSelect, onPick };

  useEffect(() => {
    const m = L.map(box.current!, { minZoom: 3, maxZoom: 21, zoomSnap: 0.25, attributionControl: true })
      .setView([center?.latitude ?? 34, center?.longitude ?? 10], 16);
    m.attributionControl.setPrefix(false);
    const tiles = themedTiles(m);
    let coverage: L.LatLngBounds | null = null;
    let closed = false;
    const updateTiles = () => { if (!coverage || !coverage.contains(m.getCenter())) tiles.addTo(m); else tiles.remove(); };
    if (siteId !== "outside") {
      pack(siteId).then((p) => {
        if (closed) return;
        const [w, s, e, nn] = p.bounds;
        coverage = L.latLngBounds([s, w], [nn, e]);
        for (const road of p.streets) L.polyline(road.map(ll), { className: "atlas-street", interactive: false }).addTo(m);
        L.polygon(p.buildings.map((poly: number[][][]) => poly.map((ring) => ring.map(ll))), { className: "atlas-building", interactive: false }).addTo(m);
        for (const h of p.homes) homes.current.set(h.osm_id, L.polygon(h.rings.map((ring: number[][]) => ring.map(ll)), { className: "atlas-home", interactive: false }).addTo(m));
        updateTiles();
        m.on("moveend", updateTiles);
        m.fire("atlas:homes");
      }).catch(() => { if (!closed) tiles.addTo(m); });
    } else tiles.addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => { if (m.getContainer().classList.contains("picking")) handlers.current.onPick(e.latlng.lng, e.latlng.lat); });
    map.current = m;
    const ms = markers.current, hs = homes.current;
    return () => { closed = true; m.remove(); map.current = null; ms.clear(); hs.clear(); fitted.current = false; };
  }, [siteId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep markers in sync with the polled devices.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const live = new Set(devices.map((d) => d.adaptateur_id));
    for (const [id, mk] of markers.current) if (!live.has(id)) { mk.remove(); markers.current.delete(id); }
    for (const d of devices) {
      const id = d.adaptateur_id;
      let mk = markers.current.get(id);
      if (!mk) {
        mk = L.marker(pinAt(d), { title: `${d.name} · ${id}`, alt: id, riseOnHover: true, keyboard: true,
          icon: L.divIcon({ className: "atlas-pin", iconSize: [18, 18], iconAnchor: [9, 9] }) })
          .addTo(m).on("click", () => handlers.current.onSelect(id));
        markers.current.set(id, mk);
      } else mk.setLatLng(pinAt(d));
      const el = mk.getElement();
      if (el) {
        for (const s of Object.keys(STATES)) el.classList.toggle(`atlas-${s}`, s === d.state);
        el.classList.toggle("is-selected", selected?.adaptateur_id === id);
        if (el.textContent !== STATES[d.state].symbol) el.textContent = STATES[d.state].symbol;
        el.setAttribute("aria-label", `${d.name} · ${id} · ${d.active ? watts(d.watts) : "Inactif"}`);
      }
    }
    if (!fitted.current && devices.length) {
      m.fitBounds(L.latLngBounds(devices.map(pinAt)), { padding: [24, 24], maxZoom: 18, animate: false });
      fitted.current = true;
    }
  }, [devices, selected]);

  // Highlight the selected device: its roof, its GPS accuracy circle, and bring it to the front.
  const selKey = selected ? `${selected.adaptateur_id}|${selected.location.captured_at}|${selected.location.roof?.x}` : "";
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const draw = () => {
      extra.current.roof?.getElement()?.classList.remove("is-selected");
      extra.current.accuracy?.remove();
      extra.current = {};
      for (const [id, mk] of markers.current) mk.setZIndexOffset(id === selected?.adaptateur_id ? 1000 : 0);
      if (!selected) return;
      const roof = selected.location.building_id ? homes.current.get(selected.location.building_id) : undefined;
      roof?.getElement()?.classList.add("is-selected");
      extra.current.roof = roof;
      if (selected.location.source === "phone_gps") {
        extra.current.accuracy = L.circle([selected.location.y, selected.location.x], { radius: selected.location.accuracy_m ?? 10, className: "atlas-accuracy", interactive: false }).addTo(m);
      }
      if (fitted.current) m.setView(pinAt(selected), Math.max(m.getZoom(), 18), { animate: true });
    };
    draw();
    m.on("atlas:homes", draw);
    return () => { m.off("atlas:homes", draw); };
  }, [selKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { box.current?.classList.toggle("picking", picking); }, [picking]);

  return <div ref={box} className="atlas-map h-[460px] w-full sm:h-[520px]" aria-label="Carte des bâtiments et des adaptateurs" />;
}

/* ------------------------------------------------------------------ Scan + GPS */
function ScanDialog({ open, onClose, onPaired }: { open: boolean; onClose: () => void; onPaired: (d: Device) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const scanner = useRef<QrScanner | null>(null);
  const gps = useRef<{ cancel: () => void } | null>(null);
  const [cam, setCam] = useState(false);
  const [id, setId] = useState("");
  const [manual, setManual] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const stopCam = () => { scanner.current?.destroy(); scanner.current = null; setCam(false); };
  const reset = () => { stopCam(); gps.current?.cancel(); gps.current = null; setId(""); setManual(""); setStatus(""); setBusy(false); };
  useEffect(() => { if (!open) reset(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => reset(), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function found(raw: string) {
    const code = raw.trim().toUpperCase();
    if (!ID_RE.test(code)) { setStatus("Ce QR ne contient pas un identifiant d'adaptateur valide (NABD-0000)."); return; }
    stopCam();
    setId(code);
    locate(code);
  }
  async function locate(code: string) {
    setBusy(true);
    setStatus(`${code} reconnu · recherche de la position GPS…`);
    const read = readGps();
    gps.current = read;
    let fix: Fix;
    try { fix = await read.promise; } catch (e: any) {
      if (e.message !== "Annulé") { setStatus(e.message); setBusy(false); }
      return;
    }
    setStatus(`Enregistrement de ${code} (± ${n(fix.accuracy_m)} m)…`);
    try {
      const d = await api<Device>("atlas/locate", { method: "POST", body: { adaptateur_id: code, ...fix } });
      qc.invalidateQueries();
      onPaired(d);
    } catch (e: any) { setStatus(e.message); setBusy(false); }
  }
  async function startCam() {
    if (!video.current) return;
    setStatus("Autorisez la caméra puis cadrez le QR de l'adaptateur.");
    try {
      setCam(true);
      scanner.current = new QrScanner(video.current, (res) => found(res.data), { highlightScanRegion: true, highlightCodeOutline: true, returnDetailedScanResult: true, preferredCamera: "environment" });
      await scanner.current.start();
    } catch { stopCam(); setStatus("Caméra indisponible : autorisez son accès, choisissez une photo du QR ou saisissez l'identifiant."); }
  }
  async function fromPhoto(file?: File) {
    if (!file) return;
    try { const r = await QrScanner.scanImage(file, { returnDetailedScanResult: true }); found(r.data); }
    catch { setStatus("Aucun QR lisible dans cette photo."); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title={id ? `Localiser ${id}` : "Associer un adaptateur"}>
      <div className="grid gap-4">
        <p className="text-sm text-ink-2">Scannez le QR de l'adaptateur sur place : sa position GPS exacte est enregistrée dans l'atlas.</p>
        {!id && (
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-[oklch(0.17_0.01_270)]">
            <video ref={video} className={cn("absolute inset-0 size-full object-cover", !cam && "hidden")} muted playsInline />
            {!cam && (
              <div className="absolute inset-0 grid place-items-center">
                <div className="size-44 rounded-3xl border-2 border-white/25" />
                <Button variant="outline" className="absolute bottom-4 border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={startCam}><Camera />Ouvrir la caméra</Button>
              </div>
            )}
          </div>
        )}
        {id && <div className="grid place-items-center gap-2 rounded-2xl bg-muted py-8 text-center"><LocateFixed className={cn("size-8 text-brand", busy && "animate-pulse")} /><b className="font-mono text-sm">{id}</b></div>}
        {status && <p role="status" className="rounded-xl bg-muted px-3 py-2 text-sm text-ink-2">{status}</p>}
        {!id ? (
          <div className="grid gap-2">
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) found(manual); }}>
              <Input placeholder="NABD-0003" value={manual} onChange={(e) => setManual(e.target.value.toUpperCase())} aria-label="Identifiant de l'adaptateur" />
              <Button type="submit">Valider</Button>
            </form>
            <label className="cursor-pointer text-center text-xs text-ink-3 underline underline-offset-2">
              Lire une photo du QR<input type="file" accept="image/*" className="sr-only" onChange={(e) => fromPhoto(e.target.files?.[0])} />
            </label>
          </div>
        ) : !busy && (
          <div className="flex justify-between"><Button variant="ghost" onClick={reset}>Autre adaptateur</Button><Button variant="brand" onClick={() => locate(id)}><LocateFixed />Réessayer le GPS</Button></div>
        )}
      </div>
    </Dialog>
  );
}
