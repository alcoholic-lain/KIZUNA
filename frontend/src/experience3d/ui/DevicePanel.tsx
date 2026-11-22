import { ArrowUpRight } from "lucide-react";
import { catOf } from "@/lib/categories";
import { kwh } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "../data/fromLive";
import type { SceneDevice } from "../data/types";
import { catalogEntry } from "../models/catalog";
import { powerText, STATUS_DOT } from "./display";

/** Two-dimensional building blocks shared by the 3D view and its 2D fallback. */

const energyText = (v: number | null) => (v === null ? "–" : kwh(v));

export function SourceTag({ source }: { source: SceneDevice["source"] }) {
  const text = source === "simulee" ? "Simulé" : source === "reelle" ? "Capteur réel" : "Source inconnue";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",
      source === "reelle" ? "bg-good/20 text-[oklch(0.82_0.12_155)]" : "bg-white/10 text-white/70")}>{text}</span>
  );
}

export function DeviceIcon({ category, size = "md" }: { category: string; size?: "sm" | "md" }) {
  const C = catOf(category);
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-xl", size === "md" ? "size-10" : "size-8")}
      style={{ background: `color-mix(in oklch, ${C.color} 22%, transparent)`, color: C.color }}>
      <C.icon className={size === "md" ? "size-5" : "size-4"} />
    </span>
  );
}

export function DevicePanel({ device, onOpen, className }: { device: SceneDevice; onOpen: (id: number) => void; className?: string }) {
  const spec = catalogEntry(device.category);
  return (
    <div className={cn("rounded-2xl bg-[oklch(0.23_0.01_270)] p-4 ring-1 ring-white/10", className)} aria-live="polite">
      <div className="flex items-start gap-3">
        <DeviceIcon category={device.category} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{device.name}</div>
          <div className="truncate text-xs text-white/55">{device.room || "Pièce non précisée"} · {device.adapterId}</div>
        </div>
        <SourceTag source={device.source} />
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <span className="text-3xl font-semibold tracking-tight tabular">{powerText(device)}</span>
        <span className="flex items-center gap-1.5 text-xs text-white/70">
          <span className={cn("size-2 rounded-full", STATUS_DOT[device.status])} />{STATUS_LABEL[device.status]}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-white/5 px-3 py-2"><dt className="text-white/50">Aujourd'hui</dt><dd className="font-semibold tabular">{energyText(device.todayKwh)}</dd></div>
        <div className="rounded-xl bg-white/5 px-3 py-2"><dt className="text-white/50">Ce mois</dt><dd className="font-semibold tabular">{energyText(device.monthKwh)}</dd></div>
      </dl>
      <p className="mt-3 text-[11px] leading-relaxed text-white/50">
        {spec.modelled
          ? <>Modèle 3D générique : {spec.modelLabel}{spec.dims ? ` (${spec.dims})` : ""}. Ce n'est pas le modèle exact de votre appareil.</>
          : <>Pas encore de modèle 3D pour ce type d'appareil. Les mesures de l'adaptateur restent affichées.</>}
      </p>
      <button onClick={() => onOpen(device.id)}
        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-white text-[13px] font-medium text-[oklch(0.19_0.01_270)] transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/60 cursor-pointer">
        Détails et historique<ArrowUpRight className="size-4" />
      </button>
    </div>
  );
}

/** 2D fallback: same information, no WebGL, no motion. */
export function DeviceGrid({ devices, onOpen }: { devices: SceneDevice[]; onOpen: (id: number) => void }) {
  const max = Math.max(50, ...devices.map((d) => d.powerW ?? 0));
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {devices.map((d) => (
        <li key={d.id}>
          <button onClick={() => onOpen(d.id)}
            className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 rounded-2xl bg-white/5 p-3 text-left ring-1 ring-white/5 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/60 cursor-pointer">
            <DeviceIcon category={d.category} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{d.name}</span>
              <span className="flex items-center gap-1.5 text-[11px] text-white/55">
                <span className={cn("size-1.5 rounded-full", STATUS_DOT[d.status])} />{STATUS_LABEL[d.status]}
              </span>
            </span>
            <span className="text-sm font-semibold tabular">{powerText(d)}</span>
            <span className="col-span-3 h-1 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full rounded-full" style={{ width: `${Math.max(1, ((d.powerW ?? 0) / max) * 100)}%`, background: catOf(d.category).color }} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
