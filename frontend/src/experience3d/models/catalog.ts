/**
 * Metadata for each appliance category of the Mieruka catalog (`m11/profiles.py`
 * CATALOG). No three.js here, so the dashboard can read it without loading 3D.
 *
 * Units are metres. Every model's origin is its bottom-centre at the wall
 * (z = 0, the model extends toward +z). The models are GENERIC representations
 * of a category, built at typical real-world dimensions; they never claim to be
 * the user's exact appliance.
 */

export type V3 = [number, number, number];

export type CatalogEntry = {
  modelled: boolean;
  /** What the generic model depicts. */
  modelLabel: string;
  /** Real-world size the model was built at. */
  dims?: string;
  /** Width the model and its furniture occupy along the wall. */
  footprint: number;
  /** y of the model origin (wall-mounted units sit high). */
  elevation: number;
  /** Height of the wall socket holding the NABD adapter. */
  socketY: number;
  /** Power-cord entry point, relative to the model origin. */
  inlet: V3;
  /** Optional cord waypoints (relative to the model origin) so it routes around furniture. */
  via?: V3[];
  /** Camera framing when focused: centre x, centre y (relative to origin), width, height. */
  focus: [number, number, number, number];
  /** The appliance plugs straight into the adapter (phone charger). */
  atSocket?: boolean;
};

const MISSING: CatalogEntry = {
  modelled: false, modelLabel: "Aucun modèle 3D pour ce type d'appareil", footprint: 0.45, elevation: 0, socketY: 0.3,
  inlet: [0, 0, 0], focus: [-0.2, 0.42, 0.9, 0.75],
};

export const CATALOG: Record<string, CatalogEntry> = {
  refrigerateur: {
    modelled: true, modelLabel: "Réfrigérateur combiné posable, finition inox", dims: "60 × 65 × 185 cm",
    footprint: 0.6, elevation: 0, socketY: 0.3, inlet: [-0.22, 0.12, 0.04], focus: [0, 0.95, 0.8, 2.0],
  },
  climatisation: {
    modelled: true, modelLabel: "Unité intérieure murale de climatiseur split", dims: "80 × 20 × 28 cm",
    footprint: 0.8, elevation: 2.0, socketY: 1.85, inlet: [-0.36, 0.005, 0.07], focus: [0, 0.02, 1.15, 0.72],
  },
  television: {
    modelled: true, modelLabel: "Téléviseur 50 pouces sur meuble TV, avec décodeur", dims: "écran 112 × 65 cm",
    footprint: 1.4, elevation: 0, socketY: 0.3, inlet: [0, 0.6, 0.21],
    via: [[0, 0.04, 0.015], [0, 0.5, 0.015], [0, 0.56, 0.12]], focus: [0, 0.78, 1.6, 1.05],
  },
  chauffe_eau: {
    modelled: true, modelLabel: "Chauffe-eau électrique mural 80 L", dims: "Ø 45 × 100 cm",
    footprint: 0.48, elevation: 1.0, socketY: 1.25, inlet: [-0.18, 0.23, 0.24], focus: [0, 0.48, 0.8, 1.2],
  },
  chargeur: {
    modelled: true, modelLabel: "Chargeur USB-C et smartphone", dims: "chargeur 4 × 6 cm, téléphone 15 × 7 cm",
    footprint: 0.32, elevation: 0, socketY: 0.3, atSocket: true, inlet: [-0.078, 0.4575, 0.2],
    via: [[-0.19, 0.04, 0.2], [-0.172, 0.44, 0.2], [-0.12, 0.456, 0.2]], focus: [-0.24, 0.38, 0.85, 0.42],
  },
  machine_a_laver: {
    modelled: true, modelLabel: "Lave-linge hublot posable", dims: "60 × 58 × 85 cm",
    footprint: 0.6, elevation: 0, socketY: 0.3, inlet: [-0.22, 0.7, 0.03], via: [[-0.22, 0.04, 0.015]],
    focus: [0, 0.45, 0.8, 1.0],
  },
  ordinateur: {
    modelled: true, modelLabel: "Ordinateur portable 14 pouces", dims: "31 × 21 cm",
    footprint: 0.5, elevation: 0, socketY: 0.3, inlet: [-0.158, 0.758, 0.27],
    via: [[-0.27, 0.04, 0.3], [-0.265, 0.745, 0.3], [-0.2, 0.757, 0.28]], focus: [0, 0.84, 0.55, 0.36],
  },
  four: {
    modelled: true, modelLabel: "Four micro-ondes posable", dims: "48 × 36 × 28 cm",
    footprint: 0.6, elevation: 0, socketY: 0.3, inlet: [0.16, 1.0, 0.06],
    via: [[0.16, 0.04, 0.015], [0.16, 0.9, 0.015], [0.16, 0.97, 0.04]], focus: [0, 1.02, 0.7, 0.5],
  },
  radiateur: {
    modelled: true, modelLabel: "Radiateur électrique à bain d'huile", dims: "62 × 26 × 65 cm",
    footprint: 0.7, elevation: 0, socketY: 0.3, inlet: [-0.305, 0.39, 0.2], via: [[-0.31, 0.04, 0.22]],
    focus: [0, 0.36, 0.9, 0.8],
  },
  routeur: {
    modelled: true, modelLabel: "Box internet avec antennes", dims: "22 × 15 × 3,5 cm",
    footprint: 0.4, elevation: 0, socketY: 0.3, inlet: [-0.05, 0.52, 0.125],
    via: [[-0.05, 0.04, 0.015], [-0.05, 0.47, 0.015], [-0.05, 0.515, 0.08]], focus: [0, 0.6, 0.48, 0.32],
  },
  console: {
    modelled: true, modelLabel: "Console de salon et manette", dims: "30 × 26 × 7,5 cm",
    footprint: 0.55, elevation: 0, socketY: 0.3, inlet: [-0.13, 0.53, 0.09],
    via: [[-0.13, 0.04, 0.015], [-0.13, 0.48, 0.015], [-0.13, 0.52, 0.06]], focus: [0, 0.56, 0.64, 0.28],
  },
  eclairage: {
    modelled: true, modelLabel: "Lampadaire à abat-jour, ampoule LED", dims: "Ø 46 × 160 cm",
    footprint: 0.46, elevation: 0, socketY: 0.3, inlet: [-0.1, 0.012, 0.16], focus: [0, 0.85, 0.75, 1.8],
  },
};

export function catalogEntry(code: string): CatalogEntry {
  return CATALOG[code] ?? MISSING;
}

/** Display order inside a room: large floor appliances first, small electronics last. */
export const CATEGORY_ORDER = [
  "refrigerateur", "four", "machine_a_laver", "chauffe_eau", "climatisation", "television", "console", "routeur",
  "eclairage", "radiateur", "ordinateur", "chargeur",
];
