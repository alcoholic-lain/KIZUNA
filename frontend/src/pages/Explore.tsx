import { ArrowRight, BookOpen, ExternalLink, Globe2, Sparkles, User, Waypoints } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Donut } from "@/components/charts";
import { BackLink, Badge, Button, Card, CardTitle, Field, Input, PageHeader, Skeleton, Tabs } from "@/components/ui";
import { api, useAction, useApi } from "@/lib/api";
import { colorOfLabel } from "@/lib/categories";
import { kwh, n } from "@/lib/format";
import { useMe } from "@/lib/session";
import { useQueryClient } from "@tanstack/react-query";

export function Explore() {
  const tiles = [
    { to: "/app/comparer", icon: Globe2, title: "Tunisie – Japon", sub: "Données officielles sourcées" },
    { to: "/app/flux", icon: Waypoints, title: "Flux d'énergie", sub: "Du réseau à chaque appareil" },
    { to: "/app/apprendre", icon: BookOpen, title: "Apprendre", sub: "Jeux et quiz en famille" },
    { to: "/app/profil", icon: User, title: "Profil et contrat", sub: "Objectif, puissance souscrite" },
  ];
  return (
    <div>
      <PageHeader title="Explorer" />
      <div className="grid gap-4 sm:grid-cols-2">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to} className="group flex items-center gap-4 rounded-2xl border border-line bg-card p-5 transition hover:shadow-md">
            <span className="grid size-12 place-items-center rounded-2xl bg-muted"><t.icon className="size-5" /></span>
            <span className="flex-1"><b className="block font-medium">{t.title}</b><span className="text-sm text-ink-3">{t.sub}</span></span>
            <ArrowRight className="size-4 text-ink-3 transition group-hover:translate-x-1" />
          </Link>
        ))}
      </div>
    </div>
  );
}

const ToExplore = ({ className }: { className?: string }) => <BackLink to="/app/explorer" className={className}>Explorer</BackLink>;

