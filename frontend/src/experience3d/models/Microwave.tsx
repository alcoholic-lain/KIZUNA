import { useMats } from "./useMats";
import type { ModelProps } from "./modelProps";
import { Disc, Feet, Plinth, RB } from "./parts";

/** Countertop microwave oven, 48 × 36 × 28 cm, on a counter-height plinth.
 * The cavity lamp glows through the door while it draws power. */
export function Microwave({ on }: ModelProps) {
  const m = useMats();
  const D = 0.36;
  return (
    <group>
      <Plinth w={0.6} h={0.9} d={0.5} />
      <group position={[0, 0.9, 0.06]}>
        <Feet hx={0.2} z0={0.05} z1={D - 0.05} r={0.01} h={0.01} />
        <RB size={[0.48, 0.27, D]} r={0.012} position={[0, 0.01 + 0.135, D / 2]} material={m.blackMatte} />
        {/* right-side vents */}
        <mesh position={[0.2405, 0.17, 0.12]} rotation-y={Math.PI / 2} material={m.grilleDark}>
          <planeGeometry args={[0.12, 0.12]} />
        </mesh>
        {/* door with window */}
        <RB size={[0.355, 0.255, 0.016]} r={0.006} position={[-0.0575, 0.145, D + 0.008]} material={m.blackGloss} />
        {/* cavity (lit while running) seen through the perforated door screen */}
        <mesh position={[-0.075, 0.145, D + 0.0162]}>
          <planeGeometry args={[0.25, 0.165]} />
          {on
            ? <meshStandardMaterial color="#000" emissive="#ffa940" emissiveIntensity={0.55} roughness={0.4} toneMapped={false} />
            : <meshStandardMaterial color="#0d0f11" roughness={0.5} />}
        </mesh>
        <mesh position={[-0.075, 0.145, D + 0.0166]} material={m.doorScreen}>
          <planeGeometry args={[0.25, 0.165]} />
        </mesh>
        <mesh position={[-0.075, 0.145, D + 0.0169]}>
          <planeGeometry args={[0.25, 0.165]} />
          <meshPhysicalMaterial color="#000" transparent opacity={0.15} roughness={0.05} clearcoat={1} depthWrite={false} />
        </mesh>
        <RB size={[0.016, 0.2, 0.018]} r={0.007} position={[0.11, 0.145, D + 0.03]} material={m.aluminium} />
        {[0.075, 0.215].map((y) => (
          <mesh key={y} position={[0.11, y, D + 0.019]} rotation-x={Math.PI / 2} material={m.aluminium}>
            <cylinderGeometry args={[0.005, 0.005, 0.012, 12]} />
          </mesh>
        ))}
        {/* control panel: display (lit, no invented digits), dial, buttons */}
        <RB size={[0.11, 0.255, 0.012]} r={0.004} position={[0.178, 0.145, D + 0.006]} material={m.blackSatin} />
        <mesh position={[0.178, 0.23, D + 0.0125]}>
          <planeGeometry args={[0.075, 0.026]} />
          {on
            ? <meshStandardMaterial color="#000" emissive="#ffcf6e" emissiveIntensity={0.45} toneMapped={false} />
            : <meshPhysicalMaterial color="#050607" roughness={0.1} clearcoat={1} />}
        </mesh>
        <Disc r={0.022} depth={0.018} position={[0.178, 0.135, D + 0.021]} material={m.aluminium} />
        <RB size={[0.004, 0.014, 0.003]} r={0.0015} position={[0.178, 0.149, D + 0.031]} material={m.blackSatin} />
        {[0.165, 0.191].map((x) => <RB key={x} size={[0.022, 0.012, 0.005]} r={0.002} position={[x, 0.065, D + 0.0145]} material={m.darkGrey} />)}
      </group>
    </group>
  );
}
