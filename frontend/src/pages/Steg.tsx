import { ArrowLeft, Check, Lock, Siren } from "lucide-react";
import { motion } from "motion/react";
import { lazy, Suspense, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { Bubble } from "@/components/NetworkMap";
import { Bars, Donut, Legend, Lines, Spark } from "@/components/charts";
import { AnimatedNumber, Badge, Button, Card, CardTitle, Delta, Dialog, InfoTip, LiveDot, PageHeader, SEVERITY_LABEL, SEVERITY_TONE, Skeleton, Stat, Tabs } from "@/components/ui";
import { useAction, useApi } from "@/lib/api";
import { codeOfLabel, colorOfLabel, catOf } from "@/lib/categories";
import { ago, day, dateTime, kwh, n, pct, timeS, watts } from "@/lib/format";
import { cn } from "@/lib/utils";

const NetworkMap = lazy(() => import("@/components/NetworkMap"));

/* ------------------------------------------------------------------ Network */
export function StegNetwork() {
  const { data } = useApi<any>("steg/overview", { refetch: 60000 });
  const { data: live } = useApi<any>("live", { refetch: 2500 });
  const [sel, setSel] = useState("tunis");
  if (!data) return <Skeleton className="h-96" />;
  const region = data.regions.find((r: any) => r.code === sel) || data.regions[0];
  return (
    <div className="grid gap-5">
      <PageHeader title="Réseau"><Badge>Compteurs collectifs simulés</Badge></PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={<><LiveDot />Puissance suivie</>} value={<AnimatedNumber value={(live?.live_w ?? data.live_w) / 1000} decimals={1} />} unit="kW" sub={`${n(data.counts.adapters)} adaptateurs`} />
        <Stat label="Aujourd'hui" value={n(data.today)} unit="kWh" sub={`compteurs : ${n(data.today_meter)} kWh`} />
        <Stat label="Ce mois" value={n(data.month)} unit="kWh" sub={<Delta value={data.trend} />} />
        <Stat label="Incidents ouverts" value={live?.open ?? data.open} sub={`${data.counts.households} foyers · ${data.counts.buildings} bâtiments`} />
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="p-2 lg:col-span-3"><TunisiaMap regions={data.regions} selected={sel} onSelect={setSel} /></Card>
        <Card className="lg:col-span-2">
          <CardTitle right={region.masked ? <Badge><Lock />Masqué</Badge> : <Delta value={region.trend} />}>{region.name}</CardTitle>
          {region.masked ? (
            <p className="text-sm text-ink-3">{region.households} foyers seulement : en dessous de 10, aucun agrégat n'est affiché pour protéger la vie privée.</p>
          ) : (
            <div className="grid gap-5">
              <div className="grid grid-cols-3 gap-3 text-center">
                {[["Foyers", region.households], ["Bâtiments", region.buildings], ["Alertes", region.alerts]].map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-muted p-3"><div className="text-xs text-ink-3">{l}</div><b className="text-lg tabular">{v}</b></div>
                ))}
              </div>
              <div><div className="mb-1 flex justify-between text-xs text-ink-3"><span>14 jours</span><span>{kwh(region.today)} aujourd'hui</span></div><Spark values={region.daily} height={60} /></div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-ink-3"><span>Profil horaire</span><span>{pct(region.peak_share)} en pointe</span></div>
                <Bars data={region.profile.map((v: number, i: number) => ({ x: i, v }))} height={110} highlight={[18, 21]} xFormat={(v) => `${v}h`} keys={[{ key: "v", name: "kWh", color: "var(--color-c1)" }]} />
              </div>
            </div>
          )}
        </Card>
      </div>
      <Card>
        <CardTitle right={<InfoTip content="Compteur collectif = adaptateurs + autres usages des foyers + parties communes" />}>30 jours : compteurs et adaptateurs</CardTitle>
        <Lines data={data.daily.slice(0, -1).map((d: any) => ({ x: d[0], mon: d[1], meter: d[2] }))} height={240} xFormat={day}
          keys={[{ key: "meter", name: "Compteurs collectifs", color: "var(--color-c2)" }, { key: "mon", name: "Adaptateurs", color: "var(--color-c1)" }]} />
        <Legend items={[{ name: "Compteurs collectifs", color: "var(--color-c2)" }, { name: "Adaptateurs", color: "var(--color-c1)" }]} />
      </Card>
    </div>
  );
}

