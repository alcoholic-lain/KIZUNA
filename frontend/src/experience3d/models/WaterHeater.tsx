import { useMats } from "./useMats";
import type { ModelProps } from "./modelProps";
import { Led, RB } from "./parts";

/** Vertical wall-mounted 80 L electric storage water heater. Ø 45 × 100 cm incl. pipes.
 * The heating indicator lights while the element draws power. */
export function WaterHeater({ on }: ModelProps) {
  const m = useMats();
  const R = 0.225;
  const cz = R + 0.035;
  return (
    <group>
      {/* wall brackets */}
      {[0.42, 0.84].map((y) => <RB key={y} size={[0.3, 0.04, 0.035]} r={0.004} position={[0, y, 0.0175]} material={m.spaceGrey} />)}
      {/* tank: cylinder + domed ends */}
      <mesh position={[0, 0.61, cz]} material={m.enamel}>
        <cylinderGeometry args={[R, R, 0.62, 64]} />
      </mesh>
      <mesh position={[0, 0.92, cz]} scale={[1, 0.28, 1]} material={m.enamel}>
        <sphereGeometry args={[R, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, 0.3, cz]} scale={[1, 0.28, 1]} material={m.enamel}>
        <sphereGeometry args={[R, 48, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
      </mesh>
      {[0.3, 0.92].map((y) => (
        <mesh key={y} position={[0, y, cz]} rotation-x={Math.PI / 2} material={m.whitePlastic}>
          <torusGeometry args={[R, 0.0035, 8, 64]} />
        </mesh>
      ))}
      {/* thermostat cover with knob and heating lamp */}
      <mesh position={[0, 0.235, cz]} material={m.whitePlastic}>
        <cylinderGeometry args={[0.2, 0.17, 0.07, 48]} />
      </mesh>
      <mesh position={[0.07, 0.235, cz + 0.184]} rotation-x={Math.PI / 2} rotation-z={0.5} material={m.darkGrey}>
        <cylinderGeometry args={[0.018, 0.018, 0.014, 24]} />
      </mesh>
      <Led position={[-0.05, 0.236, cz + 0.186]} color="#ff9f1a" on={on} size={0.005} dim={0.05} />
      {/* cold (blue) and hot (red) pipes, safety valve on the cold inlet */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.055, 0, cz]}>
          <mesh position={[0, 0.1, 0]} material={m.chrome}>
            <cylinderGeometry args={[0.011, 0.011, 0.2, 16]} />
          </mesh>
          <mesh position={[0, 0.165, 0]} material={s < 0 ? m.blueMark : m.redMark}>
            <cylinderGeometry args={[0.0135, 0.0135, 0.012, 16]} />
          </mesh>
        </group>
      ))}
      <RB size={[0.036, 0.05, 0.034]} r={0.004} position={[-0.055, 0.075, cz]} material={m.brass} />
      <RB size={[0.04, 0.008, 0.012]} r={0.003} position={[-0.08, 0.09, cz + 0.02]} material={m.redMark} />
    </group>
  );
}
