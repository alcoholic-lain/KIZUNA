import { useMats } from "./useMats";
import type { ModelProps } from "./modelProps";
import { Plinth, RB, Screen } from "./parts";

/** 14-inch aluminium laptop, open, on a desk-height plinth. 31 × 21 cm. */
export function Laptop({ on }: ModelProps) {
  const m = useMats();
  return (
    <group>
      <Plinth w={0.5} h={0.75} d={0.42} />
      <group position={[0, 0.75, 0.27]}>
        <RB size={[0.312, 0.0155, 0.215]} r={0.006} position={[0, 0.00775, 0]} material={m.spaceGrey} />
        <mesh position={[0, 0.0157, -0.022]} rotation-x={-Math.PI / 2} material={m.keyboard}>
          <planeGeometry args={[0.272, 0.106]} />
        </mesh>
        <mesh position={[0, 0.0157, 0.062]} rotation-x={-Math.PI / 2} material={m.trackpad}>
          <planeGeometry args={[0.112, 0.068]} />
        </mesh>
        {/* lid, hinged at the back edge, tilted about 110° open */}
        <group position={[0, 0.0155, -0.104]} rotation-x={-0.33}>
          <RB size={[0.312, 0.212, 0.0055]} r={0.005} position={[0, 0.106, -0.003]} material={m.spaceGrey} />
          <mesh position={[0, 0.106, 0.0003]} material={m.blackGloss}>
            <planeGeometry args={[0.302, 0.202]} />
          </mesh>
          <Screen size={[0.29, 0.181]} position={[0, 0.108, 0.0006]} on={on} map={m.tex.laptopScreen} strength={0.72} />
        </group>
      </group>
    </group>
  );
}