function TunisiaMap({ regions, selected, onSelect }: { regions: any[]; selected: string; onSelect: (c: string) => void }) {
  const bubbles = useMemo<Bubble[]>(() => {
    const max = Math.max(...regions.filter((r) => !r.masked).map((r) => r.today || 0), 1);
    return regions.map((r) => ({
      id: r.code, name: r.name, lat: r.lat, lon: r.lon, dashed: r.masked,
      radius: r.masked ? 8 : 9 + 14 * Math.sqrt((r.today || 0) / max),
      color: r.masked ? "var(--color-c0)" : (r.trend ?? 0) > 1 ? "var(--color-c2)" : "var(--color-c1)",
      title: r.masked ? `${r.name} · masqué (moins de 10 foyers)` : `${r.name} · ${kwh(r.today || 0)} aujourd'hui`,
    }));
  }, [regions]);
  return (
    <Suspense fallback={<Skeleton className="h-[560px]" />}>
      <NetworkMap bubbles={bubbles} selected={selected} onSelect={onSelect} />
    </Suspense>
  );
}

/* ------------------------------------------------------------------ Buildings */
export function StegBuildings() {
  const { data } = useApi<any>("steg/buildings", { refetch: 60000 });
  const nav = useNavigate();
  if (!data) return <Skeleton className="h-96" />;
  return (
    <div>
      <PageHeader title="Bâtiments" />
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-ink-3">
            {["Bâtiment", "Foyers", "Compteur aujourd'hui", "Part non suivie", "14 jours", ""].map((h) => <th key={h} className="px-5 py-3 font-medium">{h}</th>)}
          </tr></thead>
          <tbody>
            {data.items.map((b: any) => {
              const drift = b.untracked - b.untracked_ref > 0.04;
              return (
                <tr key={b.code} onClick={() => nav(`/app/steg/batiments/${b.code}`)} className="cursor-pointer border-b border-line last:border-0 hover:bg-muted/60">
                  <td className="px-5 py-3"><b className="font-medium">{b.name}</b>{b.live && <LiveDot className="ml-2" />}<div className="text-xs text-ink-3">{b.district} · {b.region}</div></td>
                  <td className="px-5 py-3 tabular">{b.households}</td>
                  <td className="px-5 py-3 tabular">{kwh(b.today_meter)}</td>
                  <td className="px-5 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${b.untracked * 100}%`, background: drift ? "var(--color-bad)" : "var(--color-c0)" }} /></div><span className={cn("tabular", drift && "font-medium text-bad")}>{pct(b.untracked)}</span></div></td>
                  <td className="w-32 px-5 py-2"><Spark values={b.spark} height={30} color={drift ? "var(--color-bad)" : "var(--color-c1)"} /></td>
                  <td className="px-5 py-3 text-right">{b.alerts > 0 && <Badge tone="bad">{b.alerts}</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export function StegBuilding() {
  const { code } = useParams();
  const { data: b } = useApi<any>(`steg/buildings/${code}`, { refetch: 30000 });
  const nav = useNavigate();
  const [inc, setInc] = useState<any>(null);
  if (!b) return <Skeleton className="h-96" />;
  const eq = b.equation;
  const share = eq.meter ? eq.monitored / eq.meter : 0;
  return (
    <div className="grid gap-5">
      <Link to="/app/steg/batiments" className="flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink"><ArrowLeft className="size-4" />Bâtiments</Link>
      <PageHeader title={b.name}><Badge>{b.meter_id}</Badge></PageHeader>
      <Card id="equation">
        <CardTitle right={<span className="flex items-center gap-1.5 text-xs text-ink-3"><LiveDot />Aujourd'hui {kwh(b.today.monitored)} / {kwh(b.today.meter)}</span>}>Ce mois</CardTitle>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <Eq label="Compteur collectif" v={eq.meter} />
          <span className="pb-2 text-2xl text-ink-3">=</span>
          <Eq label="Adaptateurs" v={eq.monitored} color="var(--color-c1)" />
          <span className="pb-2 text-2xl text-ink-3">+</span>
          <Eq label="Non suivi (estimé)" v={eq.untracked} color="var(--color-c0)" />
        </div>
        <div className="mt-5 flex h-4 gap-0.5 overflow-hidden rounded-full">
          <motion.div className="h-full bg-c1" initial={{ width: 0 }} animate={{ width: `${share * 100}%` }} transition={{ duration: 1 }} />
          <div className="h-full flex-1 bg-c0/50" />
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle>30 jours</CardTitle>
          <Lines data={b.daily.slice(0, -1).map((d: any) => ({ x: d[0], mon: d[1], meter: d[2] }))} height={220} xFormat={day}
            keys={[{ key: "meter", name: "Compteur", color: "var(--color-c2)" }, { key: "mon", name: "Adaptateurs", color: "var(--color-c1)" }]} />
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle>Usages suivis</CardTitle>
          <Donut size={170} data={b.categories.map((c: any) => ({ name: c.label, value: c.kwh, color: colorOfLabel(c.label) }))} center={<b className="tabular">{n(eq.monitored)}<div className="text-xs font-normal text-ink-3">kWh</div></b>} />
          <Legend items={b.categories.slice(0, 6).map((c: any) => ({ name: c.label, color: colorOfLabel(c.label) }))} />
        </Card>
      </div>
      <Card className="overflow-x-auto p-0">
        <div className="px-5 pt-5"><CardTitle right={<span className="text-xs text-ink-3">Pseudonymes uniquement</span>}>Attribution par foyer</CardTitle></div>
        <table className="w-full min-w-[560px] text-sm">
          <tbody>
            {b.households.map((h: any) => (
              <tr key={h.code} onClick={() => nav(`/app/steg/foyers/${h.code}`)} className="cursor-pointer border-t border-line hover:bg-muted/60">
                <td className="px-5 py-3 font-mono text-[13px]">{h.code}{h.live && <LiveDot className="ml-2" />}</td>
                <td className="px-5 py-3 text-ink-3">{h.category} · {h.occupants} pers.</td>
                <td className="px-5 py-3 tabular">{kwh(h.kwh)}</td>
                <td className="w-48 px-5 py-3"><div className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-c1" style={{ width: `${h.share * 100 * 4}%` }} /></div><span className="w-10 text-right text-xs tabular text-ink-3">{pct(h.share)}</span></div></td>
                <td className="px-5 py-3 text-right">{h.alerts > 0 && <Badge tone="bad">{h.alerts}</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {b.incidents.length > 0 && (
        <Card><CardTitle>Incidents</CardTitle><div className="grid gap-2">{b.incidents.map((a: any) => <IncidentRow key={a.id} a={a} onOpen={() => setInc(a)} />)}</div></Card>
      )}
      <IncidentDialog inc={inc} onClose={() => setInc(null)} />
    </div>
  );
}

function Eq({ label, v, color }: { label: string; v: number; color?: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-ink-3">{color && <i className="size-2 rounded-sm" style={{ background: color }} />}{label}</div>
      <div className="text-3xl font-semibold tracking-tight tabular">{n(v)}<span className="ml-1 text-base text-ink-3">kWh</span></div>
    </div>
  );
}

export function StegHousehold() {
  const { code } = useParams();
  const { data: h } = useApi<any>(`steg/households/${code}`);
  if (!h) return <Skeleton className="h-80" />;
  const total = h.appliances.reduce((a: number, x: any) => a + x.kwh, 0) || 1;
  return (
    <div className="grid gap-5">
      <Link to={`/app/steg/batiments/${h.building_code}`} className="flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink"><ArrowLeft className="size-4" />{h.building}</Link>
      <PageHeader title={h.code}><Badge>{h.category} · {h.occupants} pers.</Badge><Badge tone="info"><Lock />Pseudonymisé</Badge></PageHeader>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>Appareils (30 jours)</CardTitle>
          <div className="grid gap-3">
            {h.appliances.map((a: any) => { const C = catOf(a.code); return (
              <div key={a.adapter} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                <C.icon className="size-4" style={{ color: C.color }} /><div><div className="text-sm">{a.category}</div><div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(a.kwh / total) * 100}%`, background: C.color }} /></div></div>
                <b className="text-sm tabular">{kwh(a.kwh)}</b>
              </div>); })}
          </div>
        </Card>
        <Card><CardTitle>Par jour</CardTitle><Bars data={h.daily.map((d: any) => ({ x: d[0], v: d[1] }))} height={220} xFormat={day} keys={[{ key: "v", name: "Énergie", color: "var(--color-c1)" }]} /></Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Incidents */
function IncidentRow({ a, onOpen }: { a: any; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-4 rounded-xl border border-line p-3 text-left transition hover:shadow-sm">
      <Badge tone={SEVERITY_TONE[a.severity]}>{SEVERITY_LABEL[a.severity]}</Badge>
      <span className="min-w-0 flex-1"><b className="block truncate text-sm font-medium">{a.device} · {a.kind_label}</b>
        <span className="text-xs text-ink-3">{a.household || "Parties communes"} · {a.building} · {a.region}</span></span>
      <span className="hidden text-xs text-ink-3 sm:block">{dateTime(a.detected_at)}</span>
      {a.status !== "ouverte" && <Check className="size-4 text-good" />}
    </button>
  );
}

function IncidentDialog({ inc, onClose }: { inc: any; onClose: () => void }) {
  const act = useAction();
  if (!inc) return null;
  const rd = (inc.readings || []).filter((r: any) => r[1] != null).map((r: any) => ({ x: r[0], w: r[1] }));
  return (
    <Dialog open={!!inc} onOpenChange={(o) => !o && onClose()} side title={`${inc.device} · ${inc.kind_label}`}>
      <div className="grid gap-5">
        <div className="flex flex-wrap gap-2"><Badge tone={SEVERITY_TONE[inc.severity]}>{SEVERITY_LABEL[inc.severity]}</Badge><Badge>{inc.household || "Parties communes"}</Badge><Badge>{inc.building}</Badge></div>
        <div className="grid grid-cols-3 gap-3">
          {[["Mesuré", inc.measured], ["Attendu", inc.expected], ["Enjeu / mois", null]].map(([l, v]: any, i) => (
            <div key={l} className="rounded-xl bg-muted p-3"><div className="text-xs text-ink-3">{l}</div><b className="tabular">{i === 2 ? kwh(inc.kwh_month) : inc.unit === "W" ? watts(v) : `${n(v)} ${inc.unit}`}</b></div>
          ))}
        </div>
        {rd.length > 2 && <Lines data={rd} height={170} unit="W" xFormat={(v) => timeS(v).slice(3)} keys={[{ key: "w", name: "Puissance", color: "var(--color-bad)" }]} />}
        {inc.cause && <p className="text-sm"><span className="text-ink-3">Cause probable · </span>{inc.cause}</p>}
        {inc.rule && <p className="text-xs text-ink-3">Règle : {inc.rule}</p>}
        <p className="text-xs text-ink-3">Détecté {ago(inc.detected_at)} · confiance {n(inc.confidence * 100)} %</p>
        {inc.status === "ouverte" ? <Button variant="good" onClick={() => act.mutate({ path: `steg/incidents/${inc.id}/resolve`, success: "Incident résolu" }, { onSuccess: onClose })}><Check />Marquer comme résolu</Button>
          : <Badge tone="good"><Check />Traité</Badge>}
      </div>
    </Dialog>
  );
}

export function StegIncidents() {
  const [status, setStatus] = useState("ouverte");
  const [sev, setSev] = useState("");
  const { data } = useApi<any>(`steg/incidents?status=${status}&severity=${sev}`, { refetch: 10000 });
  const [inc, setInc] = useState<any>(null);
  return (
    <div className="grid gap-5">
      <PageHeader title="Incidents"><Tabs value={status} onValueChange={setStatus} items={[["ouverte", "Ouverts"], ["historique", "Historique"], ["toutes", "Tous"]]} /></PageHeader>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {["critique", "elevee", "attention", "info"].map((s) => (
          <button key={s} onClick={() => setSev(sev === s ? "" : s)} className={cn("rounded-2xl border bg-card p-4 text-left transition", sev === s ? "border-ink" : "border-line hover:shadow-sm")}>
            <Badge tone={SEVERITY_TONE[s]}>{SEVERITY_LABEL[s]}</Badge><div className="mt-2 text-2xl font-semibold tabular">{data?.counts[s] ?? "–"}</div>
          </button>
        ))}
      </div>
      {!data ? <Skeleton className="h-60" /> : data.items.length ? (
        <div className="grid gap-2">{data.items.map((a: any) => <IncidentRow key={a.id} a={a} onOpen={() => setInc(a)} />)}</div>
      ) : <Card className="py-12 text-center text-sm text-ink-3"><Siren className="mx-auto mb-2 size-5" />Aucun incident</Card>}
      <IncidentDialog inc={inc} onClose={() => setInc(null)} />
    </div>
  );
}

/* ------------------------------------------------------------------ Peak */
export function StegPeak() {
  const { data } = useApi<any>("steg/peak", { refetch: 60000 });
  if (!data) return <Skeleton className="h-96" />;
  const max = Math.max(...data.heat.flatMap((r: any) => r[1]), 1);
  return (
    <div className="grid gap-5">
      <PageHeader title="Pointe de demande" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Heure de pointe" value={`${data.peak_hour} h`} />
        <Stat label="Part 18 h – 22 h" value={pct(data.peak_share)} />
        <Stat label="Décalable chaque soir" value={n(data.shiftable)} unit="kWh" sub="chauffe-eau, lave-linge, compresseurs" />
      </div>
      <Card>
        <CardTitle>Moyenne 7 jours et aujourd'hui</CardTitle>
        <Lines data={data.avg.map((v: number, i: number) => ({ x: i, avg: v, today: i <= data.now_hour ? data.today[i] : null }))} height={230} xFormat={(v) => `${v}h`}
          keys={[{ key: "avg", name: "Moyenne", color: "var(--color-c1)" }, { key: "today", name: "Aujourd'hui", color: "var(--color-c2)" }]} />
      </Card>
      <Card className="overflow-x-auto">
        <CardTitle>Heure par heure, 7 jours</CardTitle>
        <div className="grid min-w-[640px] gap-1" style={{ gridTemplateColumns: "72px repeat(24, 1fr)" }}>
          {data.heat.map(([d, vals]: any) => [
            <span key={d} className="pr-2 text-right text-xs text-ink-3">{day(d)}</span>,
            ...vals.map((v: number, h: number) => <div key={d + h} title={`${h} h · ${n(v, 1)} kWh`} className="h-6 rounded" style={{ background: `color-mix(in oklch, var(--color-c1) ${Math.round(6 + (v / max) * 94)}%, var(--color-card))` }} />),
          ])}
          <span />{Array.from({ length: 24 }, (_, h) => <span key={h} className="text-center text-[10px] text-ink-3">{h % 3 === 0 ? h : ""}</span>)}
        </div>
      </Card>
    </div>
  );
}
