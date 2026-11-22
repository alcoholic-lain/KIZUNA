import type { VisualState } from "../data/types";

/** Props every appliance model receives. Models only show what VisualState allows:
 * an indicator lights up only when `known && on`, nothing animates when `reduced`. */
export type ModelProps = VisualState & { reduced: boolean };
