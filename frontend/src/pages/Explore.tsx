import { ArrowRight, BookOpen, ExternalLink, Globe2, User, Waypoints } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router";
import { Donut } from "@/components/charts";
import { BackLink, Badge, Card, CardTitle, PageHeader, Skeleton, Tabs } from "@/components/ui";
import { useApi } from "@/lib/api";
import { colorOfLabel } from "@/lib/categories";
import { kwh, n } from "@/lib/format";
import { useMe } from "@/lib/session";

export function Explore() {
  const tiles = [
    { to: "/app/comparer", icon: Globe2, title: "Tunisia – Japan", sub: "Sourced official data" },
    { to: "/app/flux", icon: Waypoints, title: "Energy flows", sub: "From the grid to each device" },
    { to: "/app/apprendre", icon: BookOpen, title: "Learn", sub: "Games, quizzes and a bill simulator" },
    { to: "/app/profil", icon: User, title: "Profile and contract", sub: "Goal, subscribed power, terms" },
  ];
  return (
    <div>
      <PageHeader title="Explore" />
      <div className="grid gap-4 sm:grid-cols-2">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to} className="group flex items-center gap-4 rounded-2xl border border-line bg-card p-5 transition hover:shadow-md">
            <span className="grid size-12 place-items-center rounded-2xl bg-muted"><t.icon className="size-5" /></span>
            <span className="flex-1"><b className="block font-medium">{t.title}</b><span className="text-sm text-ink-3">{t.sub}</span></span>
            <ArrowRight className="size-4 text-ink-3 transition group-hover:translate-x-1" />
          </Link>
        ))}
      </div>
    </div>
  );
}

const ToExplore = ({ className }: { className?: string }) => <BackLink to="/app/explorer" className={className}>Explore</BackLink>;

