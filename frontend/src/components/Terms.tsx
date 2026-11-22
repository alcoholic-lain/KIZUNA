import { Check, FileText } from "lucide-react";
import { useState } from "react";
import { Button, Dialog, Skeleton } from "@/components/ui";
import { useApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type TermsDoc = { version: string; updated: string; sections: { title: string; body: string[] }[] };

export function TermsDialog({ open, onOpenChange, onAgree }: { open: boolean; onOpenChange: (o: boolean) => void; onAgree?: () => void }) {
  const { data } = useApi<TermsDoc>("terms", { enabled: open });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Terms and conditions" wide>
      {!data ? <Skeleton className="h-64" /> : (
        <>
          <p className="-mt-3 mb-4 text-xs text-ink-3">Version {data.version} · updated {new Date(data.updated).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
          <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-2 text-sm leading-relaxed text-ink-2">
            {data.sections.map((s) => (
              <section key={s.title}>
                <h3 className="mb-1.5 font-medium text-ink">{s.title}</h3>
                {s.body.map((p) => <p key={p} className="mb-2 last:mb-0">{p}</p>)}
              </section>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            {onAgree && <Button onClick={() => { onAgree(); onOpenChange(false); }}><Check />I agree</Button>}
          </div>
        </>
      )}
    </Dialog>
  );
}

/** Checkbox + "view terms" link. `locked` shows an already-given consent that cannot be unticked here. */
export function TermsConsent({ checked, onChange, error, locked, note }: {
  checked: boolean; onChange: (v: boolean) => void; error?: string; locked?: boolean; note?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <label className={cn("flex items-center gap-2.5 text-sm", locked ? "cursor-default" : "cursor-pointer")}>
          <input type="checkbox" checked={checked} disabled={locked} onChange={(e) => onChange(e.target.checked)}
            className="size-4 shrink-0 rounded accent-[var(--color-ink)] disabled:opacity-100" />
          <span>I agree to the terms and conditions</span>
        </label>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm text-info underline-offset-2 hover:underline">
          <FileText className="size-3.5" />View terms and conditions
        </button>
      </div>
      {note && <p className="pl-[26px] text-xs text-ink-3">{note}</p>}
      {error && <p className="pl-[26px] text-xs text-bad">{error}</p>}
      <TermsDialog open={open} onOpenChange={setOpen} onAgree={locked || checked ? undefined : () => onChange(true)} />
    </div>
  );
}
