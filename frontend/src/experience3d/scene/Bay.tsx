import { useCursor } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useState } from "react";
import { visualState } from "../data/fromLive";
import type { SceneDevice } from "../data/types";
import { useMats } from "../models/useMats";
import { lcdText } from "../models/lcd";
import { NabdAdapter } from "../models/NabdAdapter";
import { MODELS } from "../models/registry";
import { EnergyCable } from "./EnergyCable";
import { FloorGlow, MissingTag, WallPool } from "./Gallery";
import type { Bay as BayLayout } from "./layout";

/** One installation: wall socket + NABD adapter + cord + generic appliance model. */
export function Bay({ bay, device, selected, onSelect, reduced, categoryLabel }: {
  bay: BayLayout; device: SceneDevice; selected: boolean; onSelect: (id: number) => void; reduced: boolean; categoryLabel: string;
}) {
  const m = useMats();
  const [hover, setHover] = useState(false);
  useCursor(hover);
  const vs = visualState(device);
  const Model = MODELS[bay.code];
  const [value, unit] = lcdText(device.powerW, device.monitoring);

  const events = {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.delta > 6) return; // end of a pan drag, not a tap
      onSelect(device.id);
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHover(true); },
    onPointerOut: () => setHover(false),
  };

  return (
    <group>
      <WallPool x={bay.centerX} width={bay.width} strength={selected ? 1 : hover ? 0.6 : 0.3} />
      {selected && <FloorGlow x={bay.modelX} width={bay.spec.footprint} />}
      <group position={[bay.socketX, bay.spec.socketY, 0]} {...events}>
        <NabdAdapter value={value} unit={unit} status={device.status} reduced={reduced} charger={bay.spec.atSocket} />
      </group>
      {Model ? (
        <>
          <group position={[bay.modelX, bay.spec.elevation, 0]} {...events}>
            <Model {...vs} reduced={reduced} />
          </group>
          <EnergyCable points={bay.cable} intensity={vs.intensity} anomaly={vs.anomaly} reduced={reduced}
            cord={bay.code === "television" || bay.code === "console" || bay.code === "routeur" ? m.cordDark : m.cord} />
        </>
      ) : (
        <group {...events}><MissingTag x={bay.modelX} category={categoryLabel} /></group>
      )}
    </group>
  );
}
