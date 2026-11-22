import * as DialogP from "@radix-ui/react-dialog";
import * as SwitchP from "@radix-ui/react-switch";
import * as TabsP from "@radix-ui/react-tabs";
import * as TooltipP from "@radix-ui/react-tooltip";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { ArrowLeft, Info, X } from "lucide-react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { forwardRef, useEffect, type ReactNode } from "react";
import { Link } from "react-router";
import { n } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ Button */
const button = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/50 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-ink text-bg hover:bg-ink/85 shadow-sm",
        brand: "bg-brand text-white hover:bg-brand/90 shadow-sm shadow-brand/30",
        good: "bg-good text-white hover:bg-good/90 shadow-sm",
        outline: "border border-line bg-card hover:bg-muted",
        ghost: "hover:bg-muted",
        soft: "bg-muted hover:bg-line/70",
        danger: "text-bad hover:bg-bad/10",
      },
      size: { default: "h-10 px-4", sm: "h-8 px-3 text-[13px] rounded-lg", lg: "h-12 px-6 text-[15px]", icon: "size-9" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button> & { asChild?: boolean };
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const C = asChild ? Slot : "button";
  return <C ref={ref} className={cn(button({ variant, size }), className)} {...props} />;
});

/* ------------------------------------------------------------------ Card */
export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]", className)} {...p}>{children}</div>;
}
export function CardTitle({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-3", className)}>
      <h3 className="text-[13px] font-medium text-ink-2">{children}</h3>
      {right}
    </div>
  );
}

/* ------------------------------------------------------------------ Badge */
const badge = cva("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap [&_svg]:size-3", {
  variants: {
    tone: {
      neutral: "bg-muted text-ink-2",
      good: "bg-good/12 text-good",
      warn: "bg-warn/15 text-[oklch(0.55_0.14_65)] dark:text-warn",
      bad: "bg-bad/12 text-bad",
      info: "bg-info/12 text-info",
      brand: "bg-brand/10 text-brand",
    },
  },
  defaultVariants: { tone: "neutral" },
});
export function Badge({ tone, className, children }: VariantProps<typeof badge> & { className?: string; children: ReactNode }) {
  return <span className={cn(badge({ tone }), className)}>{children}</span>;
}
export const SEVERITY_TONE: Record<string, "bad" | "warn" | "info" | "neutral"> = { critique: "bad", elevee: "bad", attention: "warn", info: "info" };
export const SEVERITY_LABEL: Record<string, string> = { critique: "Critical", elevee: "High", attention: "Warning", info: "Info" };

/* ------------------------------------------------------------------ Tooltip / info */
export function Tip({ children, content }: { children: ReactNode; content: ReactNode }) {
  return (
    <TooltipP.Root delayDuration={150}>
      <TooltipP.Trigger asChild>{children}</TooltipP.Trigger>
      <TooltipP.Portal>
        <TooltipP.Content sideOffset={6} className="z-50 max-w-72 rounded-lg bg-ink px-3 py-2 text-xs leading-relaxed text-bg shadow-xl animate-in fade-in">
          {content}
          <TooltipP.Arrow className="fill-ink" />
        </TooltipP.Content>
      </TooltipP.Portal>
    </TooltipP.Root>
  );
}
export function InfoTip({ content }: { content: ReactNode }) {
  return (
    <Tip content={content}>
      <button className="inline-flex text-ink-3 hover:text-ink" aria-label="Details"><Info className="size-3.5" /></button>
    </Tip>
  );
}
export const TipProvider = TooltipP.Provider;

/* ------------------------------------------------------------------ Dialog & Sheet */
export function Dialog({ open, onOpenChange, title, children, wide, side }: {
  open: boolean; onOpenChange: (o: boolean) => void; title?: ReactNode; children: ReactNode; wide?: boolean; side?: boolean;
}) {
  return (
    <DialogP.Root open={open} onOpenChange={onOpenChange}>
      <DialogP.Portal>
        <DialogP.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-[fade_.15s]" />
        <DialogP.Content
          aria-describedby={undefined}
          className={cn(
            "fixed z-50 bg-card shadow-2xl outline-none",
            side
              ? "inset-y-0 right-0 w-full max-w-xl overflow-y-auto border-l border-line p-6"
              : cn("left-1/2 top-1/2 max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl p-6", wide ? "max-w-3xl" : "max-w-md"),
          )}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <DialogP.Title className="text-lg font-semibold tracking-tight">{title}</DialogP.Title>
            <DialogP.Close className="rounded-lg p-1 text-ink-3 hover:bg-muted hover:text-ink" aria-label="Fermer"><X className="size-4" /></DialogP.Close>
          </div>
          {children}
        </DialogP.Content>
      </DialogP.Portal>
    </DialogP.Root>
  );
}

