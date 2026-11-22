import { Check, Gauge, Lightbulb, ShieldCheck, Wrench } from "lucide-react";
import { useAction } from "@/lib/api";
import { catOf } from "@/lib/categories";
import { dateTime, n, timeS, watts } from "@/lib/format";
import { Lines } from "./charts";
import { Badge, Button, Dialog, SEVERITY_LABEL, SEVERITY_TONE } from "./ui";

export function AlertRow({ a, onOpen, now }: { a: any; onOpen: () => void; now?: string }) {
  const C = catOf(a.category);
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-xl border border-line bg-card p-3 text-left transition hover:border-ink/20 hover:shadow-sm">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in oklch, ${a.severity === "info" ? "var(--color-info)" : "var(--color-bad)"} 12%, transparent)`, color: a.severity === "info" ? "var(--color-info)" : "var(--color-bad)" }}>
        <C.icon className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-sm font-medium">{a.title}</b>
        <span className="text-xs text-ink-3">{a.cause}</span>
      </span>
      <Badge tone={SEVERITY_TONE[a.severity]}>{SEVERITY_LABEL[a.severity]}</Badge>
    </button>
  );
}

export function AlertPanel({ alert, onClose }: { alert: any | null; onClose: () => void }) {
  const act = useAction();
  if (!alert) return null;
  const ev = alert.evidence || {};
  const readings = (ev.readings || []).filter((r: any) => r[1] !== null).map((r: any) => ({ x: r[0], w: r[1] }));
  const diff = alert.measured != null && alert.expected != null ? alert.measured - alert.expected : null;
  const open = alert.status === "ouverte";
  const fmt = (v: number | null) => (v == null ? "–" : alert.unit === "W" ? watts(v) : `${n(v)} ${alert.unit}`);
  return (
    <Dialog open={!!alert} onOpenChange={(o) => !o && onClose()} side title={alert.title}>
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
          <Badge tone={SEVERITY_TONE[alert.severity]}>{SEVERITY_LABEL[alert.severity]}</Badge>
          {alert.device && <span>{alert.device}</span>}<span>·</span><span>{dateTime(alert.detected_at)}</span>
          {!open && <Badge tone="good"><Check />{alert.status === "appliquee" ? "Fixed" : "Handled"}</Badge>}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[["Measured", fmt(alert.measured), "text-bad"], ["Usual", fmt(alert.expected), ""], ["Gap", diff == null ? "–" : `+${fmt(diff)}`, "text-bad"]].map(([l, v, c]) => (
            <div key={l} className="rounded-xl bg-muted p-3"><div className="text-xs text-ink-3">{l}</div><div className={`text-lg font-semibold tabular ${c}`}>{v}</div></div>
          ))}
        </div>
        {readings.length > 2 && (
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-ink-3"><span>Readings (every 5 s)</span><span>{ev.rule}</span></div>
            <Lines data={readings} height={180} unit="W" xFormat={(v) => timeS(v).slice(3)}
              keys={[{ key: "w", name: "Power", color: "var(--color-bad)" }]}
              refs={[{ y: ev.baseline, label: "Usual", color: "var(--color-good)" }, { y: ev.threshold, label: "Threshold +35%", color: "var(--color-warn)" }]} />
          </div>
        )}
        <div className="grid gap-2">
          <Row icon={Gauge} label="Confidence" value={`${n(alert.confidence * 100)} %`} />
          {alert.cause && <Row icon={Wrench} label="Likely cause" value={alert.cause} />}
          {alert.action && <Row icon={Lightbulb} label="Action" value={alert.action} />}
          {alert.kwh_month > 0 && <Row icon={Gauge} label="At stake" value={`${n(alert.kwh_month, 1)} kWh/month`} />}
        </div>
        {open && (
          <div className="grid gap-2">
            {alert.action_code && alert.action_code !== "voir_conseils" && (
              <Button size="lg" variant="good" disabled={act.isPending}
                onClick={() => act.mutate({ path: `alerts/${alert.id}/apply` }, { onSuccess: onClose })}>
                <Check />{alert.kind === "daily_limit" ? "Enable eco mode (simulation)" : "Apply the fix"}
              </Button>
            )}
            {alert.kind === "daily_limit" && (
              <p className="text-center text-xs leading-relaxed text-ink-3">
                Activation is simulated on the monitored computers. No device is controlled.
              </p>
            )}
            <Button variant="ghost" disabled={act.isPending}
              onClick={() => act.mutate({ path: `alerts/${alert.id}/ignore`, success: "Alert dismissed" }, { onSuccess: onClose })}>
              Dismiss
            </Button>
            {alert.kind !== "daily_limit" && (
              <p className="flex items-center justify-center gap-1.5 text-xs text-ink-3"><ShieldCheck className="size-3.5" />Mieruka never cuts the power</p>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm">
      <Icon className="mt-0.5 size-4 text-ink-3" />
      <span className="w-28 shrink-0 text-ink-3">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
