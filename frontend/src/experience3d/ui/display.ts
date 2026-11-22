import { watts } from "@/lib/format";
import type { DeviceStatus, SceneDevice } from "../data/types";

export const STATUS_DOT: Record<DeviceStatus, string> = {
  marche: "bg-good", veille: "bg-good/50", pause: "bg-white/30", anomalie: "bg-bad", inconnu: "bg-white/30",
};

/** Live power as shown everywhere in the experience; never a guessed value. */
export const powerText = (d: SceneDevice) => (!d.monitoring ? "Pause" : d.powerW === null ? "–" : watts(d.powerW));
