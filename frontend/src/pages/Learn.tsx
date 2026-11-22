import { ArrowRight, Check, Ghost, Home as HomeIcon, Lightbulb, Receipt, RotateCcw, Trophy, Zap } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { BackLink, Badge, Button, Card, CardTitle, Progress, Skeleton } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import { n, tnd } from "@/lib/format";
import { useMe } from "@/lib/session";
import { cn, useDebounced } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

/* ------------------------------------------------------------------ content */

type Q = { q: string; o: string[]; a: number; why: string };
type Done = (id: string, score: number) => Promise<any>;

const shuffle = <T,>(xs: T[]) => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map((p) => p[1]);

const QUIZZES: Record<string, { title: string; blurb: string; icon: any; questions: Q[] }> = {
  "quiz-energie": {
    title: "Energy basics", blurb: "Watts, kilowatt-hours and standby.", icon: Zap,
    questions: [
      { q: "Which uses the most energy in one hour?", o: ["Phone charger (11 W)", "Air conditioner (1,000 W)", "LED lamp (9 W)"], a: 1, why: "Power is how fast a device uses energy. The air conditioner draws about a hundred times more than the charger or the lamp." },
      { q: "A device on standby…", o: ["Uses nothing", "Uses a little, all the time"], a: 1, why: "A few watts around the clock add up: 9 W of standby is about 79 kWh over a year." },
      { q: "A 150 W device runs for 4 hours. How much energy is that?", o: ["0.6 kWh", "600 kWh", "150 kWh"], a: 0, why: "Energy = power × time: 150 W × 4 h = 600 Wh = 0.6 kWh." },
      { q: "What does the kilowatt-hour (kWh) on your bill measure?", o: ["How strong the current is", "Energy used over time", "The voltage of the grid"], a: 1, why: "A kWh is one kilowatt used for one hour. It is the unit STEG bills." },
      { q: "A 1,000 W heater runs for 2 hours. What does it use?", o: ["1 kWh", "2 kWh", "1,000 kWh"], a: 1, why: "1 kW × 2 h = 2 kWh." },
    ],
  },
  "quiz-facture": {
    title: "Reading your STEG bill", blurb: "Bands, power charge and VAT.", icon: Receipt,
    questions: [
      { q: "In the residential tariff, what happens to the price per kWh as you use more?", o: ["It stays the same", "It rises with each consumption band", "It falls, like a bulk discount"], a: 1, why: "Prices climb from 0.062 DT/kWh for the first kWh to 0.414 DT/kWh above 500 kWh a month. Using less is cheaper per kWh too." },
      { q: "What sets the fixed power charge on your bill?", o: ["How much you consume", "The subscribed power in kVA", "The number of occupants"], a: 1, why: "It is 0.700 DT per kVA per month, whether you use 20 kWh or 400 kWh." },
      { q: "Your contract is 4 kVA. What is the monthly power charge?", o: ["0.70 DT", "2.80 DT", "28.00 DT"], a: 1, why: "4 kVA × 0.700 DT = 2.80 DT per month." },
      { q: "From which monthly consumption does VAT go from 7 % to 13 %?", o: ["Above 100 kWh", "Above 300 kWh", "Above 500 kWh"], a: 1, why: "In the tariff used by Mieruka, VAT is 7 % up to 300 kWh a month and 13 % above." },
      { q: "Why can a few extra kWh at the end of the month cost so much?", o: ["They are taxed twice", "Crossing a band moves the whole consumption to a higher price", "Meters read high at month end"], a: 1, why: "In our estimate, above 100 kWh the price of the band you reach applies to every kWh. Try the simulator below to see the jump." },
    ],
  },
  "quiz-habitudes": {
    title: "Smart habits", blurb: "Small changes that really save.", icon: Lightbulb,
    questions: [
      { q: "When is the best time to run a washing machine?", o: ["During the evening peak", "Outside the evening peak, when the grid is least loaded", "It makes no difference"], a: 1, why: "Moving flexible loads away from the peak eases the grid. Water heaters and washing machines are the easiest to shift." },
      { q: "Which air-conditioner target uses less energy?", o: ["20 °C", "24 °C"], a: 1, why: "The bigger the gap with the outside temperature, the harder the compressor works. A milder target saves energy every hour it runs." },
      { q: "What does a switched power strip do for your standby devices?", o: ["Nothing", "Cuts them all off with one switch", "Makes them use more"], a: 1, why: "One switch at bedtime turns off the TV, console and chargers plugged into it, and their standby draw with them." },
      { q: "Which is better for a washing machine?", o: ["Many small loads", "Fewer, full loads"], a: 1, why: "A cycle uses a similar amount of energy and water whether the drum is full or half empty, so full loads cost less per kilo of laundry." },
      { q: "A LED bulb gives the same light as an old incandescent bulb. It uses…", o: ["About the same", "Around five to eight times less", "Twice as much"], a: 1, why: "A typical LED uses 8–10 W where an incandescent bulb needs about 60 W for similar brightness." },
    ],
  },
};

