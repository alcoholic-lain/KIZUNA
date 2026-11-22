/** Data shapes shared by the 3D experience. No three.js imports here: this
 * module is used by the regular (non-lazy) dashboard bundle. */

export type MeasurementSource = "simulee" | "reelle" | "inconnue";

/** Usage status derived only from fields the API actually returned. */
export type DeviceStatus = "marche" | "veille" | "pause" | "anomalie" | "inconnu";

/** One installation (appliance + NABD adapter) as the scene sees it. */
export type SceneDevice = {
  id: number;
  adapterId: string;
  name: string;
  category: string;
  room: string;
  /** Live watts from the API; null when the API sent none (paused measurement, missing value). */
  powerW: number | null;
  /** API `on` flag: power above the appliance's in-use threshold. */
  inUse: boolean;
  monitoring: boolean;
  anomaly: boolean;
  optimised: boolean;
  todayKwh: number | null;
  monthKwh: number | null;
  source: MeasurementSource;
  status: DeviceStatus;
};

/** What a 3D model is allowed to show, derived from a SceneDevice. */
export type VisualState = {
  /** A live reading exists, so the scene may show a state at all. */
  known: boolean;
  /** Known and above the in-use threshold. */
  on: boolean;
  /** 0..1, log-scaled from measured watts; 0 when unknown. Drives the energy flow. */
  intensity: number;
  anomaly: boolean;
};
