import { RoundedBox } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";
import * as THREE from "three";
import type { V3 } from "./catalog";
import { useMats } from "./useMats";

/** Small building blocks shared by the appliance models. */

type MeshProps = Omit<ThreeElements["mesh"], "args" | "ref">;

/** Rounded box; the radius is clamped so it never exceeds half the thinnest side. */
export function RB({ size, r = 0.004, ...props }: { size: V3; r?: number } & MeshProps) {
  const radius = Math.max(0.0004, Math.min(r, Math.min(...size) / 2 - 0.0004));
  return <RoundedBox args={size} radius={radius} smoothness={3} bevelSegments={2} {...props} />;
}

/** Cylinder whose axis points along +z (knobs, buttons, plugs). */
export function Disc({ r, depth, position, material, segments = 32 }: { r: number; depth: number; position: V3; material: THREE.Material; segments?: number }) {
  return (
    <mesh position={position} rotation-x={Math.PI / 2} material={material}>
      <cylinderGeometry args={[r, r, depth, segments]} />
    </mesh>
  );
}

/** Indicator LED with a soft additive halo; the halo only shows while lit. */
export function Led({ position, color, on, size = 0.0035, dim = 0.06 }: { position: V3; color: string; on: boolean; size?: number; dim?: number }) {
  const { tex } = useMats();
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[size, 12, 8]} />
        <meshStandardMaterial color="#0d0e10" emissive={color} emissiveIntensity={on ? 3.2 : dim} toneMapped={false} />
      </mesh>
      {on && (
        <sprite scale={size * 9}>
          <spriteMaterial map={tex.glow} color={color} blending={THREE.AdditiveBlending} depthWrite={false} transparent opacity={0.75} />
        </sprite>
      )}
    </group>
  );
}

/** Lit or dark display surface. Lit = abstract emissive gradient, never fake content. */
export function Screen({ size, position, rotation, on, map, strength = 1 }: {
  size: [number, number]; position: V3; rotation?: V3; on: boolean; map: THREE.Texture; strength?: number;
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={size} />
      {on
        ? <meshStandardMaterial color="#000000" emissive="#ffffff" emissiveMap={map} emissiveIntensity={strength} roughness={0.2} toneMapped={false} />
        : <meshPhysicalMaterial color="#050607" roughness={0.1} clearcoat={1} clearcoatRoughness={0.03} />}
    </mesh>
  );
}

/** Neutral gallery plinth (counter, desk or side-table height). */
export function Plinth({ w, h, d, x = 0, z = 0.03 }: { w: number; h: number; d: number; x?: number; z?: number }) {
  const m = useMats();
  return <RB size={[w, h, d]} r={0.006} position={[x, h / 2, z + d / 2]} material={m.plinth} />;
}

/** Four rubber feet under a box of the given half-extents. */
export function Feet({ hx, z0, z1, r = 0.012, h = 0.015 }: { hx: number; z0: number; z1: number; r?: number; h?: number }) {
  const m = useMats();
  const pts: [number, number][] = [[-hx, z0], [hx, z0], [-hx, z1], [hx, z1]];
  return (
    <>
      {pts.map(([x, z], i) => (
        <mesh key={i} position={[x, h / 2, z]} material={m.rubber}>
          <cylinderGeometry args={[r, r, h, 16]} />
        </mesh>
      ))}
    </>
  );
}
