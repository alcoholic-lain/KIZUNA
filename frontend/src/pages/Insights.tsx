import { Check, CloudSun, Leaf, Wallet, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { AlertPanel, AlertRow } from "@/components/AlertPanel";
import { Bars, Legend, Lines } from "@/components/charts";
import { Badge, Button, Card, CardTitle, Delta, Empty, Input, PageHeader, Skeleton, Tabs } from "@/components/ui";
import { useAction, useApi } from "@/lib/api";
import { catOf } from "@/lib/categories";
import { change, day, kwh, n, tnd } from "@/lib/format";
import { EnergyChat } from "@/components/EnergyChat";

export default function Insights() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("t") || "mission";
  const { data } = useApi<any>("ai", { refetch: 10000 });
  return (
    <div>
      <PageHeader title="Analyse IA">
        <Tabs value={tab} onValueChange={(t) => setParams({ t })} items={[["mission", "Mission"], ["alertes", "Alertes"], ["conseils", "Conseils"], ["historique", "Historique"], ["prevision", "Prévision"]]} />
      </PageHeader>
      {!data ? <Skeleton className="h-80" /> : tab === "mission" ? <PreventiveMission data={data} /> : tab === "alertes" ? <Alerts data={data} focus={params.get("alerte")} onUnfocus={() => setParams({ t: "alertes" }, { replace: true })} /> : tab === "conseils" ? <Advice data={data} /> : tab === "historique" ? <History /> : <Forecast data={data} />}
    </div>
  );
}

function PreventiveMission({ data }: { data: any }) {
  const mission = data.mission;
  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardTitle right={<Badge tone={mission.risk === "elevee" ? "bad" : mission.risk === "moderee" ? "warn" : "good"}>{mission.risk_label}</Badge>}>{mission.title}</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-muted p-4">
            <div className="text-xs text-ink-3">Pic prévu</div>
            <b className="mt-1 block text-xl">{mission.duration}</b>
            <p className="mt-1 text-xs text-ink-3">{mission.date}</p>
          </div>
          <div className="rounded-xl bg-muted p-4">
            <div className="flex items-center gap-1.5 text-xs text-ink-3"><CloudSun className="size-3.5" />Contexte météo</div>
            <b className="mt-1 block">{mission.weather.label}</b>
            <p className="mt-1 text-xs text-ink-3">{mission.weather.detail}</p>
            {mission.weather.available && mission.weather.max_c !== undefined && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
                <span>Max. {n(mission.weather.max_c, 0)} °C</span>
                <span>Min. {n(mission.weather.min_c, 0)} °C</span>
                {mission.weather.apparent_max_c !== null && <span>Ressenti {n(mission.weather.apparent_max_c, 0)} °C</span>}
                {mission.weather.humidity_max !== null && <span>Humidité {n(mission.weather.humidity_max, 0)} %</span>}
                {mission.weather.precipitation_probability !== null && <span>Pluie {n(mission.weather.precipitation_probability, 0)} %</span>}
              </div>
            )}
          </div>
        </div>
        <div className="mt-5">
          <h3 className="mb-3 text-sm font-medium text-ink-2">Actions prioritaires</h3>
          <div className="grid gap-2">
            {mission.actions.map((action: any, i: number) => (
              <div key={`${action.code}-${i}`} className="flex items-start gap-3 rounded-xl border border-line p-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-semibold text-brand">{i + 1}</span>
                <div><b className="block text-sm">{action.title}</b><p className="mt-0.5 text-xs text-ink-3">{action.reason}</p></div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid content-start gap-5 lg:col-span-2">
        <Card>
          <CardTitle right={<Badge tone="info">{n(mission.confidence * 100, 0)} % confiance</Badge>}>Estimation</CardTitle>
          <div className="grid grid-cols-2 gap-3">
            <div><div className="text-xs text-ink-3">Économie ciblée</div><b className="text-xl">{n(mission.daily_saving_kwh, 2)} kWh/j</b></div>
            <div><div className="text-xs text-ink-3">Impact jetons</div><b className="text-xl">{mission.token_impact ?? "À mesurer"}</b></div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink-3">
            {mission.source}
            {mission.weather.available && <> Données météo : <a className="underline underline-offset-2 hover:text-ink" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>.</>}
          </p>
        </Card>
        <EnergyChat />
        <Card>
          <p className="text-sm font-medium">{mission.motivation}</p>
          <p className="mt-2 text-xs leading-relaxed text-ink-3">{mission.factors.join(" · ")}</p>
        </Card>
      </div>
    </div>
  );
}

function Alerts({ data, focus, onUnfocus }: { data: any; focus: string | null; onUnfocus: () => void }) {
  const [sel, setSel] = useState<any>(null);
  // ?alerte=<id> opens that alert's evidence directly (used by the guided demo).
  useEffect(() => {
    if (!focus) return;
    const a = data.alerts.find((x: any) => String(x.id) === focus);
    if (a) setSel(a);
  }, [focus, data.alerts]);
  const close = () => { setSel(null); if (focus) onUnfocus(); };
  const show = (a: any) => { setSel(a); if (focus) onUnfocus(); }; // a manual pick replaces the deep link
  const open = data.alerts.filter((a: any) => a.status === "ouverte");
  const past = data.alerts.filter((a: any) => a.status !== "ouverte");
  return (
    <div className="grid gap-6">
      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-2">À traiter · {open.length}</h2>
        {open.length ? <div className="grid gap-2 md:grid-cols-2">{open.map((a: any) => <AlertRow key={a.id} a={a} onOpen={() => show(a)} />)}</div>
          : <Card><Empty icon={Check} title="Aucune anomalie en cours" /></Card>}
      </section>
      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-ink-2">Historique</h2>
          <div className="grid gap-2 opacity-80 md:grid-cols-2">{past.map((a: any) => <AlertRow key={a.id} a={a} onOpen={() => show(a)} />)}</div>
        </section>
      )}
      <AlertPanel alert={sel} onClose={close} />
    </div>
  );
}

