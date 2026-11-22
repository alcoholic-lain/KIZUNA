import { Check, Crosshair, Lock, Pencil, Plus, Power, SearchX, Siren, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { lazy, Suspense, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { Bars, Donut, Legend, Lines, Spark } from "@/components/charts";
import { AnimatedNumber, BackLink, Badge, Button, Card, Empty, CardTitle, Delta, Dialog, InfoTip, LiveDot, PageHeader, SEVERITY_LABEL, SEVERITY_TONE, Skeleton, Stat, Tabs } from "@/components/ui";
import { useAction, useApi } from "@/lib/api";
import { codeOfLabel, colorOfLabel, catOf } from "@/lib/categories";
import { ago, day, dateTime, kwh, n, pct, timeS, watts } from "@/lib/format";
import { cn } from "@/lib/utils";

const Atlas = lazy(() => import("./Atlas"));

/* ------------------------------------------------------------------ Network */
export function StegNetwork() {
  const { data } = useApi<any>("steg/overview", { refetch: 60000 });
  const { data: live } = useApi<any>("live", { refetch: 2500 });
  const [params] = useSearchParams();
  const region = data?.regions.find((r: any) => r.code === params.get("r"));
  return (
    <div className="grid gap-5">
      <PageHeader title="Network"><Badge>Simulated collective meters</Badge></PageHeader>
      {data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={<><LiveDot />Tracked power</>} value={<AnimatedNumber value={(live?.live_w ?? data.live_w) / 1000} decimals={1} />} unit="kW" sub={`${n(data.counts.adapters)} adapters`} />
          <Stat label="Today" value={n(data.today)} unit="kWh" sub={`meters: ${n(data.today_meter)} kWh`} />
          <Stat label="This month" value={n(data.month)} unit="kWh" sub={<Delta value={data.trend} />} />
          <Stat label="Open incidents" value={live?.open ?? data.open} sub={`${data.counts.households} households · ${data.counts.buildings} buildings`} />
        </div>
      ) : <Skeleton className="h-28" />}
      <RecentDevices />
      <RailwayReadings />
      <Suspense fallback={<Skeleton className="h-[520px]" />}>
        <Atlas title="Adapter map" />
      </Suspense>
      {region && (
        <Card>
          <CardTitle right={region.masked ? <Badge><Lock />Hidden</Badge> : <Delta value={region.trend} />}>{region.name}</CardTitle>
          {region.masked ? (
            <p className="text-sm text-ink-3">Only {region.households} households: below 10, no aggregate is shown to protect privacy.</p>
          ) : (
            <div className="grid gap-5">
              <div className="grid grid-cols-3 gap-3 text-center">
                {[["Households", region.households], ["Buildings", region.buildings], ["Alerts", region.alerts]].map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-muted p-3"><div className="text-xs text-ink-3">{l}</div><b className="text-lg tabular">{v}</b></div>
                ))}
              </div>
              <div><div className="mb-1 flex justify-between text-xs text-ink-3"><span>14 days</span><span>{kwh(region.today)} today</span></div><Spark values={region.daily} height={60} /></div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-ink-3"><span>Hourly profile</span><span>{pct(region.peak_share)} at peak</span></div>
                <Bars data={region.profile.map((v: number, i: number) => ({ x: i, v }))} height={110} highlight={[18, 21]} xFormat={(v) => `${v}h`} keys={[{ key: "v", name: "kWh", color: "var(--color-c1)" }]} />
              </div>
            </div>
          )}
        </Card>
      )}
      {data && (
        <Card>
          <CardTitle right={<InfoTip content="Collective meter = adapters + other household uses + common areas" />}>30 days: meters and adapters</CardTitle>
          <Lines data={data.daily.slice(0, -1).map((d: any) => ({ x: d[0], mon: d[1], meter: d[2] }))} height={240} xFormat={day}
            keys={[{ key: "meter", name: "Collective meters", color: "var(--color-c2)" }, { key: "mon", name: "Adapters", color: "var(--color-c1)" }]} />
          <Legend items={[{ name: "Collective meters", color: "var(--color-c2)" }, { name: "Adapters", color: "var(--color-c1)" }]} />
        </Card>
      )}
    </div>
  );
}

