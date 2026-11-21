import { motion } from "motion/react";
import type { ReactNode } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { n } from "@/lib/format";

function Box({ title, rows }: { title: ReactNode; rows: { name: string; color: string; value: string }[] }) {
  return (
    <div className="min-w-36 rounded-xl border border-line bg-card px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-medium">{title}</div>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-ink-2"><i className="size-2 rounded-sm" style={{ background: r.color }} />{r.name}</span>
          <b className="tabular">{r.value}</b>
        </div>
      ))}
    </div>
  );
}

const axis = { tickLine: false, axisLine: false, fontSize: 11 } as const;

export function LiveArea({ data, height = 120, color = "var(--color-energy)", dark }: { data: { t: string; v: number }[]; height?: number; color?: string; dark?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="liveFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity={0.45} />
            <stop offset="1" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={[0, (m: number) => m * 1.15]} />
        <Tooltip cursor={{ stroke: dark ? "rgba(255,255,255,.3)" : "var(--color-ink-3)", strokeDasharray: 3 }}
          content={({ active, payload }) => active && payload?.length ? <Box title={(payload[0].payload as any).t} rows={[{ name: "Puissance", color, value: `${n(payload[0].value as number)} W` }]} /> : null} />
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill="url(#liveFill)" isAnimationActive={false} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Bars({ data, keys, height = 220, stacked, unit = "kWh", xFormat, refLine, highlight }: {
  data: any[]; keys: { key: string; name: string; color: string }[]; height?: number; stacked?: boolean; unit?: string;
  xFormat?: (v: any) => string; refLine?: { y: number; label: string }; highlight?: [number, number];
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} />
        <XAxis dataKey="x" {...axis} tickFormatter={xFormat} interval="preserveStartEnd" minTickGap={14} />
        <YAxis {...axis} tickFormatter={(v) => n(v, v < 10 && v % 1 ? 1 : 0)} width={44} />
        {highlight && <ReferenceArea x1={data[highlight[0]]?.x} x2={data[highlight[1]]?.x} fill="var(--color-energy)" fillOpacity={0.12} />}
        <Tooltip cursor={{ fill: "var(--color-muted)" }} content={({ active, payload, label }) => active && payload?.length ?
          <Box title={xFormat ? xFormat(label) : label} rows={payload.map((p: any) => ({ name: p.name, color: p.color || p.fill, value: `${n(p.value, p.value < 10 ? 2 : 1)} ${unit}` }))} /> : null} />
        {refLine && <ReferenceLine y={refLine.y} stroke="var(--color-bad)" strokeDasharray="4 4" label={{ value: refLine.label, position: "insideTopRight", fontSize: 11, fill: "var(--color-bad)" }} />}
        {keys.map((k, i) => (
          <Bar key={k.key} dataKey={k.key} name={k.name} fill={k.color} stackId={stacked ? "s" : undefined}
            radius={stacked ? (i === keys.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]} maxBarSize={36} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Lines({ data, keys, height = 240, unit = "kWh", xFormat, refs, area }: {
  data: any[]; keys: { key: string; name: string; color: string; dash?: boolean }[]; height?: number; unit?: string;
  xFormat?: (v: any) => string; refs?: { y: number; label: string; color: string }[]; area?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="x" {...axis} tickFormatter={xFormat} minTickGap={24} />
        <YAxis {...axis} tickFormatter={(v) => n(v)} width={44} domain={[0, "auto"]} />
        <Tooltip content={({ active, payload, label }) => active && payload?.length ?
          <Box title={xFormat ? xFormat(label) : label} rows={payload.filter((p: any) => p.value != null).map((p: any) => ({ name: p.name, color: p.color, value: `${n(p.value, p.value < 10 ? 2 : 0)} ${unit}` }))} /> : null} />
        {refs?.map((r) => <ReferenceLine key={r.label} y={r.y} stroke={r.color} strokeDasharray="4 4" label={{ value: r.label, position: "insideTopRight", fontSize: 11, fill: r.color }} />)}
        {keys.map((k) => (
          <Line key={k.key} dataKey={k.key} name={k.name} stroke={k.color} strokeWidth={2} dot={false} strokeDasharray={k.dash ? "5 4" : undefined} isAnimationActive={false} connectNulls={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, size = 180, center }: { data: { name: string; value: number; color: string }[]; size?: number; center?: ReactNode }) {
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <PieChart width={size} height={size}>
        <Pie data={data} dataKey="value" innerRadius={size / 2 - 22} outerRadius={size / 2} paddingAngle={1.5} stroke="none" isAnimationActive>
          {data.map((d) => <Cell key={d.name} fill={d.color} />)}
        </Pie>
        <Tooltip content={({ active, payload }) => active && payload?.length ?
          <Box title={payload[0].name} rows={[{ name: "Énergie", color: (payload[0].payload as any).color, value: `${n(payload[0].value as number, 1)} kWh` }]} /> : null} />
      </PieChart>
      {center && <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">{center}</div>}
    </div>
  );
}

export function Spark({ values, color = "var(--color-c1)", height = 36 }: { values: number[]; color?: string; height?: number }) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs><linearGradient id={`sp${color.replace(/\W/g, "")}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity={0.3} /><stop offset="1" stopColor={color} stopOpacity={0} /></linearGradient></defs>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill={`url(#sp${color.replace(/\W/g, "")})`} isAnimationActive={false} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Ring({ value, max = 100, size = 120, stroke = 10, color = "var(--color-good)", children }: { value: number; max?: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, value / max));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-muted)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - f) }} transition={{ duration: 1, ease: "easeOut" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Legend({ items }: { items: { name: string; color: string; dash?: boolean }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((i) => (
        <span key={i.name} className="flex items-center gap-1.5">
          <i className={i.dash ? "w-3.5 border-t-2 border-dashed" : "size-2.5 rounded-sm"} style={i.dash ? { borderColor: i.color } : { background: i.color }} />{i.name}
        </span>
      ))}
    </div>
  );
}
