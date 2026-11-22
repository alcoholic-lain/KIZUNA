import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Play, RotateCcw, SkipForward, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { api, useApi } from "@/lib/api";
import { useMe, useSwitch } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Button } from "./ui";

type State = { open: boolean; step: number };
type Step = {
  t: string;
  /** One line telling the presenter what happens or what to click next. */
  hint: string;
  run: () => unknown;
  done?: () => boolean;
  /** The step only makes sense for this demo account; switch to it first. */
  role?: string;
  manual?: boolean;
  wait?: boolean;
};
const KEY = "mieruka-demo";
const load = (): State => { try { return JSON.parse(localStorage.getItem(KEY) || "") || { open: false, step: 0 }; } catch { return { open: false, step: 0 }; } };
const store = (s: State) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } };

export function openDemo() {
  store({ open: true, step: 0 });
  window.dispatchEvent(new Event("demo"));
}

export function DemoGuide() {
  const [st, setSt] = useState<State>(load);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const nav = useNavigate();
  const qc = useQueryClient();
  const switchTo = useSwitch();
  const { data: me } = useMe();
  const { data: live } = useApi<any>("live", { refetch: 2500 });
  const save = (s: State) => { setSt(s); store(s); };
  useEffect(() => { const f = () => setSt(load()); window.addEventListener("demo", f); return () => window.removeEventListener("demo", f); }, []);

  const role = me?.user?.role;
  const acAlert = () => live?.alerts?.find((a: any) => ["surconsommation", "pic"].includes(a.kind) && ["climatisation", "radiateur"].includes(a.category));
  const steps: Step[] = [
    { t: "Ouvrir le foyer d'Amira", hint: "Connexion au compte de démonstration du foyer d'Amira (Tunis).",
      run: () => switchTo("foyer", "/app/accueil"), done: () => role === "foyer" },
    { t: "Scanner l'adaptateur NABD-0003", hint: "La fenêtre d'association s'ouvre pré-remplie : cliquez sur « Associer ». Elle se ferme seule et le guide passe à l'étape suivante.", role: "foyer",
      run: () => nav("/app/appareils?scan=NABD-0003"), done: () => live?.devices?.some((d: any) => d.adapter === "NABD-0003") },
    { t: "Déclencher une panne : clim +70 %", hint: "Scénario simulé : le climatiseur consomme 70 % de plus que d'habitude.", role: "foyer",
      run: async () => { await api("sim", { method: "POST", body: { action: "scenario", code: "clim" } }); nav("/app/accueil"); },
      done: () => live?.devices?.some((d: any) => d.category === "climatisation" && d.power > 1300) || !!acAlert() },
    { t: "L'IA détecte l'anomalie", hint: "Alerte après 3 mesures consécutives au-dessus du seuil (environ 15 s).", role: "foyer",
      run: () => nav("/app/accueil"), done: () => !!acAlert(), wait: true },
    { t: "Voir la preuve et corriger", hint: "La fiche montre mesures, seuil et cause : cliquez sur « Appliquer la correction ».", role: "foyer",
      run: () => { const a = acAlert(); if (!a) throw new Error("Pas encore d'alerte : patientez quelques secondes"); nav(`/app/analyse?alerte=${a.id}`); },
      done: () => live?.devices?.some((d: any) => d.category === "climatisation" && d.fixed) },
    { t: "Voir économies et jetons", hint: "Les kWh évités sont convertis en jetons et en score éco.", role: "foyer",
      run: () => nav("/app/recompenses"), manual: true },
    { t: "Vue STEG de l'immeuble", hint: "Compteur collectif = adaptateurs + part non suivie. Foyers pseudonymisés.",
      run: () => switchTo("steg", "/app/steg/batiments/BAT-TUN-01"), done: () => role === "steg" },
    { t: "Comparer Tunisie et Japon", hint: "Moyennes nationales sourcées, avec la projection simulée du foyer.",
      run: () => nav("/app/comparer"), manual: true },
  ];
  const cur = steps[st.step];
  const waiting = !!(cur?.wait && !cur.done?.());

  useEffect(() => {
    if (st.open && cur && !cur.manual && cur.done?.()) save({ ...st, step: st.step + 1 });
  }, [live, role, st.step, st.open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run() {
    setBusy(true);
    try {
      if (cur.role && role !== cur.role) await switchTo(cur.role);
      await cur.run();
      qc.invalidateQueries();
      if (cur.manual) save({ ...st, step: st.step + 1 });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }
  async function reset() {
    setConfirmReset(false);
    setResetting(true);
    try {
      await api("sim", { method: "POST", body: { action: "reset" } });
      await switchTo("foyer", "/app/accueil");
      // Load post-reset data before rewinding: otherwise the cached pre-reset feed (NABD-0003 still
      // paired from the previous run) makes the guide auto-skip the pairing step.
      await qc.fetchQuery({ queryKey: ["live"], queryFn: () => api("live"), staleTime: 0 });
      save({ open: true, step: 0 });
      toast.success("Démo réinitialisée");
    } catch (e: any) { toast.error(e.message); } finally { setResetting(false); }
  }

  return (
    <>
      {!st.open && (
        <button onClick={() => save({ ...st, open: true })} className="fixed bottom-20 right-4 z-30 flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-brand/30 transition hover:scale-105 lg:bottom-6 lg:right-6">
          <Play className="size-4" />{st.step > 0 && st.step < steps.length ? `Démo · étape ${st.step + 1}/${steps.length}` : "Démo guidée"}
        </button>
      )}
      <AnimatePresence>
        {st.open && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }}
            role="dialog" aria-label="Démo guidée"
            className="fixed inset-x-3 bottom-20 z-40 rounded-2xl border border-line bg-card/95 p-4 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:w-80 lg:bottom-6">
            <div className="mb-3 flex items-center justify-between">
              <b className="text-sm">Démo guidée <span className="font-normal text-ink-3">· {Math.min(st.step + 1, steps.length)}/{steps.length}</span></b>
              <div className="flex items-center gap-1">
                <button onClick={() => setConfirmReset(true)} disabled={resetting} title="Réinitialiser la démo" aria-label="Réinitialiser la démo" className="rounded-lg p-1.5 text-ink-3 hover:bg-muted hover:text-ink">{resetting ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}</button>
                <button onClick={() => { setConfirmReset(false); save({ ...st, open: false }); }} title="Réduire (la progression est conservée)" aria-label="Fermer la démo guidée" className="rounded-lg p-1.5 text-ink-3 hover:bg-muted hover:text-ink"><X className="size-4" /></button>
              </div>
            </div>
            {confirmReset && (
              <div className="mb-3 grid gap-2 rounded-xl bg-warn/15 p-3 text-[13px]">
                <span>Réinitialiser toutes les données de démonstration et revenir à l'étape 1 ?</span>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>Annuler</Button>
                  <Button size="sm" onClick={reset}>Réinitialiser</Button>
                </div>
              </div>
            )}
            <div className="mb-3 flex gap-1">{steps.map((_, i) => <i key={i} className={cn("h-1 flex-1 rounded-full", i < st.step ? "bg-good" : i === st.step ? "bg-brand" : "bg-muted")} />)}</div>
            <ol className="grid gap-1">
              {steps.map((s, i) => (
                <li key={i} aria-current={i === st.step ? "step" : undefined} className={cn("rounded-lg px-2 py-1.5 text-[13px]", i === st.step ? "bg-muted font-medium" : i < st.step ? "text-ink-3" : "text-ink-3/70")}>
                  <span className="flex items-center gap-2.5">
                    <span className={cn("grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold", i < st.step ? "bg-good text-white" : i === st.step ? "bg-brand text-white" : "bg-muted")}>{i < st.step ? <Check className="size-3" /> : i + 1}</span>
                    {s.t}
                  </span>
                  {i === st.step && <span className="mt-1 block pl-7.5 text-xs font-normal text-ink-2">{s.hint}</span>}
                </li>
              ))}
            </ol>
            {cur ? (
              <div className="mt-3 grid gap-1.5">
                <Button className="w-full" variant="brand" disabled={busy || resetting || waiting} onClick={run}>
                  {waiting ? <><Loader2 className="animate-spin" />Analyse en cours…</> : busy ? <><Loader2 className="animate-spin" />En cours…</> : <><Play />Lancer l'étape</>}
                </Button>
                <button onClick={() => save({ ...st, step: st.step + 1 })} disabled={busy} className="flex items-center justify-center gap-1 text-xs text-ink-3 hover:text-ink disabled:opacity-50">
                  <SkipForward className="size-3" />Passer cette étape
                </button>
              </div>
            ) : (
              <div className="mt-3 grid gap-2">
                <p className="rounded-xl bg-good/10 p-3 text-center text-sm font-medium text-good">Parcours terminé</p>
                <Button variant="outline" disabled={resetting} onClick={() => setConfirmReset(true)}><RotateCcw />Recommencer la démo</Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
