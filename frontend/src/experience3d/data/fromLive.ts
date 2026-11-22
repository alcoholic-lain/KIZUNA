import type { DeviceStatus, MeasurementSource, SceneDevice, VisualState } from "./types";

/**
 * Adapter between the existing `GET /api/live` payload (`devices` array built by
 * `m14.services.device_row`) and the 3D scene.
 *
 * Rules: nothing is invented. A value the API did not send stays null and is
 * shown as unavailable; the measurement source is passed through as-is.
 */

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

function sourceOf(v: unknown): MeasurementSource {
  return v === "simulee" || v === "reelle" ? v : "inconnue";
}

function statusOf(monitoring: boolean, powerW: number | null, inUse: boolean, anomaly: boolean): DeviceStatus {
  if (anomaly) return "anomalie";
  if (!monitoring) return "pause";
  if (powerW === null) return "inconnu";
  return inUse ? "marche" : "veille";
}

export function fromLiveDevices(raw: unknown): SceneDevice[] {
  if (!Array.isArray(raw)) return [];
  const out: SceneDevice[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const id = num(o.id);
    if (id === null) continue;
    const monitoring = o.monitoring === true;
    const powerW = num(o.power);
    const inUse = o.on === true;
    const anomaly = o.anomaly === true;
    out.push({
      id,
      adapterId: str(o.adapter, "—"),
      name: str(o.name, "Appareil"),
      category: str(o.category, "autre"),
      room: str(o.room),
      powerW,
      inUse,
      monitoring,
      anomaly,
      optimised: o.fixed === true,
      todayKwh: num(o.today_kwh),
      monthKwh: num(o.month_kwh),
      source: sourceOf(o.source),
      status: statusOf(monitoring, powerW, inUse, anomaly),
    });
  }
  return out;
}

const LOG_MAX = Math.log10(1 + 2500);

export function visualState(d: SceneDevice): VisualState {
  const known = d.monitoring && d.powerW !== null;
  const intensity = known ? Math.min(1, Math.max(0, Math.log10(1 + (d.powerW as number)) / LOG_MAX)) : 0;
  return { known, on: known && d.inUse, intensity, anomaly: d.anomaly };
}

/** Overall label for the measurement origin of a device set. */
export function sourceSummary(devices: SceneDevice[]): MeasurementSource | "mixte" {
  const s = new Set(devices.map((d) => d.source));
  if (s.size === 1) return [...s][0];
  if (s.has("simulee") && s.has("reelle")) return "mixte";
  return "inconnue";
}

export const STATUS_LABEL: Record<DeviceStatus, string> = {
  marche: "Running",
  veille: "Standby",
  pause: "Measurement paused",
  anomalie: "Anomaly detected",
  inconnu: "Measurement unavailable",
};

export const SOURCE_LABEL: Record<MeasurementSource | "mixte", string> = {
  simulee: "Simulated data",
  reelle: "Real measurements",
  mixte: "Simulated and real",
  inconnue: "Source not specified",
};