/* ------------------------------------------------------------------ Tabs */
export function Tabs({ value, onValueChange, items, className }: { value: string; onValueChange: (v: string) => void; items: [string, ReactNode][]; className?: string }) {
  return (
    <TabsP.Root value={value} onValueChange={onValueChange}>
      <TabsP.List className={cn("inline-flex rounded-xl bg-muted p-1", className)}>
        {items.map(([k, l]) => (
          <TabsP.Trigger key={k} value={k} className="relative rounded-lg px-3.5 py-1.5 text-[13px] font-medium text-ink-2 transition data-[state=active]:bg-card data-[state=active]:text-ink data-[state=active]:shadow-sm cursor-pointer">
            {l}
          </TabsP.Trigger>
        ))}
      </TabsP.List>
    </TabsP.Root>
  );
}

/* ------------------------------------------------------------------ Form bits */
export function Switch({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <SwitchP.Root checked={checked} onCheckedChange={onCheckedChange} className="relative h-6 w-10 rounded-full bg-line transition data-[state=checked]:bg-good cursor-pointer">
      <SwitchP.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition data-[state=checked]:translate-x-[18px]" />
    </SwitchP.Root>
  );
}
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn("h-10 w-full rounded-xl border border-line bg-card px-3 text-sm outline-none transition placeholder:text-ink-3 focus:border-info focus:ring-2 focus:ring-info/20", className)} {...p} />
));
export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {error && <span className="text-xs text-bad">{error}</span>}
    </label>
  );
}
export function Progress({ value, className, color = "var(--color-ink)", marker }: { value: number; className?: string; color?: string; marker?: number }) {
  return (
    <div className={cn("relative h-2 overflow-hidden rounded-full bg-muted", className)}>
      <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
      {marker !== undefined && <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${Math.min(99.5, marker * 100)}%` }} />}
    </div>
  );
}

/* ------------------------------------------------------------------ Numbers */
export function AnimatedNumber({ value, decimals = 0, className }: { value: number; decimals?: number; className?: string }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => n(v, decimals));
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.8, ease: "easeOut" });
    return () => c.stop();
  }, [value, mv]);
  return <motion.span className={cn("tabular", className)}>{text}</motion.span>;
}

export function Delta({ value, invert, unit = "%" }: { value: number | null; invert?: boolean; unit?: string }) {
  if (value === null || !Number.isFinite(value)) return null;
  const up = value > 0;
  const good = invert ? up : !up;
  if (Math.abs(value) < 0.5) return <span className="text-xs text-ink-3">stable</span>;
  return (
    <span className={cn("inline-flex items-center text-xs font-medium tabular", good ? "text-good" : "text-bad")}>
      {up ? "↑" : "↓"} {n(Math.abs(value), Math.abs(value) < 10 ? 1 : 0)} {unit}
    </span>
  );
}

export function Stat({ label, value, unit, sub, info, className }: { label: ReactNode; value: ReactNode; unit?: string; sub?: ReactNode; info?: ReactNode; className?: string }) {
  return (
    <Card className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center gap-1.5 text-[13px] text-ink-2">{label}{info && <InfoTip content={info} />}</div>
      <div className="text-[28px] font-semibold leading-tight tracking-tight tabular">
        {value}{unit && <span className="ml-1 text-base font-medium text-ink-3">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-ink-3">{sub}</div>}
    </Card>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return <span className={cn("inline-block size-2 rounded-full bg-good animate-pulse-ring", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-muted", className)} />;
}

export function Empty({ icon: Icon, title, children }: { icon: any; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <div className="grid size-11 place-items-center rounded-2xl bg-muted text-ink-3"><Icon className="size-5" /></div>
      <p className="font-medium">{title}</p>
      {children}
    </div>
  );
}

/** "← Parent" link shown above sub-pages so the way back is always visible. */
export function BackLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cn("inline-flex w-fit items-center gap-1.5 text-sm text-ink-3 hover:text-ink", className)}>
      <ArrowLeft className="size-4" />{children}
    </Link>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
