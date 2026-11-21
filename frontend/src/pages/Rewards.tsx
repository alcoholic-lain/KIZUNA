import { Check, Coins, Gift, HeartHandshake, Trophy } from "lucide-react";
import { useState } from "react";
import { Bars, Ring } from "@/components/charts";
import { Badge, Button, Card, CardTitle, Delta, Dialog, Field, Input, PageHeader, Progress, Skeleton } from "@/components/ui";
import { useAction, useApi } from "@/lib/api";
import { dateTime, day, n } from "@/lib/format";

const KIND: Record<string, string> = { economie: "Économie", defi: "Défi", education: "Quiz", communaute: "Collectif", depense: "Récompense", don: "Don" };

export default function Rewards() {
  const { data } = useApi<any>("rewards", { refetch: 5000 });
  const { data: sol } = useApi<any>("solidarity");
  const act = useAction();
  const [donate, setDonate] = useState<any>(null);
  const [amount, setAmount] = useState("100");
  if (!data) return <Skeleton className="h-80" />;
  const L = data.ledger, S = data.score;
  return (
    <div className="grid gap-5">
      <PageHeader title="Récompenses" />
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[oklch(0.3_0.08_80)] to-[oklch(0.2_0.02_270)] p-6 text-white shadow-xl lg:col-span-2" id="tokens-card">
          <div className="flex items-center gap-2 text-sm text-white/70"><Coins className="size-4" />Jetons disponibles</div>
          <div className="mt-2 text-6xl font-semibold tracking-tighter tabular">{n(L.balance)}</div>
          <div className="mt-6 grid max-w-md grid-cols-3 gap-4 text-sm">
            <div><div className="text-white/60">Aujourd'hui</div><b className="tabular">+{L.today}</b></div>
            <div><div className="text-white/60">Encore gagnables</div><b className="tabular">{L.left_today}</b></div>
            <div><div className="text-white/60">kWh évités</div><b className="tabular">{n(data.savings.kwh, 2)}</b></div>
          </div>
          <Progress className="mt-4 max-w-md bg-white/15" value={L.today / L.cap} color="var(--color-energy)" />
          <p className="mt-2 text-xs text-white/60">{L.rate} jetons par kWh évité · {L.cap} max par jour · jamais une condition d'accès à l'électricité</p>
        </section>
        <Card className="flex flex-col items-center">
          <CardTitle className="self-stretch" right={<Delta value={S.score - S.previous} invert unit="pts" />}>Score éco</CardTitle>
          <Ring value={S.score} size={132} stroke={11} color={S.score >= 60 ? "var(--color-good)" : "var(--color-warn)"}><div><b className="text-3xl tabular">{S.score}</b><div className="text-xs text-ink-3">/ 100</div></div></Ring>
          <div className="mt-5 grid w-full gap-2.5">
            {S.parts.map((p: any) => (
              <div key={p.key} title={p.hint}>
                <div className="flex justify-between text-xs"><span className="text-ink-2">{p.label}</span><span className="tabular text-ink-3">{p.points}/{p.max}</span></div>
                <Progress value={p.points / p.max} color="var(--color-good)" className="mt-1 h-1.5" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle right={<Trophy className="size-4 text-ink-3" />}>Défis</CardTitle>
          <div className="grid gap-2">
            {data.challenges.map((c: any) => (
              <div key={c.code} className="flex items-center gap-3 rounded-xl border border-line p-3">
                <div className="flex-1"><b className="text-sm font-medium">{c.title}</b><div className="text-xs text-ink-3">{c.detail}</div></div>
                <Badge tone="good">+{c.reward}</Badge>
                {c.done ? <Badge tone="good"><Check />Réussi</Badge> :
                  <Button size="sm" variant={c.ready ? "good" : "soft"} onClick={() => act.mutate({ path: `challenges/${c.code}` })}>{c.ready ? "Valider" : "Vérifier"}</Button>}
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle>14 derniers jours</CardTitle>
          <Bars data={L.daily.map((d: any) => ({ x: d[0], t: d[1] }))} height={170} unit="jetons" xFormat={day} keys={[{ key: "t", name: "Jetons gagnés", color: "var(--color-energy)" }]} />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle right={<HeartHandshake className="size-4 text-ink-3" />}>Solidarité</CardTitle>
          <div className="grid gap-3">
            {sol?.projects.map((p: any) => (
              <div key={p.code} className="rounded-xl border border-line p-3">
                <div className="flex items-start justify-between gap-2"><b className="text-sm font-medium">{p.title}</b><span className="shrink-0 text-xs text-ink-3">{p.region}</span></div>
                <Progress className="my-2 h-1.5" value={p.funded / p.goal} color="var(--color-good)" />
                <div className="flex items-center justify-between text-xs text-ink-3"><span className="tabular">{n(p.funded)} / {n(p.goal)} DT · {p.beneficiaries} bénéficiaires</span>
                  <Button size="sm" variant="ghost" onClick={() => setDonate(p)}>Donner</Button></div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle right={<Gift className="size-4 text-ink-3" />}>Utiliser · Historique</CardTitle>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {data.catalog.map((c: any) => (
              <button key={c.code} disabled={L.balance < c.cost} onClick={() => act.mutate({ path: "rewards/redeem", body: { code: c.code } })}
                className="rounded-xl border border-line p-3 text-left text-xs transition hover:border-ink/30 disabled:opacity-40">
                <b className="block text-sm font-medium leading-tight">{c.title}</b><span className="tabular text-ink-3">{n(c.cost)} jetons</span>
              </button>
            ))}
          </div>
          <div className="grid max-h-60 gap-1 overflow-y-auto">
            {L.items.map((i: any, k: number) => (
              <div key={k} className="flex items-center justify-between py-1.5 text-sm">
                <span className="min-w-0"><span className="block truncate">{i.label}</span><span className="text-xs text-ink-3">{KIND[i.kind]} · {dateTime(i.ts)}</span></span>
                <b className={`tabular ${i.amount > 0 ? "text-good" : "text-ink-3"}`}>{i.amount > 0 ? "+" : ""}{n(i.amount)}</b>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Dialog open={!!donate} onOpenChange={(o) => !o && setDonate(null)} title={donate?.title}>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); act.mutate({ path: "solidarity", body: { project: donate.code, tokens: +amount }, success: "Merci pour votre don" }, { onSuccess: () => setDonate(null) }); }}>
          <Field label="Jetons (par 100)"><Input type="number" min={100} step={100} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <p className="text-xs text-ink-3">100 jetons = 1 DT versé par le fonds des entreprises partenaires (simulé).</p>
          <Button type="submit" variant="good">Donner</Button>
        </form>
      </Dialog>
    </div>
  );
}