type ReceiverReading = {
  adaptateur_id: string;
  horodatage: string;
  watts: number;
  source: "simulee" | "reelle";
};

type RecentDevice = {
  adaptateur_id: string; name: string; region_id: string; city: string; registered_at: string;
  power_on: boolean; watts: number | null; last_seen: string | null; online: boolean;
};

/** Last registered adapters: follow one on the map, or cut its power (the simulator's relay opens within seconds). */
function RecentDevices() {
  const { data } = useApi<RecentDevice[]>("atlas/recent", { refetch: 3000 });
  const nav = useNavigate();
  const act = useAction();
  return (
    <Card>
      <CardTitle right={<span className="flex items-center gap-2"><Badge>{n(data?.length ?? 0)} latest</Badge>
        <Button size="sm" variant="brand" disabled={act.isPending} onClick={() => act.mutate({ path: "atlas/provision", body: {} })}><Plus />Add (simulated scan)</Button></span>}>Latest registered devices</CardTitle>
      {!data ? <Skeleton className="h-24" /> : !data.length ? <p className="text-sm text-ink-3">No devices registered yet.</p> : (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead><tr><th>Device</th><th>Sector</th><th>Power</th><th>Status</th><th /></tr></thead>
            <tbody>{data.map((d) => (
              <tr key={d.adaptateur_id} className="border-t">
                <td className="py-2"><b className="font-medium">{d.name}</b><div className="text-xs text-ink-3">{d.adaptateur_id} · {ago(d.registered_at)}</div></td>
                <td>{d.city ?? "–"}</td>
                <td className="tabular">{d.online && d.watts != null ? watts(d.watts) : "–"}</td>
                <td>{!d.power_on ? <Badge tone="bad">Cut off</Badge> : d.online ? <Badge tone="good"><LiveDot />Online</Badge> : <Badge>Offline</Badge>}</td>
                <td className="whitespace-nowrap py-1 text-right">
                  <Button size="sm" variant="outline" className="mr-2" onClick={() => nav(`/app/steg?r=${d.region_id}&d=${d.adaptateur_id}`)}><Crosshair />Follow</Button>
                  <Button size="sm" variant="outline" className="mr-2" aria-label={`Rename ${d.name}`} disabled={act.isPending}
                    onClick={() => { const name = window.prompt("New name", d.name)?.trim(); if (name && name !== d.name) act.mutate({ path: "atlas/rename", body: { adaptateur_id: d.adaptateur_id, name } }); }}><Pencil /></Button>
                  <Button size="sm" variant={d.power_on ? "outline" : "brand"} className="mr-2" disabled={act.isPending}
                    onClick={() => act.mutate({ path: "atlas/power", body: { adaptateur_id: d.adaptateur_id, on: !d.power_on } })}>
                    <Power />{d.power_on ? "Cut off" : "Restore"}
                  </Button>
                  <Button size="sm" variant="outline" aria-label={`Delete ${d.name}`} disabled={act.isPending}
                    onClick={() => { if (window.confirm(`Delete ${d.name} (${d.adaptateur_id})?`)) act.mutate({ path: "atlas/remove", body: { adaptateur_id: d.adaptateur_id } }); }}><Trash2 /></Button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function RailwayReadings() {
  const { data, error } = useApi<{ configured: boolean; readings: ReceiverReading[] }>("steg/telemetry", { refetch: 5000 });
  const latest = [...(data?.readings ?? [])].sort((a, b) => Date.parse(b.horodatage) - Date.parse(a.horodatage));
  return (
    <Card>
      <CardTitle right={<span className="flex flex-wrap items-center gap-2">
        {!error && data?.configured && <Badge tone="good"><LiveDot />Railway connected</Badge>}
        <Badge>{n(latest.length)} adapters</Badge>
      </span>}>Latest readings received</CardTitle>
      {error ? <p role="status" className="text-sm text-ink-3">{error.message}</p>
        : !data ? <p role="status" className="text-sm text-ink-3">Connecting to the receiver…</p>
        : !data.configured ? <p className="text-sm text-ink-3">Railway receiver not configured.</p>
        : !latest.length ? <p className="text-sm text-ink-3">Waiting for readings from the simulator.</p>
        : <div className="max-h-64 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead><tr><th>Adapter</th><th>Power</th><th>Reading</th><th>Source</th></tr></thead>
            <tbody>{latest.map(reading => (
              <tr key={reading.adaptateur_id} className="border-t">
                <td className="py-2">{reading.adaptateur_id}</td>
                <td>{watts(reading.watts)}</td>
                <td>{dateTime(reading.horodatage)}</td>
                <td>{reading.source === "simulee" ? "Simulated" : "Real"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>}
    </Card>
  );
}

type Registration = {
  adaptateur_id: string;
  region: string;
  city: string;
  scan_at: string;
  location: { x: number; y: number; z: number | null; accuracy_m: number };
};

export function StegRegistrations() {
  const { data, error } = useApi<{ items: Registration[] }>("atlas/registrations", { refetch: 5000 });
  const [search, setSearch] = useState("");
  const term = search.trim().toLocaleLowerCase("en");
  const items = (data?.items ?? []).filter(row =>
    `${row.adaptateur_id} ${row.city}`.toLocaleLowerCase("en").includes(term)
  );
  return (
    <div className="grid gap-5">
      <PageHeader title="Registrations"><Badge>{n(data?.items.length ?? 0)} adaptateurs</Badge></PageHeader>
      <Card>
        <CardTitle>Scanned adapters</CardTitle>
        <input className="mb-4 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm sm:max-w-xs"
          type="search" aria-label="Search for an adapter or region" placeholder="ID or region"
          value={search} onChange={event => setSearch(event.target.value)} />
        {error ? <p role="status" className="text-sm text-ink-3">{error.message}</p>
          : !data ? <Skeleton className="h-32" />
          : !items.length ? <p className="text-sm text-ink-3">{term ? "No matching adapter." : "No adapters scanned."}</p>
          : <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead><tr><th>Adapter</th><th>Region</th><th>Last GPS scan</th><th>GPS coordinates</th><th>GPS accuracy</th></tr></thead>
              <tbody>{items.map(row => (
                <tr key={row.adaptateur_id} className="border-t">
                  <td className="py-2 pr-4">
                    <Link className="font-medium text-brand hover:underline"
                      to={`/app/steg?r=${encodeURIComponent(row.region)}&d=${encodeURIComponent(row.adaptateur_id)}`}>{row.adaptateur_id}</Link>
                  </td>
                  <td className="pr-4">{row.city}</td>
                  <td className="pr-4" title={row.scan_at}>{dateTime(row.scan_at)}</td>
                  <td className="pr-4 font-mono text-xs">
                    {row.location.y.toFixed(6)}°, {row.location.x.toFixed(6)}°
                    {row.location.z !== null && ` · ${n(row.location.z)} m`}
                  </td>
                  <td>± {n(row.location.accuracy_m)} m</td>
                </tr>
              ))}</tbody>
            </table>
          </div>}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ Buildings */
export function StegBuildings() {
  const { data } = useApi<any>("steg/buildings", { refetch: 60000 });
  const nav = useNavigate();
  if (!data) return <Skeleton className="h-96" />;
  return (
    <div>
      <PageHeader title="Buildings" />
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-ink-3">
            {["Building", "Households", "Meter today", "Untracked share", "14 days", ""].map((h) => <th key={h} className="px-5 py-3 font-medium">{h}</th>)}
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
  const { data: b, error } = useApi<any>(`steg/buildings/${code}`, { refetch: 30000 });
  const nav = useNavigate();
  const [inc, setInc] = useState<any>(null);
  if (!b && error) return <Missing back="/app/steg/batiments" backLabel="Buildings" title={`Building ${code} not found`} error={error} />;
  if (!b) return <Skeleton className="h-96" />;
  const eq = b.equation;
  const share = eq.meter ? eq.monitored / eq.meter : 0;
  return (
    <div className="grid gap-5">
      <BackLink to="/app/steg/batiments">Buildings</BackLink>
      <PageHeader title={b.name}><Badge>{b.meter_id}</Badge></PageHeader>
      <Card id="equation">
        <CardTitle right={<span className="flex items-center gap-1.5 text-xs text-ink-3"><LiveDot />Today {kwh(b.today.monitored)} / {kwh(b.today.meter)}</span>}>This month</CardTitle>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <Eq label="Collective meter" v={eq.meter} />
          <span className="pb-2 text-2xl text-ink-3">=</span>
          <Eq label="Adapters" v={eq.monitored} color="var(--color-c1)" />
          <span className="pb-2 text-2xl text-ink-3">+</span>
          <Eq label="Untracked (estimated)" v={eq.untracked} color="var(--color-c0)" />
        </div>
        <div className="mt-5 flex h-4 gap-0.5 overflow-hidden rounded-full">
          <motion.div className="h-full bg-c1" initial={{ width: 0 }} animate={{ width: `${share * 100}%` }} transition={{ duration: 1 }} />
          <div className="h-full flex-1 bg-c0/50" />
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle>30 days</CardTitle>
          <Lines data={b.daily.slice(0, -1).map((d: any) => ({ x: d[0], mon: d[1], meter: d[2] }))} height={220} xFormat={day}
            keys={[{ key: "meter", name: "Meter", color: "var(--color-c2)" }, { key: "mon", name: "Adapters", color: "var(--color-c1)" }]} />
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle>Tracked uses</CardTitle>
          <Donut size={170} data={b.categories.map((c: any) => ({ name: c.label, value: c.kwh, color: colorOfLabel(c.label) }))} center={<b className="tabular">{n(eq.monitored)}<div className="text-xs font-normal text-ink-3">kWh</div></b>} />
          <Legend items={b.categories.slice(0, 6).map((c: any) => ({ name: c.label, color: colorOfLabel(c.label) }))} />
        </Card>
      </div>
      <Card className="overflow-x-auto p-0">
        <div className="px-5 pt-5"><CardTitle right={<span className="text-xs text-ink-3">Pseudonyms only</span>}>Attribution by household</CardTitle></div>
        <table className="w-full min-w-[560px] text-sm">
          <tbody>
            {b.households.map((h: any) => (
              <tr key={h.code} onClick={() => nav(`/app/steg/foyers/${h.code}`)} className="cursor-pointer border-t border-line hover:bg-muted/60">
                <td className="px-5 py-3 font-mono text-[13px]">{h.code}{h.live && <LiveDot className="ml-2" />}</td>
                <td className="px-5 py-3 text-ink-3">{h.category} · {h.occupants} occ.</td>
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

/** Detail page whose code does not exist (or failed to load): say so and offer the way back. */
function Missing({ back, backLabel, title, error }: { back: string; backLabel: string; title: string; error: unknown }) {
  return (
    <div className="grid gap-5">
      <BackLink to={back}>{backLabel}</BackLink>
      <Card><Empty icon={SearchX} title={title}><p className="text-sm text-ink-3">{(error as Error).message}</p></Empty></Card>
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
  const { data: h, error } = useApi<any>(`steg/households/${code}`);
  if (!h && error) return <Missing back="/app/steg/batiments" backLabel="Buildings" title={`Household ${code} not found`} error={error} />;
  if (!h) return <Skeleton className="h-80" />;
  const total = h.appliances.reduce((a: number, x: any) => a + x.kwh, 0) || 1;
  return (
    <div className="grid gap-5">
      <BackLink to={`/app/steg/batiments/${h.building_code}`}>{h.building}</BackLink>
      <PageHeader title={h.code}><Badge>{h.category} · {h.occupants} occ.</Badge><Badge tone="info"><Lock />Pseudonymised</Badge></PageHeader>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>Appliances (30 days)</CardTitle>
          <div className="grid gap-3">
            {h.appliances.map((a: any) => { const C = catOf(a.code); return (
              <div key={a.adapter} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                <C.icon className="size-4" style={{ color: C.color }} /><div><div className="text-sm">{a.category}</div><div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(a.kwh / total) * 100}%`, background: C.color }} /></div></div>
                <b className="text-sm tabular">{kwh(a.kwh)}</b>
              </div>); })}
          </div>
        </Card>
        <Card><CardTitle>Per day</CardTitle><Bars data={h.daily.map((d: any) => ({ x: d[0], v: d[1] }))} height={220} xFormat={day} keys={[{ key: "v", name: "Energy", color: "var(--color-c1)" }]} /></Card>
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
        <span className="text-xs text-ink-3">{a.household || "Common areas"} · {a.building} · {a.region}</span></span>
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
        <div className="flex flex-wrap gap-2"><Badge tone={SEVERITY_TONE[inc.severity]}>{SEVERITY_LABEL[inc.severity]}</Badge><Badge>{inc.household || "Common areas"}</Badge><Badge>{inc.building}</Badge></div>
        <div className="grid grid-cols-3 gap-3">
          {[["Measured", inc.measured], ["Expected", inc.expected], ["At stake / month", null]].map(([l, v]: any, i) => (
            <div key={l} className="rounded-xl bg-muted p-3"><div className="text-xs text-ink-3">{l}</div><b className="tabular">{i === 2 ? kwh(inc.kwh_month) : inc.unit === "W" ? watts(v) : `${n(v)} ${inc.unit}`}</b></div>
          ))}
        </div>
        {rd.length > 2 && <Lines data={rd} height={170} unit="W" xFormat={(v) => timeS(v).slice(3)} keys={[{ key: "w", name: "Power", color: "var(--color-bad)" }]} />}
        {inc.cause && <p className="text-sm"><span className="text-ink-3">Probable cause · </span>{inc.cause}</p>}
        {inc.rule && <p className="text-xs text-ink-3">Rule: {inc.rule}</p>}
        <p className="text-xs text-ink-3">Detected {ago(inc.detected_at)} · confidence {n(inc.confidence * 100)} %</p>
        {inc.status === "ouverte" ? <Button variant="good" disabled={act.isPending} onClick={() => act.mutate({ path: `steg/incidents/${inc.id}/resolve`, success: "Incident resolved" }, { onSuccess: onClose })}><Check />Mark as resolved</Button>
          : <Badge tone="good"><Check />Handled</Badge>}
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
      <PageHeader title="Incidents"><Tabs value={status} onValueChange={setStatus} items={[["ouverte", "Open"], ["historique", "History"], ["toutes", "All"]]} /></PageHeader>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {["critique", "elevee", "attention", "info"].map((s) => (
          <button key={s} onClick={() => setSev(sev === s ? "" : s)} className={cn("rounded-2xl border bg-card p-4 text-left transition", sev === s ? "border-ink" : "border-line hover:shadow-sm")}>
            <Badge tone={SEVERITY_TONE[s]}>{SEVERITY_LABEL[s]}</Badge><div className="mt-2 text-2xl font-semibold tabular">{data?.counts[s] ?? "–"}</div>
          </button>
        ))}
      </div>
      {!data ? <Skeleton className="h-60" /> : data.items.length ? (
        <div className="grid gap-2">{data.items.map((a: any) => <IncidentRow key={a.id} a={a} onOpen={() => setInc(a)} />)}</div>
      ) : <Card className="py-12 text-center text-sm text-ink-3"><Siren className="mx-auto mb-2 size-5" />No incidents</Card>}
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
      <PageHeader title="Demand peak" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Peak hour" value={`${data.peak_hour} h`} />
        <Stat label="6–10 pm share" value={pct(data.peak_share)} />
        <Stat label="Shiftable each evening" value={n(data.shiftable)} unit="kWh" sub="water heater, washing machine, compressors" />
      </div>
      <Card>
        <CardTitle>7-day average and today</CardTitle>
        <Lines data={data.avg.map((v: number, i: number) => ({ x: i, avg: v, today: i <= data.now_hour ? data.today[i] : null }))} height={230} xFormat={(v) => `${v}h`}
          keys={[{ key: "avg", name: "Average", color: "var(--color-c1)" }, { key: "today", name: "Today", color: "var(--color-c2)" }]} />
      </Card>
      <Card className="overflow-x-auto">
        <CardTitle>Hour by hour, 7 days</CardTitle>
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
