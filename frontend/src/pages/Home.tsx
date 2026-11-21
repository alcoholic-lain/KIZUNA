import { ArrowUpRight, Leaf, Plus, Receipt, Sparkles, Zap } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router";
import { AlertPanel, AlertRow } from "@/components/AlertPanel";
import { Bars, LiveArea, Ring } from "@/components/charts";
import { AnimatedNumber, Badge, Button, Card, CardTitle, Delta, InfoTip, LiveDot, Progress, Skeleton } from "@/components/ui";
import { useApi } from "@/lib/api";
import { catOf } from "@/lib/categories";
import { change, kwh, n, timeS, tnd, watts } from "@/lib/format";
import { useMe } from "@/lib/session";

export default function Home() {
  const { data: me } = useMe();
  const { data: live } = useApi<any>("live", { refetch: 2500 });
  const { data: home } = useApi<any>("home", { refetch: 30000 });
  const [alert, setAlert] = useState<any>(null);
  if (!live?.devices || !home) return <div className="grid gap-4"><Skeleton className="h-64" /><Skeleton className="h-40" /></div>;
  const f = home.forecast;
  const series = live.series.map((s: any) => ({ t: timeS(s[0]), v: s[1] }));
  const running = live.devices.filter((d: any) => d.on).sort((a: any, b: any) => b.power - a.power);
  const max = Math.max(50, ...live.devices.map((d: any) => d.power || 0));
  const goalRatio = f.mtd_kwh / f.goal_kwh;
  const tone = f.ratio >= 1.05 ? "var(--color-bad)" : f.ratio >= 0.95 ? "var(--color-warn)" : "var(--color-good)";
  const first = me?.user?.name.split(" ")[0];
  const sc = home.score;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-3">{home.household.label} · {home.household.building}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Bonjour {first}</h1>
        </div>
        <Button asChild variant="outline"><Link to="/app/appareils?ajouter=1"><Plus />Adaptateur</Link></Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} id="live-card"
          className="relative overflow-hidden rounded-3xl bg-[oklch(0.19_0.01_270)] p-6 text-white shadow-xl lg:col-span-2">
          <div className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full bg-[radial-gradient(circle,oklch(0.8_0.16_80/.35),transparent_65%)]" />
          <div className="relative flex items-start justify-between">
            <span className="flex items-center gap-2 text-sm text-white/70"><LiveDot />En ce moment</span>
            <div className="text-right text-sm">
              <div className="text-white/60">Aujourd'hui</div>
              <div className="font-semibold tabular">{kwh(live.today_kwh)} <span className="text-white/50">· {tnd(live.today_kwh * home.bill.avg_price)}</span></div>
            </div>
          </div>
          <div className="relative mt-1 flex items-baseline gap-2">
            <AnimatedNumber value={live.power} className="text-6xl font-semibold tracking-tighter sm:text-7xl" />
            <span className="text-2xl text-white/50">W</span>
          </div>
          <div className="relative -mx-2 mt-2"><LiveArea data={series} height={110} dark /></div>
          <div className="relative mt-3 flex flex-wrap gap-2">
            {running.slice(0, 4).map((d: any) => {
              const C = catOf(d.category);
              return (
                <span key={d.id} className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs">
                  <C.icon className="size-3.5" style={{ color: C.color }} />{d.name}<b className="tabular">{watts(d.power)}</b>
                </span>
              );
            })}
          </div>
        </motion.section>

        <Card className="flex flex-col">
          <CardTitle right={<Badge tone={f.ratio >= 1.05 ? "bad" : f.ratio >= 0.95 ? "warn" : "good"}>{f.ratio >= 1.05 ? "Dépassement probable" : f.ratio >= 0.95 ? "À surveiller" : "En bonne voie"}</Badge>}>Ce mois</CardTitle>
          <div className="text-3xl font-semibold tracking-tight tabular">{n(f.mtd_kwh)}<span className="ml-1 text-base font-medium text-ink-3">/ {n(f.goal_kwh)} kWh</span></div>
          <Progress className="mt-3" value={goalRatio} color={tone} marker={f.ratio} />
          <p className="mt-2 text-xs text-ink-3">Prévision fin de mois : <b className="text-ink-2">{n(f.month_kwh)} kWh</b></p>
          <div className="mt-auto pt-5">
            <div className="flex items-center gap-1.5 text-[13px] text-ink-2"><Receipt className="size-4" />Facture STEG estimée
              <InfoTip content={<>Barème STEG résidentiel en vigueur depuis le 01/05/2022, tranche {n(home.bill.band_price * 1000)} millimes/kWh. {n(home.bill.kwh)} kWh au compteur (appareils suivis + {n(home.other_kwh_month)} kWh d'autres usages estimés), redevance {home.household.kva} kVA, TVA et taxes incluses.</>} /></div>
            <div className="mt-1 text-3xl font-semibold tracking-tight tabular">{n(home.bill.total, 2)}<span className="ml-1 text-base font-medium text-ink-3">DT</span></div>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Link to="/app/recompenses" className="group">
          <Card className="h-full transition group-hover:shadow-md">
            <CardTitle right={<ArrowUpRight className="size-4 text-ink-3" />}>Jetons</CardTitle>
            <div className="text-3xl font-semibold tracking-tight"><AnimatedNumber value={live.tokens} /></div>
            <p className="mt-1 text-xs text-ink-3">+{live.tokens_today} aujourd'hui</p>
          </Card>
        </Link>
        <Link to="/app/recompenses" className="group">
          <Card className="flex h-full items-center gap-4 transition group-hover:shadow-md">
            <Ring value={sc.score} size={76} stroke={8} color={sc.score >= 60 ? "var(--color-good)" : "var(--color-warn)"}><b className="text-xl tabular">{sc.score}</b></Ring>
            <div><div className="text-[13px] text-ink-2">Score éco</div><Delta value={sc.score - sc.previous} invert unit="pts" /></div>
          </Card>
        </Link>
        <Card id="savings-card">
          <CardTitle right={<Leaf className="size-4 text-good" />}>Économies vérifiées</CardTitle>
          <div className="text-3xl font-semibold tracking-tight tabular"><AnimatedNumber value={live.savings.kwh} decimals={2} /><span className="ml-1 text-base font-medium text-ink-3">kWh</span></div>
          <p className="mt-1 text-xs text-ink-3">{n(live.savings.co2_kg, 1)} kg CO₂ évités</p>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle right={<Link to="/app/appareils" className="text-xs text-ink-3 hover:text-ink">Tout voir</Link>}>Appareils</CardTitle>
          <div className="grid gap-3" id="devices-list">
            {live.devices.slice().sort((a: any, b: any) => (b.power || 0) - (a.power || 0)).map((d: any) => {
              const C = catOf(d.category);
              return (
                <div key={d.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5">
                  <span className="grid size-8 place-items-center rounded-lg" style={{ background: `color-mix(in oklch, ${C.color} 14%, transparent)`, color: C.color }}><C.icon className="size-4" /></span>
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium"><span className="truncate">{d.name}</span>
                    {d.anomaly && <Badge tone="bad">Anomalie</Badge>}{d.fixed && !d.anomaly && <Badge tone="good">Optimisé</Badge>}</span>
                  <span className="text-sm font-semibold tabular">{d.monitoring ? watts(d.power) : "Pause"}</span>
                  <span />
                  <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <motion.div className="h-full rounded-full" style={{ background: C.color }} animate={{ width: `${Math.max(1, ((d.power || 0) / max) * 100)}%` }} transition={{ duration: 0.6 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card className="lg:col-span-2" id="alerts-card">
          <CardTitle right={<Link to="/app/analyse" className="text-xs text-ink-3 hover:text-ink">Analyse</Link>}>Alertes IA</CardTitle>
          {live.alerts.length ? (
            <div className="grid gap-2">{live.alerts.slice(0, 4).map((a: any) => <AlertRow key={a.id} a={a} onOpen={() => setAlert(a)} />)}</div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-ink-3"><Sparkles className="size-5" />Tout est normal</div>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle right={<span className="text-xs text-ink-3"><Delta value={change(live.today_kwh, home.yesterday_same)} /> vs hier même heure</span>}>Aujourd'hui, heure par heure</CardTitle>
        <Bars height={200} xFormat={(v) => `${v}h`}
          data={home.hourly_today.map((v: number, i: number) => ({ x: i, today: v, yday: home.hourly_yesterday[i] }))}
          keys={[{ key: "yday", name: "Hier", color: "var(--color-line)" }, { key: "today", name: "Aujourd'hui", color: "var(--color-c1)" }]} />
      </Card>
      <AlertPanel alert={alert} onClose={() => setAlert(null)} />
    </div>
  );
}