const VAMPIRES = [
  { e: "📺", name: "TV and set-top box", w: 9, x: 14, y: 26 },
  { e: "🎮", name: "Game console", w: 10, x: 34, y: 64 },
  { e: "🔌", name: "Phone charger", w: 0.5, x: 56, y: 74 },
  { e: "💻", name: "Computer", w: 3, x: 12, y: 58 },
];
const DECOYS = [
  { e: "🪴", name: "A plant", why: "Plants don't use electricity.", x: 82, y: 60 },
  { e: "📚", name: "Books", why: "Books don't use electricity.", x: 66, y: 24 },
  { e: "🧊", name: "Fridge", why: "The fridge has to stay on: it cools food and switches itself on and off. It is not a vampire.", x: 86, y: 20 },
  { e: "🧸", name: "Teddy bear", why: "Nothing to unplug here.", x: 46, y: 36 },
];
const kwhYear = (w: number) => (w * 8760) / 1000;

/* ------------------------------------------------------------------ activities */

function Quiz({ id, title, questions, onDone, onBack }: { id: string; title: string; questions: Q[]; onDone: Done; onBack: () => void }) {
  const [round, setRound] = useState(0);
  const qs = useMemo(() => questions.map((q) => {
    const order = shuffle(q.o.map((_, i) => i));
    return { ...q, o: order.map((i) => q.o[i]), a: order.indexOf(q.a) };
  }), [questions, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [qi, setQi] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [res, setRes] = useState<any>(null);
  const q = qs[qi];
  const finished = qi >= qs.length;
  const pct = Math.round((score / qs.length) * 100);

  const next = async () => {
    const nx = qi + 1;
    setQi(nx); setPicked(null);
    if (nx === qs.length) setRes(await onDone(id, Math.round((score / qs.length) * 100)));
  };
  const again = () => { setRound(round + 1); setQi(0); setScore(0); setPicked(null); setRes(null); };

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardTitle right={!finished && <Badge>{qi + 1} / {qs.length}</Badge>}>{title}</CardTitle>
      {!finished ? (
        <div className="grid gap-2.5">
          <Progress value={qi / qs.length} className="mb-3" />
          <p className="mb-1 text-lg font-medium leading-snug">{q.q}</p>
          {q.o.map((o, k) => (
            <button key={o} disabled={picked !== null} onClick={() => { setPicked(k); if (k === q.a) setScore(score + 1); }}
              className={cn("flex items-center justify-between gap-3 rounded-xl border p-3.5 text-left text-sm font-medium transition",
                picked === null ? "border-line hover:border-ink/30 hover:bg-muted/50" : k === q.a ? "border-good bg-good/10" : k === picked ? "border-bad bg-bad/10" : "border-line opacity-50")}>
              {o}{picked !== null && k === q.a && <Check className="size-4 text-good" />}
            </button>
          ))}
          {picked !== null && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-1 rounded-xl bg-muted p-3.5 text-sm text-ink-2">
              <b className={picked === q.a ? "text-good" : "text-bad"}>{picked === q.a ? "Correct. " : "Not quite. "}</b>{q.why}
            </motion.div>
          )}
          {picked !== null && <Button className="mt-1 justify-self-start" onClick={next}>{qi + 1 === qs.length ? "See result" : "Next"}<ArrowRight /></Button>}
        </div>
      ) : (
        <Result score={pct} detail={`${score} of ${qs.length} correct`} res={res} onAgain={again} onBack={onBack} />
      )}
    </Card>
  );
}

