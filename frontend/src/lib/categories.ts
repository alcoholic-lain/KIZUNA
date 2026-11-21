import {
  AirVent, Cpu, Droplets, Factory, Flame, Gamepad2, Laptop, Lightbulb, Plug, Refrigerator, Server, Smartphone,
  Tv, WashingMachine, Wifi, CookingPot, type LucideIcon,
} from "lucide-react";

export const CAT: Record<string, { color: string; icon: LucideIcon }> = {
  climatisation: { color: "var(--color-c1)", icon: AirVent },
  chauffe_eau: { color: "var(--color-c2)", icon: Droplets },
  refrigerateur: { color: "var(--color-c3)", icon: Refrigerator },
  television: { color: "var(--color-c4)", icon: Tv },
  ordinateur: { color: "var(--color-c5)", icon: Laptop },
  machine_a_laver: { color: "var(--color-c6)", icon: WashingMachine },
  four: { color: "var(--color-c7)", icon: CookingPot },
  radiateur: { color: "var(--color-c8)", icon: Flame },
  console: { color: "var(--color-c8)", icon: Gamepad2 },
  chargeur: { color: "var(--color-c7)", icon: Smartphone },
  routeur: { color: "var(--color-c0)", icon: Wifi },
  eclairage: { color: "var(--color-c4)", icon: Lightbulb },
  compresseur: { color: "var(--color-c1)", icon: Factory },
  machine_industrielle: { color: "var(--color-c2)", icon: Cpu },
  eclairage_pro: { color: "var(--color-c4)", icon: Lightbulb },
  serveurs: { color: "var(--color-c5)", icon: Server },
  autre: { color: "var(--color-c0)", icon: Plug },
};
export const catOf = (c?: string | null) => CAT[c || "autre"] || CAT.autre;
const LABELS: Record<string, string> = {
  "Réfrigérateur": "refrigerateur", "Climatiseur réversible": "climatisation", "Ordinateur": "ordinateur",
  "Télévision et décodeur": "television", "Chargeur de téléphone": "chargeur", "Chauffe-eau électrique": "chauffe_eau",
  "Machine à laver": "machine_a_laver", "Four et micro-ondes": "four", "Radiateur électrique": "radiateur",
  "Console de jeux": "console", "Compresseur d'air": "compresseur", "Baie de serveurs": "serveurs",
  "Ligne de machines à coudre": "machine_industrielle", "Éclairage atelier": "eclairage_pro",
};
export const colorOfLabel = (label: string) => catOf(LABELS[label]).color;
export const codeOfLabel = (label: string) => LABELS[label] || "autre";