export function Compare() {
  const { data: who } = useMe();
  const { data } = useApi<any>("benchmark");
  if (!data) return <Skeleton className="h-80" />;
  const tn = data.countries.tunisie, jp = data.countries.japon, me = data.mine;
  const bars = [
    { label: "Tunisie", sub: `moyenne ${tn.year}`, v: tn.household_kwh_year, color: "var(--color-c2)", src: tn.source },
    { label: "Japon", sub: `moyenne ${jp.year}`, v: jp.household_kwh_year, color: "var(--color-c7)", src: jp.source },
    ...(me ? [{ label: me.label, sub: "projection, simulé", v: me.kwh_year, color: "var(--color-c1)", src: null }] : []),
  ];
  const max = Math.max(...bars.map((b) => b.v));
  const src = (k: string) => data.sources[k];
  return (
    <div className="grid gap-5">
      {who?.user?.role !== "steg" && <ToExplore />}
      <PageHeader title="Tunisie – Japon" />
      <Card>
        <CardTitle>Électricité par foyer et par an</CardTitle>
        <div className="grid gap-5">
          {bars.map((b, i) => (
            <div key={b.label}>
              <div className="mb-1.5 flex items-baseline justify-between text-sm"><span><b className="font-medium">{b.label}</b> <span className="text-ink-3">· {b.sub}</span></span><b className="tabular">{n(b.v)} kWh</b></div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <motion.div className="h-full rounded-full" style={{ background: b.color }} initial={{ width: 0 }} animate={{ width: `${(b.v / max) * 100}%` }} transition={{ duration: 1, delay: i * 0.15 }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm text-ink-2">Un foyer japonais consomme environ <b>{n(jp.household_kwh_year / tn.household_kwh_year, 1)} ×</b> plus qu'un foyer tunisien. En Tunisie, la moyenne a augmenté de <b>{n((tn.household_kwh_year / tn.previous.kwh - 1) * 100, 1)} %</b> entre {tn.previous.year} et {tn.year}.</p>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>Tunisie : usages de l'électricité des ménages</CardTitle>
          <Donut size={190} data={tn.uses.map((u: any, i: number) => ({ name: u[0], value: u[1], color: `var(--color-c${(i % 8) + 1})` }))} center={<span className="text-xs text-ink-3">{tn.year}</span>} />
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {tn.uses.map((u: any, i: number) => <span key={u[0]} className="flex items-center justify-between"><span className="flex items-center gap-1.5"><i className="size-2 rounded-sm" style={{ background: `var(--color-c${(i % 8) + 1})` }} />{u[0]}</span><b>{u[1]} %</b></span>)}
          </div>
        </Card>
        <Card>
          <CardTitle>Même technologie, priorités différentes</CardTitle>
          {[tn, jp].map((c: any) => (
            <div key={c.name} className="mb-4">
              <b className="text-sm font-medium">{c.name}</b>
              <div className="mt-2 flex flex-wrap gap-2">{c.focus.map((f: string) => <Badge key={f}>{f}</Badge>)}</div>
            </div>
          ))}
          <p className="text-sm text-ink-3">Japon : de {n(jp.range.min[1])} kWh ({jp.range.min[0]}) à {n(jp.range.max[1])} kWh ({jp.range.max[0]}) selon la région.</p>
        </Card>
      </div>
      <div className="grid gap-1 text-xs text-ink-3">
        {[tn.source, jp.source, "steg_tarif", "iea"].map((k) => (
          <a key={k} href={src(k).url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-ink"><ExternalLink className="size-3" />{src(k).label}</a>
        ))}
      </div>
    </div>
  );
}

export function Flows() {
  const [scope, setScope] = useState("foyer");
  const { data } = useApi<any>(`flows?scope=${scope}`, { refetch: 15000 });
  return (
    <div className="grid">
      <ToExplore className="mb-4" />
      <PageHeader title="Flux d'énergie"><Tabs value={scope} onValueChange={setScope} items={[["foyer", "Mon foyer"], ["immeuble", "Mon immeuble"]]} /></PageHeader>
      {!data ? <Skeleton className="h-96" /> : <Sankey data={data} />}
    </div>
  );
}

function Sankey({ data }: { data: any }) {
  const W = 900, H = Math.max(380, data.consumers.length * 52 + 40);
  const total = data.total || 1;
  const sources = [{ label: "Réseau STEG", kwh: data.grid, color: "var(--color-c1)" }, ...(data.solar > 0 ? [{ label: "Solaire (simulé)", kwh: data.solar, color: "var(--color-c4)" }] : [])];
  const scale = (H - 60) / total;
  const midX = 380, midW = 18;
  let y = 30;
  const src = sources.map((s) => { const h = Math.max(3, s.kwh * scale); const r = { ...s, y, h }; y += h + 14; return r; });
  const midH = total * scale, midY = (H - midH) / 2;
  let cy = 20, my = midY;
  const gap = (H - 40 - midH) / Math.max(1, data.consumers.length - 1);
  const cons = data.consumers.map((c: any, i: number) => {
    const h = Math.max(3, c.kwh * scale);
    const r = { ...c, y: cy, h, my, color: c.label.includes("Non suivi") || c.label.includes("Autres") ? "var(--color-c0)" : colorOfLabel(c.label) !== "var(--color-c0)" ? colorOfLabel(c.label) : `var(--color-c${(i % 8) + 1})` };
    cy += h + Math.min(gap, 22); my += h;
    return r;
  });
  let sy = midY;
  const link = (x0: number, y0: number, x1: number, y1: number, h: number) => `M${x0},${y0 + h / 2} C${(x0 + x1) / 2},${y0 + h / 2} ${(x0 + x1) / 2},${y1 + h / 2} ${x1},${y1 + h / 2}`;
  return (
    <Card className="overflow-x-auto">
      <div className="mb-4 flex flex-wrap gap-8">
        <div><div className="text-xs text-ink-3">Aujourd'hui</div><div className="text-2xl font-semibold tabular">{kwh(data.total)}</div></div>
        <div><div className="text-xs text-ink-3">CO₂</div><div className="text-2xl font-semibold tabular">{n(data.co2_kg, 2)} kg</div></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[640px]">
        {src.map((s) => { const p = link(150, s.y, midX, sy, s.h); const el = <g key={s.label}><path d={p} fill="none" stroke={s.color} strokeOpacity={0.3} strokeWidth={s.h} />
          <motion.path d={p} fill="none" stroke="white" strokeOpacity={0.7} strokeWidth={Math.min(2, s.h / 3)} strokeDasharray="3 18" animate={{ strokeDashoffset: [0, -42] }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} />
          <rect x={136} y={s.y} width={14} height={s.h} rx={3} fill={s.color} /><text x={128} y={s.y + s.h / 2 + 4} textAnchor="end" className="fill-ink text-[13px] font-medium">{s.label}</text>
          <text x={128} y={s.y + s.h / 2 + 20} textAnchor="end" className="fill-ink-3 text-[11px]">{kwh(s.kwh)}</text></g>; sy += s.h; return el; })}
        <rect x={midX} y={midY} width={midW} height={midH} rx={4} fill="var(--color-ink)" />
        {cons.map((c: any) => { const p = link(midX + midW, c.my, 640, c.y, c.h); return (
          <g key={c.label}><path d={p} fill="none" stroke={c.color} strokeOpacity={0.3} strokeWidth={c.h} />
            <motion.path d={p} fill="none" stroke="white" strokeOpacity={0.7} strokeWidth={Math.min(2, c.h / 3)} strokeDasharray="3 18" animate={{ strokeDashoffset: [0, -42] }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} />
            <rect x={640} y={c.y} width={14} height={c.h} rx={3} fill={c.color} />
            <text x={664} y={c.y + c.h / 2 + 4} className="fill-ink text-[13px] font-medium">{c.label}</text>
            <text x={664} y={c.y + c.h / 2 + 19} className="fill-ink-3 text-[11px]">{kwh(c.kwh)}</text></g>); })}
      </svg>
    </Card>
  );
}

const ROOM = [
  { e: "📺", x: 14, y: 26, v: true }, { e: "🎮", x: 34, y: 64, v: true }, { e: "🔌", x: 56, y: 74, v: true }, { e: "📦", x: 12, y: 58, v: true },
  { e: "🪴", x: 82, y: 60, v: false }, { e: "📚", x: 66, y: 24, v: false }, { e: "🧊", x: 86, y: 20, v: false }, { e: "🧸", x: 46, y: 36, v: false },
];
const QUIZ = [
  { q: "Qui consomme le plus en 1 heure ?", o: ["Chargeur", "Climatiseur", "Lampe LED"], a: 1 },
  { q: "Un appareil en veille…", o: ["Ne consomme rien", "Consomme un peu, tout le temps"], a: 1 },
  { q: "150 W pendant 4 h, c'est…", o: ["0,6 kWh", "600 kWh", "150 kWh"], a: 0 },
];

export function Learn() {
  const qc = useQueryClient();
  const [found, setFound] = useState<number[]>([]);
  const [msg, setMsg] = useState("Trouve les 4 vampires d'énergie : ils consomment même éteints.");
  const [qi, setQi] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const done = async (item: string, title: string, s: number) => {
    const r = await api("learn/complete", { method: "POST", body: { item, title, score: s } });
    if (r.tokens) toast.success(`+${r.tokens} jetons`);
    qc.invalidateQueries();
  };
  const click = (i: number) => {
    if (!ROOM[i].v) return setMsg("Celui-là ne consomme rien en veille 🙂");
    if (found.includes(i)) return;
    const f = [...found, i];
    setFound(f);
    setMsg(f.length === 4 ? "Bravo ! Une multiprise à interrupteur les éteint tous d'un coup." : `Bien vu ! Encore ${4 - f.length}.`);
    if (f.length === 4) done("jeu-vampires", "Chasse aux vampires", 100);
  };
  const q = QUIZ[qi];
  return (
    <div className="grid gap-5">
      <ToExplore />
      <PageHeader title="Apprendre" />
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle right={<Badge tone="brand">{found.length}/4</Badge>}>Chasse aux vampires d'énergie</CardTitle>
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl" style={{ background: "linear-gradient(#fdf0d5 0 62%, #e3b98a 62%)" }}>
            {ROOM.map((o, i) => (
              <motion.button key={i} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={() => click(i)}
                className="absolute text-[clamp(1.8rem,5vw,3rem)]" style={{ left: `${o.x}%`, top: `${o.y}%`, filter: found.includes(i) ? "drop-shadow(0 0 10px #22c55e)" : undefined }}>
                {o.e}{found.includes(i) && <span className="absolute -right-1 -top-1 text-base">✅</span>}
              </motion.button>
            ))}
          </div>
          <p className="mt-3 text-sm font-medium">{msg}</p>
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle right={<Sparkles className="size-4 text-ink-3" />}>Quiz {qi < QUIZ.length ? `${qi + 1}/${QUIZ.length}` : ""}</CardTitle>
          {qi < QUIZ.length ? (
            <div className="grid gap-2">
              <p className="mb-2 font-medium">{q.q}</p>
              {q.o.map((o, k) => (
                <button key={o} disabled={picked !== null} onClick={() => { setPicked(k); if (k === q.a) setScore(score + 1); }}
                  className={`rounded-xl border p-3 text-left text-sm font-medium transition ${picked === null ? "border-line hover:border-ink/30" : k === q.a ? "border-good bg-good/10" : k === picked ? "border-bad bg-bad/10" : "border-line opacity-50"}`}>{o}</button>
              ))}
              {picked !== null && <Button className="mt-2" onClick={() => { const nx = qi + 1; setQi(nx); setPicked(null); if (nx === QUIZ.length) done("quiz-energie", "Quiz énergie", Math.round((score / QUIZ.length) * 100)); }}>Suivant</Button>}
            </div>
          ) : (
            <div className="grid place-items-center gap-3 py-8 text-center"><span className="text-4xl">🏅</span><b>{score}/{QUIZ.length}</b><Button variant="outline" onClick={() => { setQi(0); setScore(0); }}>Rejouer</Button></div>
          )}
        </Card>
      </div>
    </div>
  );
}

export function Profile() {
  const { data: me } = useMe();
  const act = useAction();
  const h = me?.user?.household;
  const [f, setF] = useState({ name: "", city: "", goal: "", kva: "", occupants: "" });
  useEffect(() => { if (me?.user && h) setF({ name: me.user.name, city: me.user.city, goal: String(h.goal), kva: String(h.kva), occupants: String(h.occupants) }); }, [me?.user?.name]);
  if (!h) return <Skeleton className="h-60" />;
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="grid max-w-xl">
      <ToExplore className="mb-4" />
      <PageHeader title="Profil et contrat" />
      <Card>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); act.mutate({ path: "profile", body: f, success: "Enregistré" }); }}>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Nom"><Input value={f.name} onChange={set("name")} /></Field><Field label="Ville"><Input value={f.city} onChange={set("city")} /></Field></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Objectif (kWh/mois)"><Input type="number" min={10} value={f.goal} onChange={set("goal")} /></Field>
            <Field label="Puissance (kVA)"><Input type="number" min={1} value={f.kva} onChange={set("kva")} /></Field>
            <Field label="Occupants"><Input type="number" min={1} value={f.occupants} onChange={set("occupants")} /></Field>
          </div>
          <p className="text-xs text-ink-3">Pseudonyme vu par la STEG : <b>{h.code}</b>. Jamais votre nom.</p>
          <Button type="submit" className="justify-self-start" disabled={act.isPending}>Enregistrer</Button>
        </form>
      </Card>
    </div>
  );
}
