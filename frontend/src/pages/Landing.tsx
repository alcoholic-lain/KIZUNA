import { ArrowRight, Building2, QrCode, ShieldCheck, Sparkles } from "lucide-react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";
import { Link } from "react-router";
import { Logo } from "@/components/Shell";
import { Button } from "@/components/ui";
import { n } from "@/lib/format";
import { useMe } from "@/lib/session";

function Ticker() {
  const v = useMotionValue(1240);
  const t = useTransform(v, (x) => n(x));
  useEffect(() => {
    const vals = [1240, 1318, 1702, 1655, 912, 948, 1086, 1240];
    let i = 0;
    const id = setInterval(() => { i = (i + 1) % vals.length; animate(v, vals[i], { duration: 0.9 }); }, 1800);
    return () => clearInterval(id);
  }, [v]);
  return <motion.span className="tabular">{t}</motion.span>;
}

export default function Landing() {
  const { data: me } = useMe();
  const signedIn = !!me?.authenticated;
  const features = [
    { icon: QrCode, title: "Un QR, un appareil", text: "L'adaptateur se branche, se scanne et mesure." },
    { icon: Sparkles, title: "IA explicable", text: "Chaque anomalie avec sa preuve et sa solution." },
    { icon: Building2, title: "Vue STEG", text: "Du compteur collectif à l'appareil, anonymement." },
    { icon: ShieldCheck, title: "Jamais de coupure", text: "Des récompenses, jamais de sanctions." },
  ];
  return (
    <div className="min-h-screen overflow-x-hidden bg-[oklch(0.15_0.01_270)] text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <div className="flex items-center gap-2">
          {signedIn
            ? <Button asChild variant="ghost" className="text-white hover:bg-white/10"><Link to="/app">Ouvrir l'application</Link></Button>
            : <Button asChild variant="ghost" className="text-white hover:bg-white/10"><Link to="/login">Connexion</Link></Button>}
          <Button asChild variant="brand"><Link to="/login?demo=1">Démo<ArrowRight /></Link></Button>
        </div>
      </header>
      <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-2 lg:pt-20">
        <div className="pointer-events-none absolute -left-40 top-0 size-[600px] rounded-full bg-[radial-gradient(circle,oklch(0.55_0.21_25/.25),transparent_60%)]" />
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">見える化 · KIZUNA 2026</p>
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-tighter sm:text-6xl">Voyez où part chaque kilowattheure.</h1>
          <p className="mt-6 max-w-md text-lg text-white/60">Mesure par appareil, IA qui explique, économies récompensées.</p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg" variant="brand"><Link to="/login?demo=1">Lancer la démo<ArrowRight /></Link></Button>
            <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10"><Link to={signedIn ? "/app" : "/login"}>{signedIn ? "Ouvrir l'application" : "Se connecter"}</Link></Button>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1 }}
          className="relative mx-auto w-full max-w-sm rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between text-sm text-white/60"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-good animate-pulse-ring" />En ce moment</span><span>Salon</span></div>
          <div className="mt-2 text-6xl font-semibold tracking-tighter"><Ticker /><span className="ml-2 text-2xl text-white/40">W</span></div>
          <div className="mt-6 grid gap-3">
            {[["Climatiseur", 68, "var(--color-c1)"], ["Réfrigérateur", 10, "var(--color-c3)"], ["TV + décodeur", 8, "var(--color-c4)"]].map(([l, w, c]: any) => (
              <div key={l}><div className="mb-1 flex justify-between text-xs text-white/60"><span>{l}</span></div><div className="h-1.5 rounded-full bg-white/10"><motion.div className="h-full rounded-full" style={{ background: c }} initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 1.2, delay: 0.4 }} /></div></div>
            ))}
          </div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }} className="mt-6 rounded-2xl bg-bad/15 p-4 text-sm">
            <b className="text-[oklch(0.75_0.15_25)]">Climatiseur +72 %</b><p className="mt-1 text-white/60">Consigne trop basse. Réglez à 20 °C.</p>
          </motion.div>
        </motion.div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f, i) => (
          <motion.div key={f.title} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <f.icon className="size-5 text-white/70" /><h3 className="mt-4 font-medium">{f.title}</h3><p className="mt-1 text-sm text-white/50">{f.text}</p>
          </motion.div>
        ))}
      </section>
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-8">
          <div className="grid gap-3">
            <p className="max-w-md text-xs text-white/50">Projet réalisé lors du hackathon KIZUNA 2026. Logos de l'événement et de ses partenaires ; leur présence n'implique ni partenariat ni soutien de Mieruka.</p>
            <div className="flex flex-wrap items-center gap-8 opacity-60">
              <img src="/static/kizuna/logo.svg" alt="KIZUNA 2026" className="h-7 brightness-0 invert" />
              <img src="/static/kizuna/partners/esprit-dark.png" alt="Esprit" className="h-7" />
              <img src="/static/kizuna/partners/jica-dark.svg" alt="JICA" className="h-7" />
              <img src="/static/kizuna/partners/association-tunisie-japon-dark.png" alt="Association Tunisie-Japon" className="h-7" />
            </div>
          </div>
          <p className="text-xs text-white/40">Zero-Ichi · données de démonstration simulées</p>
        </div>
      </footer>
    </div>
  );
}
