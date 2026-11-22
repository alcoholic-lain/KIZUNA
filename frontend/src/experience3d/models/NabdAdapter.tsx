import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { DeviceStatus } from "../data/types";
import { useMats } from "./useMats";
import { Disc, RB } from "./parts";

/**
 * The NABD measuring adapter (the physical device Mieruka actually reads),
 * plugged into a wall socket. Proportions follow the existing prototype in
 * assets/3d/prototype.html: white plug-through body, small screen above a
 * Schuko outlet. The screen shows the live reading from the API, nothing else.
 */

const STATUS_COLOR: Record<DeviceStatus, string> = {
  marche: "#43d17a", veille: "#43d17a", pause: "#8b8f97", anomalie: "#ff4d3d", inconnu: "#8b8f97",
};

function drawLcd(ctx: CanvasRenderingContext2D, value: string, unit: string) {
  const { width: w, height: h } = ctx.canvas;
  ctx.fillStyle = "#0c1411";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#c7f7dc";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "right";
  const big = value.length > 5 ? 40 : 54;
  ctx.font = `600 ${big}px "Geist Mono Variable", ui-monospace, monospace`;
  ctx.fillText(value, unit ? w - 44 : w - 12, h - 30);
  if (unit) {
    ctx.font = `500 24px "Geist Mono Variable", ui-monospace, monospace`;
    ctx.fillText(unit, w - 10, h - 30);
  }
}

export function NabdAdapter({ value, unit, status, reduced, charger }: {
  value: string; unit: string; status: DeviceStatus; reduced: boolean; charger?: boolean;
}) {
  const m = useMats();
  const invalidate = useThree((s) => s.invalidate);
  const led = useRef<THREE.MeshStandardMaterial>(null);
  const [ctx, tex] = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 192;
    c.height = 136;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return [c.getContext("2d") as CanvasRenderingContext2D, t] as const;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  useEffect(() => {
    const draw = () => { drawLcd(ctx, value, unit); tex.needsUpdate = true; invalidate(); };
    draw();
    document.fonts?.ready.then(draw).catch(() => {});
  }, [ctx, tex, value, unit, invalidate]);

  useFrame(({ clock }) => {
    if (!led.current) return;
    const base = status === "veille" ? 0.6 : status === "pause" || status === "inconnu" ? 0.25 : 2.6;
    led.current.emissiveIntensity = status === "anomalie" && !reduced ? 1.2 + 1.4 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 4)) : base;
  });

  return (
    <group>
      {/* wall socket plate */}
      <RB size={[0.082, 0.082, 0.01]} r={0.008} position={[0, 0, 0.005]} material={m.socketPlate} />
      {/* adapter body */}
      <RB size={[0.06, 0.1, 0.042]} r={0.01} position={[0, 0, 0.031]} material={m.whiteGloss} />
      <RB size={[0.044, 0.034, 0.003]} r={0.003} position={[0, 0.024, 0.0525]} material={m.blackSatin} />
      <mesh position={[0, 0.024, 0.0542]}>
        <planeGeometry args={[0.04, 0.0283]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* status LED */}
      <mesh position={[-0.022, 0.003, 0.0525]}>
        <sphereGeometry args={[0.0022, 10, 8]} />
        <meshStandardMaterial ref={led} color="#0d0e10" emissive={STATUS_COLOR[status]} emissiveIntensity={1} toneMapped={false} />
      </mesh>
      {/* Schuko outlet */}
      <Disc r={0.019} depth={0.004} position={[0, -0.02, 0.051]} material={m.darkGrey} />
      {charger ? (
        <group position={[0, -0.02, 0.053]}>
          <RB size={[0.042, 0.058, 0.03]} r={0.007} position={[0, 0, 0.015]} material={m.whiteGloss} />
          <mesh position={[0, -0.034, 0.025]} material={m.cord}>
            <cylinderGeometry args={[0.0045, 0.0045, 0.012, 12]} />
          </mesh>
        </group>
      ) : (
        <Disc r={0.017} depth={0.03} position={[0, -0.02, 0.068]} material={m.whitePlastic} />
      )}
    </group>
  );
}
