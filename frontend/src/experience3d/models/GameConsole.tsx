import { useMats } from "./useMats";
import type { ModelProps } from "./modelProps";
import { Led, Plinth, RB } from "./parts";

/** Generic home games console (horizontal) with a gamepad, on a low plinth.
 * 30 × 26 × 7.5 cm. Deliberately unbranded. Front light strip shows "in use". */
export function GameConsole({ on, known }: ModelProps) {
  const m = useMats();
  return (
    <group>
      <Plinth w={0.55} h={0.5} d={0.4} />
      <group position={[-0.08, 0.5, 0.22]}>
        <RB size={[0.3, 0.068, 0.26]} r={0.012} position={[0, 0.036, 0]} material={m.blackSatin} />
        <RB size={[0.292, 0.006, 0.252]} r={0.0028} position={[0, 0.072, 0]} material={m.darkGrey} />
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.1505, 0.036, 0]} rotation-y={s * Math.PI / 2} material={m.grilleDark}>
            <planeGeometry args={[0.2, 0.04]} />
          </mesh>
        ))}
        <mesh position={[-0.02, 0.022, 0.1305]}>
          <planeGeometry args={[0.2, 0.0028]} />
          <meshStandardMaterial color="#111" emissive="#cfe6ff" emissiveIntensity={on ? 2.4 : 0} toneMapped={false} />
        </mesh>
        <Led position={[0.12, 0.022, 0.131]} color="#ffffff" on={known && !on} size={0.0016} dim={0.03} />
      </group>
      {/* gamepad */}
      <group position={[0.17, 0.5, 0.26]} rotation-y={-0.45}>
        <RB size={[0.1, 0.024, 0.055]} r={0.011} position={[0, 0.016, 0]} material={m.blackSatin} />
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.045, 0.014, 0.03]} rotation-x={Math.PI / 2 - 0.35} rotation-z={s * 0.35} material={m.blackSatin}>
            <capsuleGeometry args={[0.017, 0.035, 6, 16]} />
          </mesh>
        ))}
        {[-0.022, 0.022].map((x) => (
          <mesh key={x} position={[x, 0.03, 0.012]} material={m.darkGrey}>
            <cylinderGeometry args={[0.009, 0.008, 0.008, 20]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
