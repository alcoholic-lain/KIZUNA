const nf = new Map<number, Intl.NumberFormat>();
export function n(x: number | null | undefined, d = 0) {
  if (x === null || x === undefined || Number.isNaN(x)) return "–";
  if (!nf.has(d)) nf.set(d, new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }));
  return nf.get(d)!.format(x);
}
export const kwh = (x: number, d?: number) => `${n(x, d ?? (Math.abs(x) < 10 ? 2 : Math.abs(x) < 100 ? 1 : 0))} kWh`;
export const watts = (x: number | null) => (x === null ? "–" : x >= 1000 ? `${n(x / 1000, 2)} kW` : `${n(x, x < 10 ? 1 : 0)} W`);
export const tnd = (x: number, d = 2) => `${n(x, d)} DT`;
export const pct = (x: number, d = 0) => `${n(x * 100, d)} %`;

const TZ = "Africa/Tunis";
export const time = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
export const timeS = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: TZ });
export const day = (iso: string) => new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: TZ });
export const weekday = (iso: string) => new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", timeZone: TZ });
export const dateTime = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ });
export function ago(iso: string, now?: string) {
  const s = ((now ? new Date(now) : new Date()).getTime() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}
export function change(cur: number, prev: number) {
  if (!prev) return null;
  return (cur / prev - 1) * 100;
}
