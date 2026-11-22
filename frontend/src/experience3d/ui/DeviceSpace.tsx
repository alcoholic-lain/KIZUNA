import { Box, ChevronDown, List, ScanEye } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { watts } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fromLiveDevices, SOURCE_LABEL, sourceSummary } from "../data/fromLive";
import { DeviceGrid, DeviceIcon, DevicePanel } from "./DevicePanel";
import { powerText, STATUS_DOT } from "./display";
import { hasWebGL, useActive, useMediaQuery, useReducedMotion, useStoredState } from "./hooks";
import { SceneBoundary } from "./SceneBoundary";

/** three.js, R3F and drei live only in this lazy chunk. */
const DeviceScene = lazy(() => import("../scene/DeviceScene"));

type Mode = "3d" | "2d";

/**
 * Dashboard section showing the household's real installations as generic 3D
 * appliance models. Reads the same `/api/live` payload as the rest of Home and
 * adds no request. Collapsible; a 2D list replaces it when WebGL is missing,
 * when the viewer prefers reduced motion, or on request.
 */
export function DeviceSpace({ rawDevices, totalPowerW, categoryLabels, onOpenDevice }: {
  rawDevices: unknown;
  totalPowerW: number | null;
  categoryLabels: Record<string, string>;
  onOpenDevice: (id: number) => void;
}) {
  const devices = useMemo(() => fromLiveDevices(rawDevices), [rawDevices]);
  const reduced = useReducedMotion();
  const webgl = useMemo(hasWebGL, []);
  const [collapsed, setCollapsed] = useStoredState<"0" | "1">("mieruka.exp3d.collapsed", "0", ["0", "1"]);
  const [stored, setMode] = useStoredState<Mode | "auto">("mieruka.exp3d.mode", "auto", ["3d", "2d", "auto"]);
  const mode: Mode = !webgl ? "2d" : stored === "auto" ? (reduced ? "2d" : "3d") : stored;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [lost, setLost] = useState(0);
  const [lostNotice, setLostNotice] = useState(false);
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const active = useActive(stage);
  const wide = useMediaQuery("(min-width: 1024px)");
  const [pannable, setPannable] = useState(false);

  const selected = devices.find((d) => d.id === selectedId) ?? null;
  useEffect(() => { if (selectedId !== null && !selected) setSelectedId(null); }, [selectedId, selected]);

  const source = sourceSummary(devices);
  const open = collapsed === "0";
  const sceneLabel = `Vue 3D de ${devices.length} appareils : ${devices.map((d) => `${d.name}, ${powerText(d)}`).join(" ; ")}`;

  return (
    <section aria-labelledby="exp3d-title" className="overflow-hidden rounded-3xl bg-[oklch(0.19_0.01_270)] text-white shadow-xl">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 id="exp3d-title" className="text-[15px] font-semibold">Your devices in 3D</h2>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/70">Experimental</span>
          </div>
          <p className="mt-0.5 text-xs text-white/55">
            {devices.length} appareil{devices.length > 1 ? "s" : ""}
            {totalPowerW !== null && <> · <span className="tabular">{watts(totalPowerW)}</span> right now</>}
            {devices.length > 0 && <> · {SOURCE_LABEL[source]}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {open && devices.length > 0 && (
            <div className="inline-flex rounded-xl bg-white/10 p-1" role="group" aria-label="Type de vue">
              {([["3d", Box, "3D"], ["2d", List, "Liste"]] as const).map(([k, Icon, l]) => (
                <button key={k} aria-pressed={mode === k} disabled={k === "3d" && !webgl} onClick={() => setMode(k)}
                  className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px] font-medium transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40",
                    mode === k ? "bg-white text-[oklch(0.19_0.01_270)]" : "text-white/70 hover:text-white")}>
                  <Icon className="size-3.5" />{l}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setCollapsed(open ? "1" : "0")} aria-expanded={open} aria-controls="exp3d-body"
            className="inline-flex size-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white cursor-pointer"
            aria-label={open ? "Hide 3D view" : "Show 3D view"}>
            <ChevronDown className={cn("size-4 transition", open && "rotate-180")} />
          </button>
        </div>
      </header>

      {open && (
        <div id="exp3d-body" className="pb-5">
          {devices.length === 0 ? (
            <div className="mx-5 mt-4 rounded-2xl bg-white/5 p-6 text-center text-sm text-white/70 sm:mx-6">
              No adapter linked yet.{" "}
              <Link to="/app/appareils?ajouter=1" className="font-medium text-white underline underline-offset-4">Add an adapter</Link>
            </div>
          ) : mode === "3d" ? (
            <>
              <div ref={setStage} className="relative mt-4 h-85 sm:h-105 lg:h-120">
                <SceneBoundary key={lost} fallback={(retry) => (
                  <div className="grid h-full place-items-center p-6 text-center text-sm text-white/70">
                    <div className="grid justify-items-center gap-3">
                      The 3D view could not start on this device.
                      <div className="flex gap-2">
                        <button onClick={retry} className="rounded-xl bg-white/10 px-3 py-1.5 text-[13px] hover:bg-white/15 cursor-pointer">Retry</button>
                        <button onClick={() => setMode("2d")} className="rounded-xl bg-white px-3 py-1.5 text-[13px] text-[oklch(0.19_0.01_270)] cursor-pointer">Vue liste</button>
                      </div>
                    </div>
                  </div>
                )}>
                  <Suspense fallback={<div className="grid h-full place-items-center text-sm text-white/55">Loading 3D view…</div>}>
                    <DeviceScene devices={devices} selectedId={selectedId} onSelect={setSelectedId} reducedMotion={reduced}
                      active={active} categoryLabels={categoryLabels} label={sceneLabel}
                      insetLeft={wide ? 372 : 0} onPannable={setPannable}
                      onContextLost={() => { setLostNotice(true); setLost((n) => n + 1); }} />
                  </Suspense>
                </SceneBoundary>
                {lostNotice && (
                  <p className="absolute left-4 top-3 rounded-lg bg-black/60 px-2.5 py-1 text-[11px] text-white/80">The 3D view was restarted after a graphics interruption.</p>
                )}
                {pannable && !selected && (
                  <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] text-white/55">
                    Swipe horizontally to browse the room, or tap a device
                  </p>
                )}
                {selected && (
                  <button onClick={() => setSelectedId(null)}
                    className="absolute right-4 top-3 inline-flex items-center gap-1.5 rounded-xl bg-black/50 px-3 py-1.5 text-[13px] text-white/85 ring-1 ring-white/10 hover:bg-black/70 cursor-pointer">
                    <ScanEye className="size-4" />Vue d'ensemble
                  </button>
                )}
                {selected && <DevicePanel device={selected} onOpen={onOpenDevice} className="absolute bottom-4 left-4 hidden w-85 lg:block" />}
              </div>

              <div className="flex gap-2 overflow-x-auto px-5 pt-3 sm:px-6 scrollbar-thin" role="group" aria-label="Choose a device">
                {devices.map((d) => (
                  <button key={d.id} aria-pressed={d.id === selectedId} onClick={() => setSelectedId(d.id === selectedId ? null : d.id)}
                    className={cn("flex shrink-0 items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-3 text-left text-xs ring-1 transition cursor-pointer",
                      d.id === selectedId ? "bg-white/15 ring-white/40" : "bg-white/5 ring-white/5 hover:bg-white/10")}>
                    <DeviceIcon category={d.category} size="sm" />
                    <span>
                      <span className="block max-w-36 truncate font-medium">{d.name}</span>
                      <span className="flex items-center gap-1 text-white/60"><span className={cn("size-1.5 rounded-full", STATUS_DOT[d.status])} /><b className="font-semibold tabular text-white/85">{powerText(d)}</b></span>
                    </span>
                  </button>
                ))}
              </div>
              {selected && <div className="px-5 pt-3 sm:px-6 lg:hidden"><DevicePanel device={selected} onOpen={onOpenDevice} /></div>}
            </>
          ) : (
            <div className="mt-4 px-5 sm:px-6">
              {(!webgl || (reduced && stored === "auto")) && (
                <p className="mb-3 text-xs text-white/55">
                  {!webgl ? "The 3D view is not available on this device (WebGL unavailable). Showing the list view."
                    : <>Reduced motion is on: list view by default. <button onClick={() => setMode("3d")} className="font-medium text-white underline underline-offset-4 cursor-pointer">Show in 3D, without animation</button></>}
                </p>
              )}
              <DeviceGrid devices={devices} onOpen={onOpenDevice} />
            </div>
          )}
          {devices.length > 0 && (
            <p className="px-5 pt-4 text-[11px] leading-relaxed text-white/45 sm:px-6">
              Generic 3D models by device type: they do not represent the brand or exact model of your devices.
              Each NABD adapter screen shows the measured power; the light on the cables follows that power.
              {source !== "reelle" && " Simulated values are labelled as such."}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