function Advice({ data }: { data: any }) {
  const act = useAction();
  const todo = data.recommendations.filter((r: any) => !r.applied);
  const sum = (k: string) => todo.reduce((a: number, r: any) => a + r[k], 0);
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[[Zap, "Potentiel", `${n(sum("kwh_month"), 1)} kWh`, "par mois"], [Wallet, "Économie", tnd(sum("tnd_month")), "par mois, barème STEG"], [Leaf, "CO₂ évité", `${n(sum("co2_month"), 1)} kg`, "par mois"]].map(([I, l, v, s]: any) => (
          <Card key={l}><div className="flex items-center gap-2 text-[13px] text-ink-2"><I className="size-4" />{l}</div><div className="mt-1 text-2xl font-semibold tabular">{v}</div><div className="text-xs text-ink-3">{s}</div></Card>
        ))}
      </div>
      {data.recommendations.map((r: any) => (
        <Card key={r.code} className="flex flex-wrap items-center gap-5">
          <div className="min-w-56 flex-1">
            <div className="flex items-center gap-2"><b className="font-medium">{r.title}</b>{r.applied && <Badge tone="good"><Check />Appliqué</Badge>}</div>
            <p className="mt-1 text-sm text-ink-3">{r.why}</p>
          </div>
          <div className="flex gap-6 text-sm">
            <div><div className="text-xs text-ink-3">kWh/mois</div><b className="tabular">{n(r.kwh_month, 1)}</b></div>
            <div><div className="text-xs text-ink-3">DT/mois</div><b className="tabular">{n(r.tnd_month, 2)}</b></div>
            <div><div className="text-xs text-ink-3">kg CO₂</div><b className="tabular">{n(r.co2_month, 1)}</b></div>
          </div>
          {!r.applied && <Button variant="good" disabled={act.isPending} onClick={() => act.mutate({ path: "recommendations/apply", body: { code: r.code, installations: r.installations } })}>Appliquer</Button>}
        </Card>
      ))}
      {!data.recommendations.length && <Card><Empty icon={Check} title="Rien à optimiser pour l'instant" /></Card>}
    </div>
  );
}

