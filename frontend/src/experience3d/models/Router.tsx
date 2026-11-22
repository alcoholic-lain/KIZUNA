import { useMats } from "./useMats";
import type { ModelProps } from "./modelProps";
import { Led, Plinth, RB } from "./parts";

/** Internet box / Wi-Fi router with two antennas, 22 × 15 × 3.5 cm, on a low plinth.
 * Status LEDs light while a live reading exists (always-on load). */
export function Router({ known }: ModelProps) {
  const m = useMats();
  return (
    <group>
      <Plinth w={0.4} h={0.5} d={0.36} />
      <group position={[0, 0.5, 0.21]}>
        <RB size={[0.22, 0.034, 0.15]} r={0.008} position={[0, 0.019, 0]} material={m.blackGloss} />
        <mesh position={[0, 0.0365, -0.01]} rotation-x={-Math.PI / 2} rotation-z={Math.PI / 2} material={m.grilleDark}>
          <planeGeometry args={[0.08, 0.16]} />
        </mesh>
        {[-0.06, -0.03, 0, 0.03, 0.06].map((x, i) => (
          <Led key={x} position={[x, 0.019, 0.0755]} color={i === 0 ? "#e5e7eb" : "#4ade80"} on={known} size={0.0018} dim={0.02} />
        ))}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.088, 0.034, -0.068]} rotation-z={-s * 0.14}>
            <mesh position={[0, 0.008, 0]} material={m.blackMatte}>
              <cylinderGeometry args={[0.0075, 0.0075, 0.016, 16]} />
            </mesh>
            <RB size={[0.016, 0.16, 0.009]} r={0.0044} position={[0, 0.095, 0]} material={m.blackMatte} />
          </group>
        ))}
      </group>
    </group>
  );
}
