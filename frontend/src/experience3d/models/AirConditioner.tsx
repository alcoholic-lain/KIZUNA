import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useMats } from "./useMats";
import type { ModelProps } from "./modelProps";
import { Led, RB } from "./parts";

/** Wall-mounted split air-conditioner indoor unit. 80 × 20 × 28 cm.
 * The air-outlet flap opens while the measured power says the unit is running. */
export function AirConditioner({ on, known, reduced }: ModelProps) {
  const m = useMats();
  const flap = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const target = on ? -1.0 : 0;

  useEffect(() => {
    if (reduced && flap.current) {
      flap.current.rotation.x = target;
      invalidate();
    }
  }, [reduced, target, invalidate]);

  useFrame((_, dt) => {
    if (reduced || !flap.current) return;
    flap.current.rotation.x = THREE.MathUtils.damp(flap.current.rotation.x, target, 2.5, dt);
  });

  return (
    <group>
      {/* upper body and rear lower body; the front-bottom stays open for the outlet */}
      <RB size={[0.8, 0.23, 0.2]} r={0.035} position={[0, 0.165, 0.1]} material={m.whiteGloss} />
      <RB size={[0.8, 0.07, 0.115]} r={0.02} position={[0, 0.035, 0.0575]} material={m.whiteGloss} />
      {/* end caps */}
      {[-1, 1].map((s) => <RB key={s} size={[0.04, 0.08, 0.2]} r={0.018} position={[s * 0.38, 0.045, 0.1]} material={m.whiteGloss} />)}
      {/* front panel, slightly proud of the body */}
      <RB size={[0.785, 0.19, 0.012]} r={0.005} position={[0, 0.175, 0.2015]} material={m.whiteGloss} />
      {/* top air intake grille */}
      <mesh position={[0, 0.2805, 0.095]} rotation-x={-Math.PI / 2} rotation-z={Math.PI / 2} material={m.grilleLight}>
        <planeGeometry args={[0.13, 0.72]} />
      </mesh>
      {/* outlet throat and vertical vanes */}
      <mesh position={[0, 0.03, 0.155]} material={m.darkGrey}>
        <boxGeometry args={[0.72, 0.05, 0.08]} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[-0.32 + i * 0.08, 0.026, 0.17]} material={m.whitePlastic}>
          <boxGeometry args={[0.003, 0.04, 0.05]} />
        </mesh>
      ))}
      {/* outlet flap, hinged at its top edge */}
      <group ref={flap} position={[0, 0.056, 0.199]}>
        <RB size={[0.72, 0.052, 0.006]} r={0.0025} position={[0, -0.026, 0]} material={m.whiteGloss} />
      </group>
      {/* display window with power LED (no set-point is shown: the API has none) */}
      <RB size={[0.07, 0.022, 0.003]} r={0.002} position={[0.29, 0.1, 0.2085]} material={m.blackGloss} />
      <Led position={[0.31, 0.1, 0.2105]} color="#8fd8ff" on={on} dim={known ? 0.25 : 0.04} size={0.0028} />
    </group>
  );
}