function History() {
  const [period, setPeriod] = useState("semaine");
  const [range, setRange] = useState({ start: "", end: "" });
  const q = period === "perso" ? (range.start && range.end ? `history?period=perso&start=${range.start}&end=${range.end}` : null) : `history?period=${period}`;
  const { data: hData, error } = useApi<any>(q);
  const h = q ? hData : undefined; // no stale chart while the custom range is incomplete
  const rows = h ? h.labels.map((x: string, i: number) => Object.fromEntries([["x", x], ...h.series.map((s: any) => [s.name, s.values[i]])])) : [];
  const fmt = period === "jour" || period === "annee" ? (v: string) => v : day;
  return (
    <Card>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={period} onValueChange={setPeriod} items={[["jour", "Jour"], ["semaine", "7 jours"], ["mois", "Mois"], ["annee", "6 mois"], ["perso", "Dates"]]} />
        {period === "perso" && (
          <div className="flex gap-2"><Input type="date" className="w-40" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} /><Input type="date" className="w-40" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} /></div>
        )}
      </div>
      {period === "perso" && !q && <p className="py-10 text-center text-sm text-ink-3">Choisissez une date de début et une date de fin.</p>}
      {error && <p className="text-sm text-bad">{(error as Error).message}</p>}
      {h && (
        <>
          <div className="mb-4 flex flex-wrap gap-8">
            <div><div className="text-xs text-ink-3">Énergie</div><div className="text-2xl font-semibold tabular">{kwh(h.total)}</div></div>
            {period !== "annee" && <div><div className="text-xs text-ink-3">vs période précédente</div><div className="text-2xl font-semibold"><Delta value={change(h.total, h.previous_total)} /></div></div>}
            <div><div className="text-xs text-ink-3">CO₂</div><div className="text-2xl font-semibold tabular">{n(h.co2_kg, 1)} kg</div></div>
          </div>
          <Bars data={rows} height={280} stacked xFormat={fmt} keys={h.series.map((s: any) => ({ key: s.name, name: s.name, color: catOf(s.category).color }))} />
          <Legend items={h.series.map((s: any) => ({ name: s.name, color: catOf(s.category).color }))} />
        </>
      )}
    </Card>
  );
}

function Forecast({ data }: { data: any }) {
  const f = data.forecast;
  let acc = 0;
  const actual = f.daily.map((d: any) => (acc += d[1]));
  const last = actual.length;
  const rows = Array.from({ length: f.days_in_month }, (_, i) => ({
    x: i + 1, actual: i < last ? actual[i] : null,
    proj: i >= last - 1 ? actual[last - 1] + (i - last + 1) * f.avg_daily * f.trend : null,
  }));
  const hb = data.habits;
  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardTitle right={<Badge tone="info">Estimation</Badge>}>Fin de mois</CardTitle>
        <div className="mb-3 flex gap-8">
          <div><div className="text-xs text-ink-3">Prévu</div><div className="text-2xl font-semibold tabular">{n(f.month_kwh)} kWh</div></div>
          <div><div className="text-xs text-ink-3">Fourchette</div><div className="text-2xl font-semibold tabular text-ink-2">{n(f.low)}–{n(f.high)}</div></div>
        </div>
        <Lines data={rows} height={240} keys={[{ key: "actual", name: "Mesuré", color: "var(--color-c1)" }, { key: "proj", name: "Projection", color: "var(--color-c1)", dash: true }]}
          refs={[{ y: f.goal_kwh, label: "Objectif", color: "var(--color-bad)" }]} />
      </Card>
      <Card className="lg:col-span-2">
        <CardTitle>Journée type</CardTitle>
        <Bars data={hb.profile.map((v: number, i: number) => ({ x: i, kwh: v }))} height={180} xFormat={(v) => `${v}h`} highlight={[18, 21]}
          keys={[{ key: "kwh", name: "Moyenne 14 j", color: "var(--color-c1)" }]} />
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-muted p-3"><div className="text-xs text-ink-3">Heure la plus chargée</div><b>{hb.peak_hour} h</b></div>
          <div className="rounded-xl bg-muted p-3"><div className="text-xs text-ink-3">Soirée (18–23 h)</div><b>{n(hb.evening_share * 100)} %</b></div>
        </div>
      </Card>
    </div>
  );
}