export function Compare() {
  const { data: who } = useMe();
  const { data } = useApi<any>("benchmark");
  if (!data) return <Skeleton className="h-80" />;
  const tn = data.countries.tunisie, jp = data.countries.japon, me = data.mine;
  const bars = [
    { label: "Tunisia", sub: `average ${tn.year}`, v: tn.household_kwh_year, color: "var(--color-c2)", src: tn.source },
    { label: "Japan", sub: `average ${jp.year}`, v: jp.household_kwh_year, color: "var(--color-c7)", src: jp.source },
    ...(me ? [{ label: me.label, sub: "projection, simulated", v: me.kwh_year, color: "var(--color-c1)", src: null }] : []),
  ];
  const max = Math.max(...bars.map((b) => b.v));
  const src = (k: string) => data.sources[k];
  return (
    <div className="grid gap-5">
      {who?.user?.role !== "steg" && <ToExplore />}
      <PageHeader title="Tunisia – Japan" />
      <Card>
        <CardTitle>Electricity per household per year</CardTitle>
        <div className="grid gap-5">
          {bars.map((b, i) => (
            <div key={b.label}>
              <div className="mb-1.5 flex items-baseline justify-between text-sm"><span><b className="font-medium">{b.label}</b> <span className="text-ink-3">· {b.sub}</span></span><b className="tabular">{n(b.v)} kWh</b></div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <motion.div className="h-full rounded-full" style={{ background: b.color }} initial={{ width: 0 }} animate={{ width: `${(b.v / max) * 100}%` }} transition={{ duration: 1, delay: i * 0.15 }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm text-ink-2">A Japanese household uses about <b>{n(jp.household_kwh_year / tn.household_kwh_year, 1)}×</b> more than a Tunisian household. In Tunisia, the average rose by <b>{n((tn.household_kwh_year / tn.previous.kwh - 1) * 100, 1)}%</b> between {tn.previous.year} and {tn.year}.</p>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>Tunisia: household electricity uses</CardTitle>
          <Donut size={190} data={tn.uses.map((u: any, i: number) => ({ name: u[0], value: u[1], color: `var(--color-c${(i % 8) + 1})` }))} center={<span className="text-xs text-ink-3">{tn.year}</span>} />
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {tn.uses.map((u: any, i: number) => <span key={u[0]} className="flex items-center justify-between"><span className="flex items-center gap-1.5"><i className="size-2 rounded-sm" style={{ background: `var(--color-c${(i % 8) + 1})` }} />{u[0]}</span><b>{u[1]} %</b></span>)}
          </div>
        </Card>
        <Card>
          <CardTitle>Same technology, different priorities</CardTitle>
          {[tn, jp].map((c: any) => (
            <div key={c.name} className="mb-4">
              <b className="text-sm font-medium">{c.name}</b>
              <div className="mt-2 flex flex-wrap gap-2">{c.focus.map((f: string) => <Badge key={f}>{f}</Badge>)}</div>
            </div>
          ))}
          <p className="text-sm text-ink-3">Japan: from {n(jp.range.min[1])} kWh ({jp.range.min[0]}) to {n(jp.range.max[1])} kWh ({jp.range.max[0]}) depending on the region.</p>
        </Card>
      </div>
      <div className="grid gap-1 text-xs text-ink-3">
        {[tn.source, jp.source, "steg_tarif", "iea"].map((k) => (
          <a key={k} href={src(k).url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-ink"><ExternalLink className="size-3" />{src(k).label}</a>
        ))}
      </div>
    </div>
  );
}

export function Flows() {
  const [scope, setScope] = useState("foyer");
  const { data } = useApi<any>(`flows?scope=${scope}`, { refetch: 15000 });
  return (
    <div className="grid">
      <ToExplore className="mb-4" />
      <PageHeader title="Energy flows"><Tabs value={scope} onValueChange={setScope} items={[["foyer", "My home"], ["immeuble", "My building"]]} /></PageHeader>
      {!data ? <Skeleton className="h-96" /> : <Sankey data={data} />}
    </div>
  );
}

function Sankey({ data }: { data: any }) {
  const W = 900, H = Math.max(380, data.consumers.length * 52 + 40);
  const total = data.total || 1;
  const sources = [{ label: "STEG grid", kwh: data.grid, color: "var(--color-c1)" }, ...(data.solar > 0 ? [{ label: "Solar (simulated)", kwh: data.solar, color: "var(--color-c4)" }] : [])];
  const scale = (H - 60) / total;
  const midX = 380, midW = 18;
  let y = 30;
  const src = sources.map((s) => { const h = Math.max(3, s.kwh * scale); const r = { ...s, y, h }; y += h + 14; return r; });
  const midH = total * scale, midY = (H - midH) / 2;
  let cy = 20, my = midY;
  const gap = (H - 40 - midH) / Math.max(1, data.consumers.length - 1);
  const cons = data.consumers.map((c: any, i: number) => {
    const h = Math.max(3, c.kwh * scale);
    const r = { ...c, y: cy, h, my, color: c.label.includes("Non suivi") || c.label.includes("Autres") ? "var(--color-c0)" : colorOfLabel(c.label) !== "var(--color-c0)" ? colorOfLabel(c.label) : `var(--color-c${(i % 8) + 1})` };
    cy += h + Math.min(gap, 22); my += h;
    return r;
  });
  let sy = midY;
  const link = (x0: number, y0: number, x1: number, y1: number, h: number) => `M${x0},${y0 + h / 2} C${(x0 + x1) / 2},${y0 + h / 2} ${(x0 + x1) / 2},${y1 + h / 2} ${x1},${y1 + h / 2}`;
  return (
    <Card className="overflow-x-auto">
      <div className="mb-4 flex flex-wrap gap-8">
        <div><div className="text-xs text-ink-3">Today</div><div className="text-2xl font-semibold tabular">{kwh(data.total)}</div></div>
        <div><div className="text-xs text-ink-3">CO₂</div><div className="text-2xl font-semibold tabular">{n(data.co2_kg, 2)} kg</div></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[640px]">
        {src.map((s) => { const p = link(150, s.y, midX, sy, s.h); const el = <g key={s.label}><path d={p} fill="none" stroke={s.color} strokeOpacity={0.3} strokeWidth={s.h} />
          <motion.path d={p} fill="none" stroke="white" strokeOpacity={0.7} strokeWidth={Math.min(2, s.h / 3)} strokeDasharray="3 18" animate={{ strokeDashoffset: [0, -42] }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} />
          <rect x={136} y={s.y} width={14} height={s.h} rx={3} fill={s.color} /><text x={128} y={s.y + s.h / 2 + 4} textAnchor="end" className="fill-ink text-[13px] font-medium">{s.label}</text>
          <text x={128} y={s.y + s.h / 2 + 20} textAnchor="end" className="fill-ink-3 text-[11px]">{kwh(s.kwh)}</text></g>; sy += s.h; return el; })}
        <rect x={midX} y={midY} width={midW} height={midH} rx={4} fill="var(--color-ink)" />
        {cons.map((c: any) => { const p = link(midX + midW, c.my, 640, c.y, c.h); return (
          <g key={c.label}><path d={p} fill="none" stroke={c.color} strokeOpacity={0.3} strokeWidth={c.h} />
            <motion.path d={p} fill="none" stroke="white" strokeOpacity={0.7} strokeWidth={Math.min(2, c.h / 3)} strokeDasharray="3 18" animate={{ strokeDashoffset: [0, -42] }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} />
            <rect x={640} y={c.y} width={14} height={c.h} rx={3} fill={c.color} />
            <text x={664} y={c.y + c.h / 2 + 4} className="fill-ink text-[13px] font-medium">{c.label}</text>
            <text x={664} y={c.y + c.h / 2 + 19} className="fill-ink-3 text-[11px]">{kwh(c.kwh)}</text></g>); })}
      </svg>
    </Card>
  );
}
