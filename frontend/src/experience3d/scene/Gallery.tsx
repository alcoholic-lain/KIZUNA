import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useMats } from "../models/useMats";
import type { RoomSpan } from "./layout";

/** The room the appliances stand in: floor, wall, skirting, room names, light pools. */

export const BACKGROUND = "#16171c";
const WALL_H = 3.2;

/** Canvas-drawn text on a plane (no font files, no network). */
function useTextTexture(lines: { text: string; font: string; color: string }[], w: number, h: number) {
  const invalidate = useThree((s) => s.invalidate);
  const key = JSON.stringify(lines);
  const [ctx, tex] = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return [c.getContext("2d") as CanvasRenderingContext2D, t] as const;
  }, [w, h]);
  useEffect(() => () => tex.dispose(), [tex]);
  useEffect(() => {
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      let y = 0;
      for (const l of lines) {
        ctx.font = l.font;
        ctx.fillStyle = l.color;
        const size = parseInt(l.font.match(/(\d+)px/)?.[1] ?? "32", 10);
        y += size * 1.25;
        ctx.fillText(l.text, 4, y - size * 0.25, w - 8);
      }
      tex.needsUpdate = true;
      invalidate();
    };
    draw();
    document.fonts?.ready.then(draw).catch(() => {});
    // `key` is the stable identity of `lines`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, tex, key, w, h, invalidate]);
  return tex;
}

/** Room name from the API, kept inside its own room's span so neighbours never overlap. */
function RoomLabel({ text, x, span }: { text: string; x: number; span: number }) {
  // Same text size everywhere: the canvas narrows with the room instead of the glyphs shrinking.
  const w = Math.min(1.6, Math.max(0.4, span - 0.12));
  const tex = useTextTexture([{ text, font: '600 46px "Geist Variable", system-ui, sans-serif', color: "rgba(255,255,255,0.7)" }],
    Math.round((512 * w) / 1.6), 64);
  return (
    <mesh position={[x + 0.05 + w / 2, 2.48, 0.004]}>
      <planeGeometry args={[w, 0.2]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

export function MissingTag({ x, category }: { x: number; category: string }) {
  const tex = useTextTexture([
    { text: "3D model not available", font: '600 34px "Geist Variable", system-ui, sans-serif', color: "rgba(255,255,255,0.82)" },
    { text: category, font: '400 28px "Geist Variable", system-ui, sans-serif', color: "rgba(255,255,255,0.55)" },
  ], 512, 110);
  return (
    <group position={[x, 0.62, 0.006]}>
      <mesh>
        <planeGeometry args={[0.5, 0.15]} />
        <meshBasicMaterial color="#1f2126" toneMapped={false} />
      </mesh>
      <mesh position={[0.01, 0, 0.001]}>
        <planeGeometry args={[0.46, 0.099]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function WallPool({ x, width, strength }: { x: number; width: number; strength: number }) {
  const { tex } = useMats();
  return (
    <mesh position={[x, 1.45, 0.003]}>
      <planeGeometry args={[Math.min(1.6, width * 0.95), 2.9]} />
      <meshBasicMaterial map={tex.pool} color="#fff1dc" transparent opacity={0.05 + 0.1 * strength}
        blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

export function FloorGlow({ x, width }: { x: number; width: number }) {
  const { tex } = useMats();
  return (
    <mesh position={[x, 0.002, 0.55]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[width + 0.6, 1.1]} />
      <meshBasicMaterial map={tex.glow} color="#f5b335" transparent opacity={0.22}
        blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

export function Room({ width, rooms }: { width: number; rooms: RoomSpan[] }) {
  const m = useMats();
  const W = width + 14;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 4]} material={m.floor}>
        <planeGeometry args={[W, 8]} />
      </mesh>
      <mesh position={[0, WALL_H / 2, 0]} material={m.wall}>
        <planeGeometry args={[W, WALL_H]} />
      </mesh>
      <mesh position={[0, 0.035, 0.006]} material={m.skirting}>
        <boxGeometry args={[W, 0.07, 0.012]} />
      </mesh>
      {rooms.filter((r) => r.label).map((r) => <RoomLabel key={`${r.label}${r.x0}`} text={r.label} x={r.x0} span={r.x1 - r.x0} />)}
    </group>
  );
}
