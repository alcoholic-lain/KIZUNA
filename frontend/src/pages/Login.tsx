import { ArrowRight, Building2, Factory, GraduationCap, Home, Loader2, Play, Users } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { openDemo } from "@/components/DemoGuide";
import { Logo } from "@/components/Shell";
import { Button, Field, Input, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { homeFor, useMe, useSwitch, type Me } from "@/lib/session";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

const ICON: Record<string, any> = { foyer: Home, etudiant: GraduationCap, famille: Users, entreprise: Factory, steg: Building2 };
const ROLE: Record<string, string> = { foyer: "Foyer · Tunis", etudiant: "Étudiant · Sousse", famille: "Famille · Sfax", entreprise: "Entreprise", steg: "Opérateur STEG" };

/** The Google button only works when the server has OAuth credentials; its start page answers 503 otherwise. */
function useGoogleAvailable() {
  const { data } = useQuery({
    queryKey: ["google-login"],
    queryFn: () => fetch("/mekeru/google/", { credentials: "same-origin" }).then((r) => r.ok).catch(() => false),
    staleTime: Infinity,
  });
  return data === true;
}

function GoogleButton() {
  if (!useGoogleAvailable()) return null;
  return <a href="/mekeru/google/?next=/app/" className="flex items-center justify-center gap-2 rounded-xl border border-line bg-card px-4 py-3 text-sm font-medium transition hover:border-ink/30 hover:shadow-sm">Continuer avec Google</a>;
}

export default function Login() {
  const { data: me, error: meError, refetch, isFetching } = useMe();
  const switchTo = useSwitch();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const guided = params.has("demo");
  const [mode, setMode] = useState<"demo" | "login" | "register">("demo");
  const [f, setF] = useState({ name: "", email: "", password: "", role: "foyer" });
  const [err, setErr] = useState<any>({});
  const [picking, setPicking] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const pick = async (role: string) => {
    setPicking(role);
    try {
      if (guided) openDemo();
      await switchTo(role);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setPicking(null); }
  };
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr({});
    setSending(true);
    try {
      const r = await api<Me>(mode === "login" ? "auth/login" : "auth/register", { method: "POST", body: f });
      qc.clear(); qc.setQueryData(["auth/me"], r); nav(homeFor(r.user?.role));
    } catch (ex: any) { setErr({ ...ex.fields, _: ex.message }); } finally { setSending(false); }
  }
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-[oklch(0.17_0.01_270)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <Link to="/"><Logo /></Link>
        <div className="pointer-events-none absolute -bottom-32 -left-20 size-[520px] rounded-full bg-[radial-gradient(circle,oklch(0.55_0.21_25/.35),transparent_60%)]" />
        <h2 className="relative max-w-md text-4xl font-semibold leading-tight tracking-tight">Chaque kilowattheure, visible.</h2>
        <p className="relative text-sm text-white/50">KIZUNA 2026 · Zero-Ichi</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <Link to="/" className="mb-8 block w-fit lg:hidden"><Logo /></Link>
          <h1 className="text-2xl font-semibold tracking-tight">{mode === "register" ? "Créer un compte" : "Connexion"}</h1>
          {mode === "demo" ? (
            <>
              <p className="mb-4 mt-1 text-sm text-ink-3">Choisissez un compte de démonstration. Les données sont simulées.</p>
              {guided && (
                <p className="mb-4 flex items-start gap-2 rounded-xl bg-brand/10 p-3 text-[13px] text-ink-2">
                  <Play className="mt-0.5 size-4 shrink-0 text-brand" />La démo guidée s'ouvrira après votre choix. Pour suivre le parcours complet, commencez par le foyer d'Amira.
                </p>
              )}
              <div className="grid gap-2">
                {meError && !me ? (
                  <div className="grid gap-2 rounded-xl bg-bad/10 p-3 text-sm text-bad">
                    <span>Impossible de charger les comptes : {(meError as Error).message}.</span>
                    <Button size="sm" variant="outline" className="justify-self-start" disabled={isFetching} onClick={() => refetch()}>Réessayer</Button>
                  </div>
                ) : !me ? (
                  [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)
                ) : me.demo.map((d) => { const I = ICON[d.role] || Home; return (
                  <button key={d.role} disabled={!!picking} onClick={() => pick(d.role)} className="group flex items-center gap-3 rounded-xl border border-line bg-card p-3 text-left transition hover:border-ink/30 hover:shadow-sm disabled:cursor-wait disabled:opacity-60">
                    <span className="grid size-10 place-items-center rounded-xl bg-muted"><I className="size-5" /></span>
                    <span className="flex-1"><b className="block text-sm font-medium">{d.name}</b><span className="text-xs text-ink-3">{ROLE[d.role]}</span></span>
                    {picking === d.role ? <Loader2 className="size-4 animate-spin text-ink-3" /> : <ArrowRight className="size-4 text-ink-3 transition group-hover:translate-x-0.5" />}
                  </button>); })}
              </div>
              <div className="mt-4"><GoogleButton /></div>
              <div className="mt-6 flex justify-between text-sm"><button className="text-ink-2 hover:text-ink" onClick={() => setMode("login")}>Avec un e-mail</button><button className="text-ink-2 hover:text-ink" onClick={() => setMode("register")}>Créer un compte</button></div>
            </>
          ) : (
            <form onSubmit={submit} className="mt-6 grid gap-4">
              {mode === "register" && <Field label="Nom" error={err.name}><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>}
              <Field label="E-mail" error={err.email}><Input type="email" required autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
              <Field label="Mot de passe" error={err.password}><Input type="password" required minLength={mode === "register" ? 8 : undefined} autoComplete={mode === "register" ? "new-password" : "current-password"} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
              {mode === "register" && (
                <div className="flex flex-wrap gap-2">{["foyer", "famille", "etudiant", "entreprise"].map((r) => (
                  <button type="button" key={r} onClick={() => setF({ ...f, role: r })} className={`rounded-full border px-3 py-1 text-xs ${f.role === r ? "border-ink bg-ink text-bg" : "border-line"}`}>{ROLE[r].split(" ·")[0]}</button>))}</div>
              )}
              {err._ && <p className="text-sm text-bad">{err._}</p>}
              <GoogleButton />
              <Button type="submit" size="lg" disabled={sending}>{sending && <Loader2 className="animate-spin" />}{mode === "login" ? "Se connecter" : "Créer le compte"}</Button>
              <button type="button" className="text-sm text-ink-2 hover:text-ink" onClick={() => { setMode("demo"); setErr({}); }}>← Comptes de démonstration</button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
