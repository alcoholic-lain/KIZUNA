import { useMats } from "./useMats";
import { Feet, RB } from "./parts";

/** Freestanding bottom-freezer fridge, brushed stainless doors. 60 × 65 × 185 cm.
 * A running compressor has no visible sign on a real fridge, so none is invented;
 * its state shows on the adapter screen and the cord. */
export function Refrigerator() {
  const m = useMats();
  const W = 0.595, D = 0.6, z0 = 0.035, doorD = 0.05;
  const front = z0 + D;
  const hz = front + doorD;
  return (
    <group>
      <Feet hx={0.25} z0={z0 + 0.06} z1={front - 0.06} h={0.02} />
      {/* cabinet */}
      <RB size={[W, 1.78, D]} r={0.012} position={[0, 0.07 + 0.89, z0 + D / 2]} material={m.inoxDark} />
      {/* gasket line visible in the door gaps */}
      <mesh position={[0, 0.955, front + 0.0015]} material={m.rubber}>
        <planeGeometry args={[W - 0.012, 1.765]} />
      </mesh>
      {/* kick plate grille */}
      <mesh position={[0, 0.042, front - 0.012]} material={m.grilleDark}>
        <boxGeometry args={[W - 0.03, 0.05, 0.02]} />
      </mesh>
      {/* freezer door (bottom) and fridge door (top), 6 mm gap */}
      <RB size={[W, 0.655, doorD]} r={0.012} position={[0, 0.07 + 0.3275, front + doorD / 2]} material={m.inox} />
      <RB size={[W, 1.103, doorD]} r={0.012} position={[0, 0.731 + 0.5515, front + doorD / 2]} material={m.inox} />
      {/* bar handles with stand-offs */}
      {([[0.98, 0.4, 0.84, 1.12], [0.585, 0.22, 0.5, 0.67]] as const).map(([y, len, a, b], i) => (
        <group key={i}>
          <RB size={[0.02, len, 0.022]} r={0.009} position={[0.245, y, hz + 0.03]} material={m.aluminium} />
          {[a, b].map((sy) => (
            <mesh key={sy} position={[0.245, sy, hz + 0.0095]} rotation-x={Math.PI / 2} material={m.aluminium}>
              <cylinderGeometry args={[0.0065, 0.0065, 0.019, 16]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* hinge covers */}
      <RB size={[0.05, 0.012, 0.045]} r={0.004} position={[-0.255, 1.856, front + 0.02]} material={m.blackSatin} />
      <RB size={[0.05, 0.012, 0.045]} r={0.004} position={[-0.255, 0.727, front + 0.026]} material={m.blackSatin} />
    </group>
  );
}
