# Mieruka pitch deck

The five-minute jury presentation for KIZUNA 2026, Smart Energy. It is a React deck, kept
separate from the app: nothing in `frontend/src` imports it, and the app's Vite build ignores it.

| File | What it is |
|---|---|
| `mieruka-pitch.html` | **The deck.** One self-contained file (fonts, screenshots and code inlined). Works offline. |
| `PRESENTER-GUIDE.md` | Script with timings and cues, 2-minute emergency version, backup demo, jury Q&A, checklist. Generated. |
| `src/content.ts` | Every spoken line, cue, backup caption and Q&A answer. Edit text here. |
| `src/data.ts` | The numbers drawn on the slides, all taken from the prototype. |
| `src/slides.tsx` | All nine slides. |
| `screens/` | Real screenshots of the running prototype, used for the backup demo and slide crops. |
| `tools/capture-screens.mjs` | Recaptures those screenshots from a running prototype (instructions in the file header). |
| `DESIGN-LOG.md` | Direction, design system, fact sources, critique. |

## Present

1. Double-click `mieruka-pitch.html` (Chrome or Edge recommended).
2. Press **F** for full screen on the projector.
3. Press **P** for the presenter window: script, cues, 5:00 timer, next slide, emergency script, Q&A.
   Put it on the laptop screen when the projector extends the desktop. It follows only the deck
   that opened it.
4. Present with **→ / Space / Page Down** (most clickers work) and **←**.

| Key | Action |
|---|---|
| → Space Page Down | Next slide (plain cuts, no builds) |
| ← Page Up | Back |
| 1–9 | Jump to a slide |
| Esc or O | Overview |
| B | Backup demo: seven real screenshots of the demo, with highlights |
| N | Notes on the main screen (the audience sees them) |
| T | Restart the timer |
| ? | Shortcuts |

On slide 3, switch to the live app (Alt+Tab), do the demo, switch back and press →.
If the live demo fails, press **B** instead and walk through the screenshots with the same script.
The checklist at the end of `PRESENTER-GUIDE.md` covers the app set-up.

## Rebuild after editing

The deck is bundled with esbuild, which ships with Vite and runs on this machine. Rollup, which
Windows Application Control blocks here, is not used.

```powershell
cd frontend
node presentation/build.mjs           # writes mieruka-pitch.html and PRESENTER-GUIDE.md
node presentation/build.mjs --watch   # rebuilds on save; refresh the browser
node node_modules/typescript/bin/tsc -p presentation/tsconfig.json   # type-check
node node_modules/eslint/bin/eslint.js presentation                  # lint
```

No new dependencies: it uses React, the Geist fonts and esbuild already in `frontend/node_modules`.

## Replace the screenshots

The PNGs in `screens/` were captured from the prototype served by this checkout, at 1600 × 1000 CSS
pixels (scale 1.25) on 22 Nov 2026, on a disposable copy of the database, during one recorded demo run. To refresh
them, capture the same screens at the same size, keep the file names and rebuild. If a layout
moved, adjust the highlight rectangles in `BACKUP` in `src/content.ts` (CSS pixels of the
1600 × 1000 capture) and the crops in `src/slides/Value.tsx`. Slides 2 and 3 use published figures (see `PRESENTER-GUIDE.md`, “Sources”), not the run. The dashboard
now includes an experimental 3D appliance panel; if it is removed before the jury, recapture.
