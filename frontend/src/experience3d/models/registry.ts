import type { ComponentType } from "react";
import { AirConditioner } from "./AirConditioner";
import { FloorLamp } from "./FloorLamp";
import { GameConsole } from "./GameConsole";
import { Laptop } from "./Laptop";
import { Microwave } from "./Microwave";
import type { ModelProps } from "./modelProps";
import { PhoneCharger } from "./PhoneCharger";
import { Radiator } from "./Radiator";
import { Refrigerator } from "./Refrigerator";
import { Router } from "./Router";
import { Television } from "./Television";
import { WashingMachine } from "./WashingMachine";
import { WaterHeater } from "./WaterHeater";

/**
 * Category code (m11/profiles.py CATALOG) → 3D model component.
 * Categories absent here have no model yet and are shown honestly as such:
 * compresseur, serveurs, machine_industrielle, eclairage_pro (Entreprise) and autre.
 * To replace a procedural model by a GLB later, register a component that
 * loads it (e.g. drei useGLTF) under the same code; nothing else changes.
 */
export const MODELS: Record<string, ComponentType<ModelProps>> = {
  refrigerateur: Refrigerator,
  climatisation: AirConditioner,
  television: Television,
  chauffe_eau: WaterHeater,
  chargeur: PhoneCharger,
  machine_a_laver: WashingMachine,
  ordinateur: Laptop,
  four: Microwave,
  radiateur: Radiator,
  routeur: Router,
  console: GameConsole,
  eclairage: FloorLamp,
};
