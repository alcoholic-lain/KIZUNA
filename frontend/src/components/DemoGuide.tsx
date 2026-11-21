import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Play, RotateCcw, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { api, useApi } from "@/lib/api";
import { useMe, useSwitch } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Button } from "./ui";

type State = { open: boolean; step: number };
const KEY = "mieruka-demo";
const load = (): State => { try { return JSON.parse(localStorage.getItem(KEY) || "") || { open: false, step: 0 }; } catch { return { open: false, step: 0 }; } };

export function openDemo() {
  localStorage.setItem(KEY, JSON.stringify({ open: true, step: 0 }));
  window.dispatchEvent(new Event("demo"));
}

export function DemoGuide() {
  const [st, setSt] = useState<State>(load);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const qc = useQueryClient();
  const switchTo = useSwitch();
  const { data: me } = useMe();
  const { data: live } = useApi<any>("live", { refetch: 2500 });
  const save = (s: State) => { setSt(s); localStorage.setItem(KEY, JSON.stringify(s)); };
  useEffect(() => { const f = () => setSt(load()); window.addEventListener("demo", f); return () => window.removeEventListener("demo", f); }, []);

  const role = me?.user?.role;
  const acAlert = () => live?.alerts?.find((a: any) => ["surconsommation", "pic"].includes(a.kind) && ["climatisation", "radiateur"].includes(a.category));
  const steps = [
    { t: "Ouvrir le foyer d'Amira", run: () => switchTo("foyer", "/app/accueil"), done: () => role === "foyer" },
    { t: "Scanner l'adaptateur NABD-0003", run: () => nav("/app/appareils?scan=NABD-0003"), done: () => live?.devices?.some((d: any) => d.adapter === "NABD-0003") },
    { t: "Déclencher une panne : clim +70 %", run: async () => { await api("sim", { method: "POST", body: { action: "scenario", code: "clim" } }); nav("/app/accueil"); }, done: () => live?.devices?.some((d: any) => d.category === "climatisation" && d.power > 1300) || !!acAlert() },
    { t: "L'IA détecte l'anomalie", run: () => nav("/app/accueil"), done: () => !!acAlert(), wait: true },
    { t: "Appliquer la correction", run: async () => { const a = acAlert(); if (!a) throw new Error("Pas encore d'alerte"); await api(`alerts/${a.id}/apply`, { method: "POST" }); }, done: () => live?.devices?.some((d: any) => d.category === "climatisation" && d.fixed) },
    { t: "Voir économies et jetons", run: () => nav("/app/recompenses"), manual: true },
    { t: "Vue STEG de l'immeuble", run: () => switchTo("steg", "/app/steg/batiments/BAT-TUN-01"), done: () => role === "steg" },
    { t: "Comparer Tunisie et Japon", run: () => nav("/app/comparer"), manual: true },
  ];
  const cur = steps[st.step];

  useEffect(() => {
    if (st.open && cur && !cur.manual && cur.done?.()) save({ ...st, step: st.step + 1 });
  }, [live, role, st.step, st.open]);

  async function run() {
    setBusy(true);
    try {
      await cur.run();
      qc.invalidateQueries();
      if (cur.manual) save({ ...st, step: st.step + 1 });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }
  async function reset() {
    setBusy(true);
    try {
      await api("sim", { method: "POST", body: { action: "reset" } });
      save({ open: true, step: 0 });
      await switchTo("foyer", "/app/accueil");
      toast.success("Démo réinitialisée");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      {!st.open && (
        <button onClick={() => save({ ...st, open: true })} className="fixed bottom-20 right-4 z-30 flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-brand/30 transition hover:scale-105 lg:bottom-6 lg:right-6">
          <Play className="size-4" />Démo
        </button>
      )}
      <AnimatePresence>
        {st.open && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-3 bottom-20 z-40 rounded-2xl border border-line bg-card/95 p-4 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:w-80 lg:bottom-6">
            <div className="mb-3 flex items-center justify-between">
              <b className="text-sm">Démo guidée</b>
              <div className="flex items-center gap-1">
                <button onClick={reset} title="Réinitialiser" className="rounded-lg p-1.5 text-ink-3 hover:bg-muted hover:text-ink">{busy ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}</button>
                <button onClick={() => save({ ...st, open: false })} className="rounded-lg p-1.5 text-ink-3 hover:bg-muted hover:text-ink"><X className="size-4" /></button>
              </div>
            </div>
            <div className="mb-3 flex gap-1">{steps.map((_, i) => <i key={i} className={cn("h-1 flex-1 rounded-full", i < st.step ? "bg-good" : i === st.step ? "bg-brand" : "bg-muted")} />)}</div>
            <ol className="grid gap-1">
              {steps.map((s, i) => (
                <li key={i} className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px]", i === st.step ? "bg-muted font-medium" : i < st.step ? "text-ink-3" : "text-ink-3/70")}>
                  <span className={cn("grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold", i < st.step ? "bg-good text-white" : i === st.step ? "bg-brand text-white" : "bg-muted")}>{i < st.step ? <Check className="size-3" /> : i + 1}</span>
                  {s.t}
                </li>
              ))}
            </ol>
            {cur ? (
              <Button className="mt-3 w-full" variant="brand" disabled={busy || (cur.wait && !cur.done?.())} onClick={run}>
                {cur.wait && !cur.done?.() ? <><Loader2 className="animate-spin" />Analyse en cours…</> : busy ? <Loader2 className="animate-spin" /> : <><Play />Lancer</>}
              </Button>
            ) : (
              <p className="mt-3 rounded-xl bg-good/10 p-3 text-center text-sm font-medium text-good">Parcours terminé</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
