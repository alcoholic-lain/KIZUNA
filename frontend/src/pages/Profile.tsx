import { Building2, Check, FileSignature, ShieldCheck, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { TermsConsent } from "@/components/Terms";
import { BackLink, Badge, Button, Card, CardTitle, Field, Input, PageHeader, Skeleton } from "@/components/ui";
import { useAction, useApi } from "@/lib/api";
import { n, tnd } from "@/lib/format";
import { useMe } from "@/lib/session";
import { useDebounced } from "@/lib/utils";

const ROLE: Record<string, string> = { foyer: "Household", etudiant: "Student", famille: "Family", entreprise: "Business" };

export default function Profile() {
  const { data: me } = useMe();
  const act = useAction();
  const user = me?.user;
  const h = user?.household;
  const [f, setF] = useState({ name: "", city: "", goal: "", kva: "", occupants: "" });
  const [agree, setAgree] = useState(false);
  useEffect(() => {
    if (user && h) setF({ name: user.name, city: user.city, goal: String(h.goal), kva: String(h.kva), occupants: String(h.occupants) });
    setAgree(!!user?.terms?.ok);
  }, [user?.name, user?.city, h?.goal, h?.kva, h?.occupants, user?.terms?.ok]);

  const goal = Number(f.goal), kva = Number(f.kva), occ = Number(f.occupants);
  const valid = f.name.trim().length >= 2 && goal >= 10 && kva >= 1 && kva <= 100 && occ >= 1;
  const probe = useDebounced(valid ? `learn/bill?kwh=${goal}&kva=${Math.round(kva)}` : null, 300);
  const { data: bill } = useApi<any>(probe);

  if (!user || !h) return <Skeleton className="h-60" />;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const accepted = !!user.terms?.ok;
  const dirty = f.name !== user.name || f.city !== user.city || goal !== h.goal || kva !== h.kva || occ !== h.occupants;
  const canSave = valid && agree && (dirty || !accepted) && !act.isPending;

  return (
    <div className="grid max-w-3xl gap-5">
      <BackLink to="/app/explorer">Explore</BackLink>
      <PageHeader title="Profile and contract"><Badge tone="neutral">{ROLE[user.role] ?? user.role}</Badge></PageHeader>

      <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); if (canSave) act.mutate({ path: "profile", body: { ...f, accept_terms: agree }, success: "Saved" }); }}>
        <Card>
          <CardTitle>About you</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><Input required minLength={2} value={f.name} onChange={set("name")} /></Field>
            <Field label="City"><Input value={f.city} onChange={set("city")} /></Field>
            <Field label="Email"><Input value={user.email} readOnly disabled className="text-ink-3" /></Field>
            <Field label="Household"><Input value={`${h.label} · ${h.building}`} readOnly disabled className="text-ink-3" /></Field>
          </div>
        </Card>

        <Card>
          <CardTitle right={<Zap className="size-4 text-ink-3" />}>Your energy contract</CardTitle>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Monthly goal (kWh)"><Input type="number" min={10} max={100000} value={f.goal} onChange={set("goal")} /></Field>
            <Field label="Subscribed power (kVA)"><Input type="number" min={1} max={100} step={1} value={f.kva} onChange={set("kva")} /></Field>
            <Field label="Occupants"><Input type="number" min={1} max={500} value={f.occupants} onChange={set("occupants")} /></Field>
          </div>
          <p className="mt-3 text-xs text-ink-3">Your goal drives the progress bars and alerts. The subscribed power is the kVA on your STEG contract: it sets the fixed monthly power charge, whatever you consume. Changing it here does not change your STEG contract.</p>
          <div className="mt-4 rounded-xl bg-muted p-4">
            {!valid ? (
              <p className="text-sm text-ink-3">Enter a goal of at least 10 kWh, a power between 1 and 100 kVA and at least one occupant to see the estimate.</p>
            ) : !bill ? <Skeleton className="h-12" /> : (
              <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
                <div>
                  <div className="text-xs text-ink-3">If you stay on your goal, the STEG bill is about</div>
                  <div className="text-2xl font-semibold tracking-tight tabular">{tnd(bill.total)}<span className="ml-1 text-sm font-medium text-ink-3">/ month</span></div>
                </div>
                <dl className="grid grid-cols-3 gap-x-6 text-xs">
                  <div><dt className="text-ink-3">Power charge</dt><dd className="font-medium tabular">{tnd(bill.power_charge)}</dd></div>
                  <div><dt className="text-ink-3">Average price</dt><dd className="font-medium tabular">{n(bill.avg_price, 3)} DT/kWh</dd></div>
                  <div><dt className="text-ink-3">Goal per person</dt><dd className="font-medium tabular">{n(goal / Math.max(1, occ), 0)} kWh</dd></div>
                </dl>
              </div>
            )}
            <p className="mt-2 text-[11px] text-ink-3">Estimate from the published STEG residential tariff, not an invoice.</p>
          </div>
        </Card>

        <Card>
          <CardTitle right={<ShieldCheck className="size-4 text-ink-3" />}>Privacy</CardTitle>
          <div className="flex items-start gap-3 text-sm">
            <Building2 className="mt-0.5 size-4 shrink-0 text-ink-3" />
            <p className="text-ink-2">STEG sees your household as <b className="font-mono text-ink">{h.code}</b>, in {h.region}. Never your name or email.</p>
          </div>
        </Card>

        <Card>
          <CardTitle right={<FileSignature className="size-4 text-ink-3" />}>Terms and conditions</CardTitle>
          <TermsConsent checked={agree} onChange={setAgree} locked={accepted}
            note={accepted && user.terms?.accepted_at ? `Accepted on ${new Date(user.terms.accepted_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} (version ${user.terms.version}).` : "You need to accept the terms to save your profile."} />
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!canSave}>{act.isPending ? "Saving…" : <><Check />Save</>}</Button>
          {!agree && <span className="text-xs text-ink-3">Accept the terms and conditions to save.</span>}
        </div>
      </form>
    </div>
  );
}
