import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useMats } from "./useMats";
import type { ModelProps } from "./modelProps";
import { Disc, Feet, Led, RB } from "./parts";

const W = 0.597;
const HOLE_Y = 0.4;
const HOLE_R = 0.2;

function frontBlock() {
  const w = W - 0.008, h = 0.7, r = 0.012;
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const hole = new THREE.Path();
  hole.absarc(0, HOLE_Y - 0.37, HOLE_R, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth: 0.132, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 48 });
}

/** Front-loading washing machine, 60 × 58 × 85 cm. The drum turns while the
 * measured power says a cycle is running (static when motion is reduced). */
export function WashingMachine({ on, known, reduced }: ModelProps) {
  const m = useMats();
  const drum = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const front = useMemo(frontBlock, []);
  useEffect(() => () => front.dispose(), [front]);
  useEffect(() => invalidate(), [on, invalidate]);

  useFrame((_, dt) => {
    if (!on || reduced || !drum.current) return;
    drum.current.rotation.z += dt * 2.4;
  });

  return (
    <group>
      <Feet hx={0.26} z0={0.09} z1={0.52} h={0.02} />
      {/* cabinet: rear box, front block with porthole, control fascia, worktop */}
      <RB size={[W, 0.83, 0.41]} r={0.012} position={[0, 0.02 + 0.415, 0.03 + 0.205]} material={m.enamel} />
      <mesh geometry={front} position={[0, 0.02 + 0.35, 0.44]} material={m.enamel} />
      <RB size={[W, 0.13, 0.14]} r={0.01} position={[0, 0.72 + 0.065, 0.44 + 0.07]} material={m.whiteGloss} />
      <RB size={[W + 0.004, 0.012, 0.575]} r={0.005} position={[0, 0.856, 0.03 + 0.2875]} material={m.whitePlastic} />

      {/* rubber door seal and perforated drum seen through the opening */}
      <mesh position={[0, HOLE_Y, 0.505]} rotation-x={Math.PI / 2} material={m.gasket}>
        <cylinderGeometry args={[HOLE_R - 0.001, HOLE_R - 0.012, 0.128, 48, 1, true]} />
      </mesh>
      <group ref={drum} position={[0, HOLE_Y, 0.447]}>
        <mesh material={m.drum}>
          <circleGeometry args={[HOLE_R - 0.012, 48]} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <group key={i} rotation-z={(i * Math.PI * 2) / 3}>
            <RB size={[0.03, 0.1, 0.05]} r={0.012} position={[0, 0.13, 0.025]} material={m.inox} />
          </group>
        ))}
      </group>

      {/* door: chrome ring, tinted glass bowl, handle */}
      <group position={[0, HOLE_Y, 0.59]}>
        <mesh material={m.chrome}>
          <torusGeometry args={[0.188, 0.024, 20, 64]} />
        </mesh>
        <mesh rotation-x={Math.PI / 2} scale={[1, 0.24, 1]} material={m.glassDark}>
          <sphereGeometry args={[0.172, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <RB size={[0.03, 0.07, 0.02]} r={0.008} position={[0.195, 0, 0.012]} material={m.whitePlastic} />
      </group>

      {/* controls: detergent drawer, programme dial, display, buttons */}
      <group position={[0, 0.785, 0.58]}>
        <RB size={[0.17, 0.085, 0.012]} r={0.006} position={[-0.19, 0, 0.006]} material={m.whiteGloss} />
        <mesh position={[-0.19, -0.024, 0.0125]} material={m.darkGrey}>
          <planeGeometry args={[0.07, 0.012]} />
        </mesh>
        <mesh position={[0.02, 0, 0.004]} material={m.chrome}>
          <torusGeometry args={[0.034, 0.004, 12, 40]} />
        </mesh>
        <Disc r={0.03} depth={0.024} position={[0.02, 0, 0.012]} material={m.whiteGloss} />
        <RB size={[0.006, 0.02, 0.004]} r={0.002} position={[0.02, 0.018, 0.0255]} material={m.darkGrey} />
        <RB size={[0.11, 0.04, 0.004]} r={0.003} position={[0.165, 0.008, 0.002]} material={m.blackGloss} />
        {on && (
          <mesh position={[0.165, 0.008, 0.0045]}>
            <planeGeometry args={[0.08, 0.006]} />
            <meshStandardMaterial color="#000" emissive="#5fd1c1" emissiveIntensity={2.2} toneMapped={false} />
          </mesh>
        )}
        {[0.13, 0.165, 0.2].map((x) => <Disc key={x} r={0.007} depth={0.006} position={[x, -0.026, 0.003]} material={m.whitePlastic} />)}
        <Led position={[0.245, -0.026, 0.004]} color="#4ade80" on={on} size={0.003} dim={known ? 0.15 : 0.03} />
      </group>
    </group>
  );
}