function Result({ score, detail, res, onAgain, onBack }: { score: number; detail: string; res: any; onAgain: () => void; onBack: () => void }) {
  return (
    <div className="grid place-items-center gap-3 py-6 text-center">
      <span className={cn("grid size-14 place-items-center rounded-2xl", !res || res.passed ? "bg-good/12 text-good" : "bg-muted text-ink-3")}><Trophy className="size-6" /></span>
      <div className="text-3xl font-semibold tabular">{score} %</div>
      <p className="text-sm text-ink-2">{detail}</p>
      {!res ? <Skeleton className="h-6 w-40" /> : res.passed
        ? <p className="text-sm font-medium">{res.tokens > 0 ? <span className="text-good">+{res.tokens} tokens earned</span> : "Passed. Tokens are only paid the first time, or when today's limit is reached."}</p>
        : <p className="text-sm text-ink-2">You need {res.items.find((i: any) => i.id === res.id)?.pass ?? 60} % to pass. Have another go.</p>}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={onAgain}><RotateCcw />Play again</Button>
        <Button onClick={onBack}>Back to activities</Button>
      </div>
    </div>
  );
}

function VampireHunt({ onDone, onBack }: { onDone: Done; onBack: () => void }) {
  const [found, setFound] = useState<number[]>([]);
  const [misses, setMisses] = useState(0);
  const [msg, setMsg] = useState("Tap the 4 energy vampires: devices that keep drawing power while they look switched off.");
  const [res, setRes] = useState<any>(null);
  const items = useMemo(() => [...VAMPIRES.map((v, i) => ({ ...v, vamp: true, i })), ...DECOYS.map((d, i) => ({ ...d, vamp: false, i: 10 + i }))], []);
  const complete = found.length === VAMPIRES.length;
  const score = Math.max(50, 100 - 10 * misses);
  const total = VAMPIRES.reduce((s, v) => s + v.w, 0);

  const click = async (o: (typeof items)[number]) => {
    if (complete) return;
    if (!o.vamp) { setMisses(misses + 1); return setMsg(`${(o as any).why} Try again.`); }
    if (found.includes(o.i)) return;
    const f = [...found, o.i];
    setFound(f);
    const v = VAMPIRES[o.i];
    setMsg(`${v.name}: about ${n(v.w, v.w < 1 ? 1 : 0)} W on standby. ${VAMPIRES.length - f.length ? `${VAMPIRES.length - f.length} to go.` : ""}`);
    if (f.length === VAMPIRES.length) setRes(await onDone("jeu-vampires", Math.max(50, 100 - 10 * misses)));
  };
  const again = () => { setFound([]); setMisses(0); setRes(null); setMsg("Tap the 4 energy vampires: devices that keep drawing power while they look switched off."); };

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <Card>
        <CardTitle right={<Badge tone="brand">{found.length} / {VAMPIRES.length}</Badge>}>Vampire hunt</CardTitle>
        <div className="relative aspect-[16/10] overflow-hidden rounded-2xl" style={{ background: "linear-gradient(#fdf0d5 0 62%, #e3b98a 62%)" }}>
          {items.map((o) => {
            const hit = o.vamp && found.includes(o.i);
            return (
              <motion.button key={o.i} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={() => click(o)} aria-label={o.name}
                className="absolute text-[clamp(1.8rem,5vw,3rem)]" style={{ left: `${o.x}%`, top: `${o.y}%`, filter: hit ? "drop-shadow(0 0 10px #22c55e)" : undefined }}>
                {o.e}{hit && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-good text-white"><Check className="size-3" /></span>}
              </motion.button>
            );
          })}
        </div>
        <p className="mt-3 min-h-10 text-sm font-medium" aria-live="polite">{msg}</p>
      </Card>
      {complete && (
        <Card>
          <CardTitle>What these four cost you</CardTitle>
          <ul className="grid gap-2 text-sm">
            {VAMPIRES.map((v) => (
              <li key={v.name} className="flex items-center justify-between gap-3"><span>{v.e} {v.name}</span><span className="tabular text-ink-2">{n(v.w, v.w < 1 ? 1 : 0)} W · {n(kwhYear(v.w), 0)} kWh/year</span></li>
            ))}
            <li className="flex items-center justify-between gap-3 border-t border-line pt-2 font-medium"><span>Total</span><span className="tabular">{n(total, 1)} W · {n(kwhYear(total), 0)} kWh/year</span></li>
          </ul>
          <p className="mt-3 text-sm text-ink-2">One switched power strip turns all of them off at bedtime. Typical standby values; your own devices may differ.</p>
          <Result score={score} detail={misses ? `${misses} wrong ${misses === 1 ? "tap" : "taps"}` : "No wrong taps"} res={res} onAgain={again} onBack={onBack} />
        </Card>
      )}
    </div>
  );
}

