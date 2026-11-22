import * as THREE from "three";
import { useMats } from "./useMats";
import type { ModelProps } from "./modelProps";

/** Floor lamp with a fabric drum shade and LED bulb, Ø 46 × 160 cm.
 * While it draws power the bulb, shade and a small warm point light come on. */
export function FloorLamp({ on }: ModelProps) {
  const m = useMats();
  const z = 0.25;
  return (
    <group>
      <mesh position={[0, 0.011, z]} material={m.blackSatin}>
        <cylinderGeometry args={[0.14, 0.15, 0.022, 48]} />
      </mesh>
      <mesh position={[0, 0.022 + 0.69, z]} material={m.brass}>
        <cylinderGeometry args={[0.0095, 0.0095, 1.38, 16]} />
      </mesh>
      <mesh position={[0, 1.52, z]}>
        <cylinderGeometry args={[0.2, 0.23, 0.28, 64, 1, true]} />
        <meshStandardMaterial color="#efe6d6" roughness={0.95} side={THREE.DoubleSide}
          emissive="#ffcf8f" emissiveIntensity={on ? 0.85 : 0} />
      </mesh>
      {[1.38, 1.66].map((y, i) => (
        <mesh key={y} position={[0, y, z]} rotation-x={Math.PI / 2} material={m.brass}>
          <torusGeometry args={[i ? 0.2 : 0.23, 0.003, 8, 64]} />
        </mesh>
      ))}
      <mesh position={[0, 1.47, z]}>
        <sphereGeometry args={[0.032, 24, 16]} />
        <meshStandardMaterial color="#f7f3ea" emissive="#ffe2b0" emissiveIntensity={on ? 3 : 0} roughness={0.3} toneMapped={!on} />
      </mesh>
      {on && <pointLight position={[0, 1.47, z]} color="#ffcf8a" intensity={1.6} distance={3.5} decay={2} />}
    </group>
  );
}
