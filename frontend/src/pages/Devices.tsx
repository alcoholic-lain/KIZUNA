import QrScanner from "qr-scanner";
import QRCode from "qrcode";
import { Camera, Check, MapPin, Plus, QrCode, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { Bars, Lines } from "@/components/charts";
import { Badge, Button, Card, Dialog, Empty, Field, Input, LiveDot, PageHeader, Skeleton, Switch } from "@/components/ui";
import { api, useAction, useApi } from "@/lib/api";
import { catOf } from "@/lib/categories";
import { day, kwh, n, time, watts } from "@/lib/format";
import { readGps } from "@/lib/gps";
import { useMe } from "@/lib/session";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export function Qr({ value, className }: { value: string; className?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => { QRCode.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then(setSvg); }, [value]);
  return <div className={cn("rounded-lg bg-white p-1.5 [&_svg]:size-full", className)} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export default function Devices() {
  const { data: live } = useApi<any>("live", { refetch: 2500 });
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<number | null>(null);
  const adding = params.has("ajouter") || params.has("scan");
  const close = () => setParams({});
  if (!live?.devices) return <Skeleton className="h-72" />;
  return (
    <div>
      <PageHeader title="Appareils"><Button variant="brand" onClick={() => setParams({ ajouter: "1" })}><Plus />Ajouter</Button></PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {live.devices.map((d: any, i: number) => {
          const C = catOf(d.category);
          return (
            <motion.button key={d.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              onClick={() => setSelected(d.id)} className="group rounded-2xl border border-line bg-card p-5 text-left transition hover:shadow-md">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl" style={{ background: `color-mix(in oklch, ${C.color} 14%, transparent)`, color: C.color }}><C.icon className="size-5" /></span>
                <div className="min-w-0 flex-1"><b className="block truncate font-medium">{d.name}</b><span className="text-xs text-ink-3">{d.room} · {d.adapter}</span></div>
                {d.anomaly ? <Badge tone="bad">Anomalie</Badge> : d.monitoring ? <LiveDot /> : <Badge>Pause</Badge>}
              </div>
              <div className="mt-5 flex items-end justify-between">
                <div className="text-3xl font-semibold tracking-tight tabular">{d.monitoring ? watts(d.power) : "–"}</div>
                <div className="text-right text-xs text-ink-3"><div>{kwh(d.today_kwh)} aujourd'hui</div><div>{kwh(d.month_kwh)} ce mois</div></div>
              </div>
            </motion.button>
          );
        })}
        <button onClick={() => setParams({ ajouter: "1" })} className="grid min-h-40 place-items-center rounded-2xl border-2 border-dashed border-line text-ink-3 transition hover:border-ink/30 hover:text-ink">
          <span className="flex flex-col items-center gap-2 text-sm font-medium"><QrCode className="size-6" />Scanner un adaptateur</span>
        </button>
      </div>
      <DeviceSheet id={selected} onClose={() => setSelected(null)} />
      <AddDevice open={adding} initial={params.get("scan")} onClose={close} onDone={(id) => { close(); setSelected(id); }} />
    </div>
  );
}

function DeviceSheet({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data: d } = useApi<any>(id ? `devices/${id}` : null, { refetch: 5000 });
  const act = useAction();
  const [name, setName] = useState("");
  useEffect(() => { if (d?.name) setName(d.name); }, [d?.id]);
  const C = catOf(d?.category);
  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()} side title={d ? d.name : "…"}>
      {!d || d.id !== id ? <Skeleton className="h-72" /> : (
        <div className="grid gap-6">
          <div className="flex items-center gap-4">
            <span className="grid size-12 place-items-center rounded-2xl" style={{ background: `color-mix(in oklch, ${C.color} 14%, transparent)`, color: C.color }}><C.icon className="size-6" /></span>
            <div className="flex-1"><div className="text-3xl font-semibold tracking-tight tabular">{d.monitoring ? watts(d.power) : "Pause"}</div><div className="text-xs text-ink-3">{d.room} · {d.source === "reelle" ? "capteur réel" : "simulé"}</div></div>
            <Qr value={d.adapter} className="size-16" />
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[["Aujourd'hui", kwh(d.today_kwh)], ["Ce mois", kwh(d.month_kwh)], ["Habituel", watts(d.baseline)]].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-muted p-3"><div className="text-xs text-ink-3">{l}</div><div className="font-semibold tabular">{v}</div></div>
            ))}
          </div>
          <div>
            <div className="mb-2 text-[13px] font-medium text-ink-2">Dernière heure</div>
            {d.readings.length > 1 ? (
              <Lines data={d.readings.map((r: any) => ({ x: r[0], w: r[1] }))} height={190} unit="W" xFormat={time}
                keys={[{ key: "w", name: "Puissance", color: C.color }]}
                refs={[{ y: d.baseline, label: "Habituel", color: "var(--color-good)" }, { y: d.threshold, label: "Seuil IA", color: "var(--color-warn)" }]} />
            ) : <p className="text-sm text-ink-3">Premières mesures en cours…</p>}
          </div>
          <div>
            <div className="mb-2 text-[13px] font-medium text-ink-2">30 jours</div>
            <Bars data={d.daily.map((x: any) => ({ x: x[0], kwh: x[1] }))} height={150} xFormat={day} keys={[{ key: "kwh", name: "Énergie", color: C.color }]} />
          </div>
          <div className="grid gap-3 rounded-2xl border border-line p-4">
            <div className="flex items-center justify-between"><span className="text-sm">Mesure active</span>
              <Switch checked={d.monitoring} onCheckedChange={(v) => act.mutate({ path: `devices/${d.id}`, body: { monitoring: v }, success: v ? "Mesure reprise" : "Mesure en pause (l'appareil reste alimenté)" })} /></div>
            <div className="flex gap-2"><Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Nom" />
              <Button variant="outline" disabled={!name.trim() || name === d.name} onClick={() => act.mutate({ path: `devices/${d.id}`, body: { name }, success: "Renommé" })}>Renommer</Button></div>
            <Button variant="danger" className="justify-start" onClick={() => act.mutate({ path: `devices/${d.id}`, method: "DELETE", success: `${d.adapter} dissocié` }, { onSuccess: onClose })}><Trash2 />Dissocier l'adaptateur</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function AddDevice({ open, initial, onClose, onDone }: { open: boolean; initial: string | null; onClose: () => void; onDone: (id: number) => void }) {
  const { data: me } = useMe();
  const { data: reg } = useApi<any>(open ? "adapters/registry" : null);
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [id, setId] = useState("");
  const [manual, setManual] = useState("");
  const [err, setErr] = useState("");
  const [cat, setCat] = useState("");
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [cam, setCam] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loc, setLoc] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const scanner = useRef<QrScanner | null>(null);

  const stopCam = () => { scanner.current?.destroy(); scanner.current = null; setCam(false); };
  useEffect(() => { if (!open) { stopCam(); setStep(0); setId(""); setErr(""); setCat(""); setName(""); setRoom(""); setManual(""); setLoc(""); } }, [open]);
  useEffect(() => { if (open && initial) setTimeout(() => check(initial, true), 600); }, [open, initial]);

  async function check(raw: string, demo = false) {
    setErr("");
    stopCam();
    try {
      const r = await api(`adapters/check?id=${encodeURIComponent(raw)}`);
      setId(r.id);
      if (demo) { setCat("ordinateur"); setName("PC portable"); setRoom("Bureau"); }
      setStep(1);
    } catch (e: any) { setErr(e.message); }
  }
  async function startCam() {
    if (!video.current) return;
    try {
      setCam(true);
      scanner.current = new QrScanner(video.current, (res) => check(res.data.trim()), { highlightScanRegion: true, highlightCodeOutline: true, returnDetailedScanResult: true });
      await scanner.current.start();
    } catch { stopCam(); toast.error("Caméra indisponible : choisissez un code ou saisissez l'identifiant"); }
  }
  async function pair() {
    setBusy(true);
    try {
      const r = await api("devices", { method: "POST", body: { id, category: cat, name, room } });
      toast.success(r.message);
      qc.invalidateQueries();
      setStep(2);
      // Record where the adapter really is (phone GPS). Optional: pairing already succeeded.
      setLoc("Enregistrement de la position GPS…");
      try {
        const fix = await readGps({ altitudeMs: 4000, timeoutMs: 15000 }).promise;
        await api("atlas/locate", { method: "POST", body: { adaptateur_id: id, ...fix } });
        setLoc(`Position enregistrée · ± ${Math.round(fix.accuracy_m)} m`);
      } catch (e: any) { setLoc(`Position non enregistrée : ${e.message}`); }
      setTimeout(() => onDone(r.id), 1400);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title={["Scanner l'adaptateur", `Associer ${id}`, "Connecté"][step]}>
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="s0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-4">
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-[oklch(0.17_0.01_270)]">
              <video ref={video} className={cn("absolute inset-0 size-full object-cover", !cam && "hidden")} muted playsInline />
              {!cam && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="relative size-48 rounded-3xl border-2 border-white/25">
                    <motion.div className="absolute inset-x-3 h-0.5 rounded bg-brand shadow-[0_0_14px_var(--color-brand)]" animate={{ top: ["12%", "86%", "12%"] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
                  </div>
                  <Button variant="outline" className="absolute bottom-4 border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={startCam}><Camera />Activer la caméra</Button>
                </div>
              )}
            </div>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) check(manual); }}>
              <Input placeholder="NABD-0003" value={manual} onChange={(e) => setManual(e.target.value.toUpperCase())} aria-label="Identifiant" />
              <Button type="submit">Valider</Button>
            </form>
            {err && <p className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{err}</p>}
            <div>
              <p className="mb-2 text-xs text-ink-3">Codes de démonstration</p>
              <div className="grid grid-cols-4 gap-2">
                {reg?.stock.slice(0, 4).map((x: string) => (
                  <button key={x} onClick={() => check(x)} className="rounded-xl border border-line p-2 text-[10px] font-medium transition hover:border-ink/30">
                    <Qr value={x} className="mx-auto mb-1 size-14 p-0.5" />{x}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
        {step === 1 && (
          <motion.form key="s1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="grid gap-4"
            onSubmit={(e) => { e.preventDefault(); if (!cat) return setErr("Choisissez un type"); pair(); }}>
            <div className="grid grid-cols-4 gap-2">
              {me?.categories.map((c) => {
                const C = catOf(c.code);
                return (
                  <button type="button" key={c.code} onClick={() => { setCat(c.code); if (!name) setName(c.label); if (!room) setRoom(c.room); }}
                    className={cn("flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-[11px] font-medium transition", cat === c.code ? "border-ink bg-muted" : "border-line hover:border-ink/30")}>
                    <C.icon className="size-5" style={{ color: C.color }} /><span className="line-clamp-1">{c.label.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nom"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
              <Field label="Pièce"><Input value={room} onChange={(e) => setRoom(e.target.value)} maxLength={40} /></Field>
            </div>
            {err && <p className="text-sm text-bad">{err}</p>}
            <div className="flex justify-between"><Button type="button" variant="ghost" onClick={() => setStep(0)}>Retour</Button><Button type="submit" variant="brand" disabled={busy}><Check />Associer</Button></div>
          </motion.form>
        )}
        {step === 2 && (
          <motion.div key="s2" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="grid place-items-center gap-3 py-8">
            <span className="grid size-16 place-items-center rounded-full bg-good text-white"><Check className="size-8" /></span>
            <p className="font-medium">{name}</p><p className="text-sm text-ink-3">Premières mesures dans quelques secondes</p>
            {loc && <p role="status" className="flex items-center gap-1.5 text-xs text-ink-3"><MapPin className="size-3.5" />{loc}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </Dialog>
  );
}
