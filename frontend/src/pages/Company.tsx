import { HeartHandshake, Leaf, Zap } from "lucide-react";
import { useState } from "react";
import { Bars } from "@/components/charts";
import { Button, Card, CardTitle, Dialog, Field, Input, PageHeader, Progress, Skeleton, Stat } from "@/components/ui";
import { useAction, useApi } from "@/lib/api";
import { day, n, pct } from "@/lib/format";
import { useMe } from "@/lib/session";

export default function Company() {
  const { data: me } = useMe();
  const { data } = useApi<any>("company");
  const { data: sol } = useApi<any>("solidarity");
  const act = useAction();
  const [proj, setProj] = useState<any>(null);
  const [amount, setAmount] = useState("500");
  if (!data || !sol) return <Skeleton className="h-80" />;
  return (
    <div className="grid gap-5">
      <PageHeader title={me?.user?.name || "Entreprise"} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="30 jours" value={n(data.total30)} unit="kWh" />
        <Stat label="CO₂ (30 j)" value={n(data.co2_30)} unit="kg" info="Facteur IEA : 0,468 kg CO₂/kWh" />
        <Stat label="En pointe 18–22 h" value={pct(data.peak_share)} />
        <Stat label="Solidarité financée" value={n(data.sponsored)} unit="DT" sub={`${data.beneficiaries} bénéficiaires`} />
      </div>
      <Card>
        <CardTitle right={<span className="flex items-center gap-1 text-xs text-good"><Leaf className="size-3.5" />{n(data.savings.kwh, 1)} kWh économisés</span>}>Consommation quotidienne</CardTitle>
        <Bars data={data.daily.map((d: any) => ({ x: d[0], kwh: d[1] }))} height={240} xFormat={day} keys={[{ key: "kwh", name: "Énergie", color: "var(--color-c1)" }]} />
      </Card>
      <Card>
        <CardTitle right={<HeartHandshake className="size-4 text-ink-3" />}>Projets solidaires</CardTitle>
        <div className="grid gap-3 md:grid-cols-2">
          {sol.projects.map((p: any) => (
            <div key={p.code} className="rounded-xl border border-line p-4">
              <b className="text-sm font-medium">{p.title}</b><div className="text-xs text-ink-3">{p.region} · {p.partner}</div>
              <Progress className="my-3 h-1.5" value={p.funded / p.goal} color="var(--color-good)" />
              <div className="flex items-center justify-between text-xs"><span className="tabular text-ink-3">{n(p.funded)} / {n(p.goal)} DT</span><Button size="sm" onClick={() => setProj(p)}><Zap />Financer</Button></div>
            </div>
          ))}
        </div>
      </Card>
      <Dialog open={!!proj} onOpenChange={(o) => !o && setProj(null)} title={proj?.title}>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); act.mutate({ path: "solidarity", body: { project: proj.code, amount }, success: "Contribution inscrite au registre" }, { onSuccess: () => setProj(null) }); }}>
          <Field label="Montant (DT)"><Input type="number" min={10} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <p className="text-xs text-ink-3">Paiement simulé. Inscrit au registre public des contributions.</p>
          <Button type="submit" variant="good" disabled={act.isPending || !(Number(amount) >= 10)}>Confirmer</Button>
        </form>
      </Dialog>
    </div>
  );
}