function homeQuestions(devs: any[]): Q[] | null {
  const seen = new Set<string>();
  const d = devs.filter((x) => x.monitoring && x.month_kwh > 0.05 && !seen.has(x.name) && seen.add(x.name));
  if (d.length < 3) return null;
  const sorted = [...d].sort((a, b) => b.month_kwh - a.month_kwh);
  const top = sorted[0], low = sorted[sorted.length - 1];
  const total = d.reduce((s, x) => s + x.month_kwh, 0);
  const names = (must: any) => shuffle([must, ...shuffle(d.filter((x) => x !== must)).slice(0, 2)]).map((x) => x.name);
  const oTop = names(top), oLow = names(low);
  const share = Math.round((top.month_kwh / total) * 100);
  const buckets = [10, 25, 40, 55, 70, 85];
  const close = buckets.reduce((b, x) => (Math.abs(x - share) < Math.abs(b - share) ? x : b));
  const opts = shuffle([close, ...shuffle(buckets.filter((b) => b !== close)).slice(0, 2)]).map((b) => `About ${b} %`);
  return [
    { q: "Which of your devices has used the most energy this month?", o: oTop, a: oTop.indexOf(top.name), why: `${top.name}: ${n(top.month_kwh, 1)} kWh so far this month.` },
    { q: "And which one has used the least?", o: oLow, a: oLow.indexOf(low.name), why: `${low.name}: ${n(low.month_kwh, 2)} kWh so far this month.` },
    { q: `About what share of your measured energy this month is ${top.name}?`, o: opts, a: opts.indexOf(`About ${close} %`), why: `${top.name} is ${share} % of the ${n(total, 1)} kWh measured on your devices this month.` },
  ];
}

