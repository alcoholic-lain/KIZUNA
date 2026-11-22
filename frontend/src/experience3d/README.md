# Immersive 3D experiment (`experiment/immersive-3d`)

A 3D view of the household's **real installations** (one NABD adapter plus the
appliance it measures), added to the home page (`/app/accueil`) of the household profiles (Foyer, Étudiant, Famille) *between*
existing cards. Nothing on the dashboard was removed or moved.

## What the user sees

- A dark "room" (it matches the existing *En ce moment* card), one bay per installation,
  grouped by the room name stored on the installation.
- In each bay: a wall socket, the NABD adapter whose screen shows the live reading
  from the API, the power cord, and a generic appliance model at real-world scale.
- Light pulses travel along the cord. Brightness and speed follow the measured watts
  (log scale). The pulses turn red when the API flags an anomaly. With no reading
  (measurement paused, value missing) there are no pulses.
- Selecting a device (tap the model, or use the chip row) moves the camera to it and
  opens a panel with its measured values, its source (simulated / real sensor) and a
  "generic model" disclaimer. **Détails et historique** opens the existing
  device sheet (`DeviceSheet` from `pages/Devices.tsx`) with its charts.
- On narrow screens the overview frames part of the wall; swipe horizontally to move
  along it. Vertical swipes keep scrolling the page.
- A **Liste** toggle shows the same information in 2D. The section can be collapsed.
  Both choices are remembered per browser.

## Data flow

```
GET /api/live (already polled by Home every 2.5 s, no new request)
  → data/fromLive.ts  fromLiveDevices()   validate + map, nulls stay null
  → ui/DeviceSpace.tsx                    selection, mode, fallbacks (React state)
  → scene/DeviceScene.tsx (lazy chunk)    pure visualisation, no fetch
```

`auth/me` → `categories` provides the category labels (used for the "no model" tag).

No backend model, API or migration was changed.

## Layout of the code

| Folder | Role | Imports three.js? |
|---|---|---|
| `data/` | API adapter, types, status and source labels | no |
| `models/catalog.ts` | Per-category metadata: real dimensions, mounting, cord routing, camera framing | no |
| `models/*.tsx` | One component per appliance + the NABD adapter | yes |
| `models/library.ts`, `useMats.ts`, `materials.tsx` | Shared PBR materials and canvas textures, disposed on unmount | yes |
| `models/registry.ts` | Category code → model component | yes |
| `scene/` | Canvas, lighting, room, bays, cords, camera rig, pure layout | yes (except `layout.ts`) |
| `ui/` | Dashboard section, 2D fallback, detail panel, capability hooks | no |
| `config.ts` | Roles that see the section: Foyer, Étudiant, Famille | no |

Only `scene/DeviceScene.tsx` is loaded with `React.lazy`. three.js, R3F and drei
end up in its chunk (`DeviceScene-*.js`, about 1.03 MB raw / 283 kB gzip). The
initial bundle does not contain them.

## Reusing it for Étudiant, Famille, Entreprise and STEG

- **Étudiant, Famille:** enabled. Same Home page, same `/api/live` payload (each profile
  gets its own household from the server). All their demo categories have models.
- **Entreprise:** reuse `DeviceSpace` on `/app/entreprise`. First add models for
  `compresseur`, `serveurs`, `machine_industrielle` and `eclairage_pro` to `registry.ts`
  and `catalog.ts`.
- **STEG:** different data (aggregates, no installations). Reuse `library.ts`,
  `useMats`, `EnergyCable` and `CameraRig` with a new scene. Keep the
  national-network vs adapter distinction.

### Replacing a model with a GLB

1. Put the optimised file in `frontend/public/models/` (Draco or Meshopt, textures ≤ 1k).
2. Write a component that renders it with drei `useGLTF`, scaled to the catalogue
   dimensions with its origin at the bottom-centre against the wall.
3. Register it under the same code in `registry.ts`, and record the source and licence in `ASSETS.md`.

## Performance and fallbacks

- The frame loop runs only while the section is on screen and the tab is visible
  (`IntersectionObserver` + `visibilitychange`). Otherwise it is `never`.
- With `prefers-reduced-motion: reduce`, the section opens as a **2D list** with a
  notice. The 3D can be opened on demand; it is then static: no pulses, no drum,
  no camera glide, no parallax. It renders only when something changes.
- If WebGL is unavailable, a 2D list is shown with an explanation and the 3D toggle is disabled.
- A WebGL context loss remounts the scene. An error boundary isolates any scene
  failure from the dashboard.
- DPR is capped at 1.5 and drops to 1 when drei's `PerformanceMonitor` detects
  low FPS. Contact shadows and the environment map are rendered once.
- There are no network assets: everything is generated at runtime, so it also works
  when the Android app is on a LAN without internet.

## Running it locally

```powershell
# backend (from the repo root)
uv run manage.py runserver 127.0.0.1:8000
# frontend build (from frontend/)
npm install
npm run build        # tsc -b && vite build → ../assets/app
```

Open http://127.0.0.1:8000/login and choose the **Foyer** (Amira), **Étudiant** (Youssef) or
**Famille** (Leila) demo account. The
section "Vos appareils en 3D" sits under the tokens / score / savings row.

> On this machine, Windows Application Control blocks Rollup's native binary
> (`@rollup/rollup-win32-x64-msvc`). The build was produced with Rollup's official
> WebAssembly build (`@rollup/wasm-node@4.68.8`, same version) in a scratch copy of
> `frontend/`, without changing the project's `package.json`. See the experiment report.
