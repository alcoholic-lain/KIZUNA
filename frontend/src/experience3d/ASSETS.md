# 3D assets: sources and licences

All 3D models, materials and textures used by the immersive experiment were
**authored for Mieruka in this repository**. No third-party model, texture, HDR
environment, font file or 3D asset is downloaded, bundled or loaded at runtime.

| Asset | How it is made | Source | Licence / attribution |
|---|---|---|---|
| 12 appliance models (`models/*.tsx`) | Procedural three.js geometry (rounded boxes, cylinders, lathe/extrude shapes) built at typical real-world dimensions | Written for this project | Project code; no third-party rights |
| NABD adapter (`models/NabdAdapter.tsx`) | Procedural geometry; proportions follow the existing project prototype `assets/3d/prototype.html` | Project | Project code |
| PBR materials (`models/library.ts`) | `MeshStandardMaterial` / `MeshPhysicalMaterial` parameters | Project | Project code |
| Textures (brushed steel, grilles, keyboard, oak, drum perforation, door screen, screen gradients, glow, light pools, LCD, labels) | Drawn on `<canvas>` at runtime | Project | Project code |
| Environment lighting | drei `<Environment>` rendered from `<Lightformer>` rectangles (no HDR file) | Project | Project code |
| Libraries | `three@0.186.1` (MIT), `@react-three/fiber@9.8.2` (MIT), `@react-three/drei@10.7.9` (MIT) | npm | MIT, attribution in their package licences |

## External libraries evaluated and not used

Poly Haven (CC0) was surveyed through its public API on 2026-11-22 (522 models):

- `Television_01`, `television_02`, `classic_laptop` and `vintage_microwave` are
  explicitly vintage (CRT, beige 1970s). They would misrepresent the modern
  appliances of the Mieruka catalogue.
- `exterior_aircon_unit` is a 1.8 m commercial outdoor unit, not a domestic split indoor unit.
- `gaming_console` (31k triangles) and `lightbulb_led` are modern and CC0, so they are usable.
  They were not used to keep one consistent visual language across all models.
  They are candidates for a later GLB swap (see README, "Replacing a model with a GLB").

No refrigerator, water heater, washing machine, split-AC indoor unit or Wi-Fi
router with a clear commercial-use licence was found in that library.

## Honesty rules for models

- Every model is a **generic representation of a category**. The UI says so next
  to each model ("Modèle 3D générique … Ce n'est pas le modèle exact de votre appareil").
- Models are unbranded. No manufacturer logo, trade dress or specific product is reproduced.
- Indicators (LEDs, lit screens, open AC flap, turning drum, lamp light) appear only
  when the API reports a live reading above the appliance's in-use threshold.
  Screens show an abstract glow, never invented content or numbers.

## Missing models (reported, not substituted)

These catalogue categories have no 3D model yet. The scene shows the NABD adapter
with its live reading and a "Modèle 3D non disponible" tag instead:

- `compresseur` (Compresseur d'air), Entreprise
- `serveurs` (Baie de serveurs), Entreprise
- `machine_industrielle` (Ligne de machines à coudre), Entreprise
- `eclairage_pro` (Éclairage atelier), Entreprise
- `autre` (Autre appareil): the appliance is unknown by definition
