import { useMats } from "./useMats";
import type { ModelProps } from "./modelProps";
import { Disc, Led, RB } from "./parts";

/** Oil-filled electric radiator on castors, 9 fins, 62 × 26 × 65 cm.
 * The pilot lamp lights while the element draws power. */
export function Radiator({ on }: ModelProps) {
  const m = useMats();
  const cz = 0.2;
  return (
    <group>
      {Array.from({ length: 9 }, (_, i) => (
        <RB key={i} size={[0.046, 0.55, 0.24]} r={0.02} position={[-0.23 + i * 0.0575, 0.08 + 0.275, cz]} material={m.paintedWhite} />
      ))}
      {[0.11, 0.6].map((y) => (
        <mesh key={y} position={[0, y, cz]} rotation-z={Math.PI / 2} material={m.paintedWhite}>
          <cylinderGeometry args={[0.02, 0.02, 0.5, 20]} />
        </mesh>
      ))}
      {/* control box: thermostat and power dials, pilot lamp */}
      <RB size={[0.075, 0.22, 0.17]} r={0.012} position={[-0.305, 0.5, cz]} material={m.whitePlastic} />
      <Disc r={0.017} depth={0.014} position={[-0.305, 0.565, cz + 0.091]} material={m.darkGrey} />
      <Disc r={0.017} depth={0.014} position={[-0.305, 0.495, cz + 0.091]} material={m.darkGrey} />
      <Led position={[-0.305, 0.43, cz + 0.087]} color="#ff9f1a" on={on} size={0.004} dim={0.05} />
      {/* base bars and castors */}
      {[-0.17, 0.17].map((x) => (
        <group key={x}>
          <RB size={[0.035, 0.025, 0.36]} r={0.008} position={[x, 0.058, cz]} material={m.spaceGrey} />
          {[-0.16, 0.16].map((dz) => (
            <mesh key={dz} position={[x, 0.023, cz + dz]} rotation-z={Math.PI / 2} material={m.rubber}>
              <cylinderGeometry args={[0.022, 0.022, 0.018, 20]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
