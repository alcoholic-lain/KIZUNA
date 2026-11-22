import { ContactShadows, Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { SceneDevice } from "../data/types";
import { MaterialsProvider } from "../models/materials";
import { Bay } from "./Bay";
import { CameraRig } from "./CameraRig";
import { BACKGROUND, Room } from "./Gallery";
import { framingFor, layoutGallery } from "./layout";

/**
 * Lazy-loaded root of the 3D device gallery. Pure visualisation: it receives
 * devices already fetched by React (no API calls in here) and reports
 * selection back through `onSelect`.
 */
export type DeviceSceneProps = {
  devices: SceneDevice[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  reducedMotion: boolean;
  /** Visible on screen and tab in foreground. Off-screen → no rendering at all. */
  active: boolean;
  categoryLabels: Record<string, string>;
  onContextLost: () => void;
  label: string;
  /** Pixels on the left covered by an overlay panel (desktop detail panel). */
  insetLeft: number;
  onPannable: (pannable: boolean) => void;
};

/** Keeps a value identity stable while `key` is unchanged. */
function useStable<T>(value: T, key: string): T {
  const ref = useRef({ key, value });
  if (ref.current.key !== key) ref.current = { key, value };
  return ref.current.value;
}

function Lighting() {
  return (
    <>
      <hemisphereLight args={["#e4e9f0", "#141518", 0.45]} />
      <directionalLight position={[2.5, 5, 6]} intensity={1.5} color="#fff4e6" />
      <directionalLight position={[-4, 3, 4]} intensity={0.4} color="#d6e4ff" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[0, 4.5, 4]} scale={[10, 2.5, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#fff1dd" position={[-6, 2, 3]} scale={[3, 4, 1]} />
        <Lightformer form="rect" intensity={1.0} color="#e3ecff" position={[6, 2, 3]} scale={[3, 4, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[0, 1.4, 7]} scale={[14, 3.5, 1]} />
      </Environment>
    </>
  );
}

/** Re-renders once when the scene becomes active again (demand mode). */
function Wake({ active }: { active: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => { if (active) invalidate(); }, [active, invalidate]);
  return null;
}

export default function DeviceScene({ devices, selectedId, onSelect, reducedMotion, active, categoryLabels, onContextLost, label, insetLeft, onPannable }: DeviceSceneProps) {
  const [dpr, setDpr] = useState(1.5);
  const shape = devices.map((d) => `${d.id}:${d.category}:${d.room}:${d.name}`).join("|");
  const stableDevices = useStable(devices, shape);
  const layout = useMemo(() => layoutGallery(stableDevices), [stableDevices]);
  const byId = new Map(devices.map((d) => [d.id, d]));
  const framing = useMemo(() => framingFor(layout, selectedId), [layout, selectedId]);
  const frameloop = !active ? "never" : reducedMotion ? "demand" : "always";

  return (
    <Canvas
      role="img"
      aria-label={label}
      style={{ touchAction: "pan-y" }}
      frameloop={frameloop}
      dpr={[1, dpr]}
      gl={{ antialias: true, alpha: false, powerPreference: "default" }}
      camera={{ fov: 32, near: 0.05, far: 80, position: [0, 1.6, 9] }}
      onPointerMissed={() => onSelect(null)}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); onContextLost(); }, { once: true });
      }}
    >
      <color attach="background" args={[BACKGROUND]} />
      <fog attach="fog" args={[BACKGROUND, 9, 30]} />
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} />
      <Wake active={active} />
      <MaterialsProvider>
        <Lighting />
        <Room width={layout.width} rooms={layout.rooms} />
        {layout.bays.map((b) => {
          const d = byId.get(b.id);
          if (!d) return null;
          return (
            <Bay key={b.id} bay={b} device={d} selected={b.id === selectedId} onSelect={onSelect} reduced={reducedMotion}
              categoryLabel={categoryLabels[b.code] ?? d.name} />
          );
        })}
        <ContactShadows key={shape} position={[0, 0.001, 1.5]} scale={[layout.width + 3, 3]} far={2.2} blur={2.2}
          opacity={0.6} resolution={1024} frames={1} color="#000000" />
      </MaterialsProvider>
      <CameraRig framing={framing} overview={selectedId === null || !byId.has(selectedId)} galleryWidth={layout.width}
        insetLeft={selectedId !== null ? insetLeft : 0} reduced={reducedMotion} onPannable={onPannable} />
    </Canvas>
  );
}