function HomeQuiz({ onDone, onBack }: { onDone: Done; onBack: () => void }) {
  const { data } = useApi<any>("devices");
  const qs = useMemo(() => (data ? homeQuestions(data.devices) : undefined), [data?.devices?.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return <Skeleton className="mx-auto h-72 max-w-2xl" />;
  if (!qs) return (
    <Card className="mx-auto grid max-w-2xl place-items-center gap-3 py-10 text-center">
      <b>This quiz needs at least 3 devices with some usage this month.</b>
      <p className="text-sm text-ink-2">Pair more devices and come back: the questions are about your own home.</p>
      <Button onClick={onBack}>Back to activities</Button>
    </Card>
  );
  return <Quiz id="quiz-maison" title="Know your home" questions={qs} onDone={onDone} onBack={onBack} />;
}

/* ------------------------------------------------------------------ bill simulator */

function BillSimulator() {
  const { data: me } = useMe();
  const { data: home } = useApi<any>("home");
  const [kwh, setKwh] = useState(150);
  const [kva, setKva] = useState<number | null>(null);
  const power = kva ?? me?.user?.household?.kva ?? 4;
  const q = useDebounced(`learn/bill?kwh=${kwh}&kva=${power}`, 150);
  const { data: b } = useApi<any>(q);
  const mine = home?.bill?.kwh ? Math.round(home.bill.kwh) : null;
  const bands: { upto: number | null; price: number }[] = b?.bands ?? [];
  const cap = 600;
  return (
    <Card>
      <CardTitle right={<Receipt className="size-4 text-ink-3" />}>Bill simulator</CardTitle>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid content-start gap-5">
          <div>
            <div className="mb-2 flex items-baseline justify-between"><label htmlFor="sim-kwh" className="text-[13px] font-medium text-ink-2">Consumption this month</label><b className="text-lg tabular">{kwh} kWh</b></div>
            <input id="sim-kwh" type="range" min={0} max={cap} step={5} value={kwh} onChange={(e) => setKwh(Number(e.target.value))} className="w-full accent-[var(--color-ink)]" />
            <div className="mt-1 flex justify-between text-[11px] text-ink-3"><span>0</span><span>{cap} kWh</span></div>
            {mine !== null && <Button variant="soft" size="sm" className="mt-2" onClick={() => setKwh(Math.min(cap, mine))}><HomeIcon />Use my month ({mine} kWh)</Button>}
          </div>
          <div>
            <span className="mb-2 block text-[13px] font-medium text-ink-2">Subscribed power</span>
            <div className="flex flex-wrap gap-2">{[...new Set([3, 6, 9, power])].sort((x, y) => x - y).map((k) => (
              <button key={k} onClick={() => setKva(k)} className={cn("rounded-full border px-3 py-1 text-xs font-medium", power === k ? "border-ink bg-ink text-bg" : "border-line hover:border-ink/30")}>{k} kVA</button>))}</div>
          </div>
        </div>
        <div>
          {!b ? <Skeleton className="h-52" /> : (
            <>
              <div className="text-xs text-ink-3">Estimated STEG bill</div>
              <div className="text-4xl font-semibold tracking-tight tabular">{tnd(b.total)}</div>
              <dl className="mt-3 grid gap-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-ink-2">Energy</dt><dd className="tabular">{tnd(b.energy)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-2">Power charge ({power} kVA)</dt><dd className="tabular">{tnd(b.power_charge)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-2">Taxes and VAT ({Math.round(b.vat_rate * 100)} %)</dt><dd className="tabular">{tnd(b.taxes)}</dd></div>
                <div className="flex justify-between border-t border-line pt-1.5 font-medium"><dt>Average per kWh</dt><dd className="tabular">{n(b.avg_price, 3)} DT</dd></div>
              </dl>
              <div className="mt-4">
                <div className="relative flex h-2.5 overflow-hidden rounded-full bg-muted">
                  {bands.map((x, i) => {
                    const from = i ? bands[i - 1].upto! : 0;
                    return <i key={i} className="h-full border-r border-card" style={{ width: `${((Math.min(x.upto ?? cap, cap) - from) / cap) * 100}%`, background: `color-mix(in oklch, var(--color-brand) ${15 + i * 16}%, var(--color-muted))` }} />;
                  })}
                  <i className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${Math.min(99.5, (kwh / cap) * 100)}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-ink-3"><span>cheaper kWh</span><span>dearer kWh</span></div>
              </div>
              {b.next && (
                <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-ink-2">
                  Using {b.next.at - kwh + 1} kWh more takes you over <b>{b.next.at} kWh</b>. Every kWh is then priced at {n(b.next.price, 3)} DT and the bill rises by about <b>{tnd(b.next.jump)}</b>.
                </p>
              )}
              <p className="mt-2 text-[11px] text-ink-3">Estimate from the <a className="underline" href={b.source_url} target="_blank" rel="noreferrer">published STEG tariff</a>, not an invoice.</p>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ page */

const META: Record<string, { blurb: string; icon: any }> = {
  "jeu-vampires": { blurb: "Spot the devices that drain power while off, and see what they cost.", icon: Ghost },
  "quiz-maison": { blurb: "Questions about your own devices and your own month.", icon: HomeIcon },
  ...Object.fromEntries(Object.entries(QUIZZES).map(([k, v]) => [k, { blurb: v.blurb, icon: v.icon }])),
};
const ORDER = ["jeu-vampires", "quiz-energie", "quiz-facture", "quiz-habitudes", "quiz-maison"];

export default function Learn() {
  const qc = useQueryClient();
  const { data: prog } = useApi<any>("learn");
  const [active, setActive] = useState<string | null>(null);

  const onDone: Done = async (item, score) => {
    try {
      const r = await api("learn/complete", { method: "POST", body: { item, score } });
      if (r.tokens) toast.success(`+${r.tokens} tokens`);
      qc.invalidateQueries();
      return { ...r, id: item };
    } catch (e: any) {
      toast.error(e.message);
      return { passed: false, tokens: 0, items: [], id: item };
    }
  };

  const items: any[] = prog?.items ?? [];
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const doneCount = items.filter((i) => i.done).length;
  const back = () => setActive(null);

  let body: ReactNode;
  if (active === "jeu-vampires") body = <VampireHunt onDone={onDone} onBack={back} />;
  else if (active === "quiz-maison") body = <HomeQuiz onDone={onDone} onBack={back} />;
  else if (active && QUIZZES[active]) body = <Quiz key={active} id={active} title={QUIZZES[active].title} questions={QUIZZES[active].questions} onDone={onDone} onBack={back} />;

  return (
    <div className="grid gap-5">
      {active ? <button onClick={back} className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-3 hover:text-ink">← All activities</button> : <BackLink to="/app/explorer">Explore</BackLink>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Learn</h1>
        {prog && !active && <span className="text-sm text-ink-3">{doneCount} of {items.length} done · <b className="text-ink">{prog.tokens_earned}</b> tokens earned here</span>}
      </div>
      {body ?? (
        <>
          {!prog ? <Skeleton className="h-48" /> : (
            <>
              <Progress value={items.length ? doneCount / items.length : 0} color="var(--color-good)" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ORDER.filter((id) => byId[id]).map((id) => {
                  const it = byId[id], m = META[id], Icon = m.icon;
                  return (
                    <button key={id} onClick={() => setActive(id)} className="group flex flex-col gap-3 rounded-2xl border border-line bg-card p-5 text-left transition hover:shadow-md">
                      <div className="flex items-start justify-between">
                        <span className="grid size-11 place-items-center rounded-2xl bg-muted"><Icon className="size-5" /></span>
                        {it.done ? <Badge tone="good"><Check />Done{it.score !== null ? ` · ${it.score} %` : ""}</Badge> : <Badge tone="brand">+{it.tokens} tokens</Badge>}
                      </div>
                      <div className="flex-1"><b className="block font-medium">{it.title}</b><span className="text-sm text-ink-3">{m.blurb}</span></div>
                      <span className="inline-flex items-center gap-1 text-sm font-medium">{it.done ? "Play again" : "Start"}<ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <BillSimulator />
        </>
      )}
    </div>
  );
}
