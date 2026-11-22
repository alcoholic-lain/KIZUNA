import { useMats } from "./useMats";
import type { ModelProps } from "./modelProps";
import { Led, RB, Screen } from "./parts";

/** 50-inch LED TV on a low oak TV unit, with a set-top box ("TV + set-top box").
 * Screen panel 112 × 65 cm, unit 140 × 40 × 45 cm. */
export function Television({ on, known }: ModelProps) {
  const m = useMats();
  const unitZ = 0.03, unitD = 0.4, unitTop = 0.45;
  const tvZ = unitZ + 0.2;
  return (
    <group>
      {/* TV unit: body, door seams, legs */}
      <RB size={[1.4, 0.38, unitD]} r={0.008} position={[0, 0.07 + 0.19, unitZ + unitD / 2]} material={m.oak} />
      {[-0.233, 0.233].map((x) => (
        <mesh key={x} position={[x, 0.26, unitZ + unitD + 0.0005]} material={m.blackMatte}>
          <planeGeometry args={[0.003, 0.34]} />
        </mesh>
      ))}
      <mesh position={[0, 0.418, unitZ + unitD + 0.0005]} material={m.blackMatte}>
        <planeGeometry args={[1.36, 0.008]} />
      </mesh>
      {([[-0.64, 0.08], [0.64, 0.08], [-0.64, 0.38], [0.64, 0.38]] as const).map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.035, z]} material={m.blackSatin}>
          <cylinderGeometry args={[0.012, 0.009, 0.07, 16]} />
        </mesh>
      ))}

      {/* television */}
      <group position={[0, unitTop, tvZ]}>
        {[-0.46, 0.46].map((x) => (
          <RB key={x} size={[0.03, 0.065, 0.2]} r={0.006} position={[x, 0.0325, 0]} rotation-z={x > 0 ? -0.2 : 0.2} material={m.spaceGrey} />
        ))}
        <RB size={[1.125, 0.655, 0.026]} r={0.004} position={[0, 0.06 + 0.3275, 0]} material={m.blackSatin} />
        <RB size={[0.72, 0.42, 0.04]} r={0.02} position={[0, 0.36, -0.026]} material={m.blackMatte} />
        <Screen size={[1.105, 0.622]} position={[0, 0.0625 + 0.3275 + 0.004, 0.0132]} on={on} map={m.tex.tvScreen} strength={0.85} />
        {/* standby LED: red while the TV is known to be idle */}
        <Led position={[0, 0.066, 0.0135]} color="#ff3b30" on={known && !on} size={0.0018} dim={0.02} />
      </group>

      {/* set-top box */}
      <group position={[0.5, unitTop, unitZ + 0.22]}>
        <RB size={[0.2, 0.038, 0.15]} r={0.006} position={[0, 0.021, 0]} material={m.blackSatin} />
        <Led position={[0.075, 0.021, 0.0755]} color="#4ade80" on={on} size={0.0016} dim={0.03} />
      </group>
    </group>
  );
}
