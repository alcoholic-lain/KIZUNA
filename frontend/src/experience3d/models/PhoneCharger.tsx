import { useMats } from "./useMats";
import type { ModelProps } from "./modelProps";
import { Plinth, RB, Screen } from "./parts";

/** Smartphone on a side table, charging through a USB-C cable. The charger
 * brick itself is drawn plugged into the NABD adapter (see NabdAdapter `charger`).
 * Phone 15 × 7 cm. The screen glows softly while current flows. */
export function PhoneCharger({ on }: ModelProps) {
  const m = useMats();
  return (
    <group>
      <Plinth w={0.3} h={0.45} d={0.32} />
      <group position={[0, 0.45, 0.2]} rotation-y={0.08}>
        <RB size={[0.15, 0.008, 0.072]} r={0.0035} position={[0, 0.004, 0]} material={m.spaceGrey} />
        <Screen size={[0.143, 0.066]} position={[0, 0.0082, 0]} rotation={[-Math.PI / 2, 0, 0]} on={on} map={m.tex.phoneScreen} strength={0.5} />
        <RB size={[0.02, 0.005, 0.008]} r={0.002} position={[-0.085, 0.004, 0]} material={m.cord} />
      </group>
    </group>
  );
}
