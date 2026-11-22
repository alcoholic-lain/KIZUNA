import * as THREE from "three";

/**
 * Shared physically-based materials and procedural textures for all appliance
 * models. Created once per scene and disposed on unmount. Textures are drawn
 * on canvases at runtime: no image files, no network requests.
 */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d") as CanvasRenderingContext2D];
}

function texture(c: HTMLCanvasElement, color: boolean, repeat?: [number, number]) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

/** Fine vertical streaks for brushed stainless steel (roughness map). */
function brushedMap() {
  const [c, g] = canvas(256, 256);
  const r = rng(7);
  g.fillStyle = "#c8c8c8";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const v = Math.round(178 + r() * 44);
    g.globalAlpha = 0.12 + r() * 0.18;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(r() * 256, 0, 0.4 + r() * 1.1, 256);
  }
  return texture(c, false, [3, 1]);
}

/** Horizontal slot grille (air intake, kick plates, vents). */
function grilleMap(slots: number, base: string, slot: string) {
  const [c, g] = canvas(64, 512);
  g.fillStyle = base;
  g.fillRect(0, 0, 64, 512);
  g.fillStyle = slot;
  const step = 512 / slots;
  for (let i = 0; i < slots; i++) g.fillRect(0, i * step + step * 0.28, 64, step * 0.44);
  return texture(c, true);
}

/** Laptop keyboard: key caps on a dark deck. */
function keyboardMap() {
  const [c, g] = canvas(512, 200);
  g.fillStyle = "#4a4d52";
  g.fillRect(0, 0, 512, 200);
  g.fillStyle = "#111215";
  const rows = [14, 14, 13, 12, 10];
  rows.forEach((n, row) => {
    const w = 512 / 14.6;
    const off = (14 - n) * w * 0.5;
    for (let i = 0; i < n; i++) {
      const x = off + i * w + 3;
      const y = 8 + row * 37;
      const kw = row === 4 && i === 4 ? w * 4 - 6 : w - 6;
      if (row === 4 && i > 4 && i < 8) continue;
      g.beginPath();
      g.roundRect(x, y, kw, 30, 4);
      g.fill();
    }
  });
  return texture(c, true);
}

/** Oak veneer for the TV unit. */
function oakMap() {
  const [c, g] = canvas(512, 256);
  const r = rng(21);
  g.fillStyle = "#9c7752";
  g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 140; i++) {
    const y = r() * 256;
    g.globalAlpha = 0.08 + r() * 0.16;
    g.strokeStyle = r() > 0.5 ? "#6e4f33" : "#b89069";
    g.lineWidth = 0.6 + r() * 2.2;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x / 160 + i) * 0.9 + (r() - 0.5) * 0.6);
    g.stroke();
  }
  return texture(c, true, [1.4, 1]);
}

/** Perforated stainless drum (washing machine). */
function drumMap() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = "#a9adb1";
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#2b2e31";
  for (let y = 6; y < 256; y += 14) for (let x = (y / 14) % 2 ? 6 : 13; x < 256; x += 14) {
    g.beginPath();
    g.arc(x, y, 2.6, 0, Math.PI * 2);
    g.fill();
  }
  return texture(c, true, [3, 3]);
}

/** Microwave door screen: dark perforated metal; light passes through the holes. */
function perforatedMap() {
  const [c, g] = canvas(64, 64);
  g.fillStyle = "rgba(8,9,11,0.9)";
  g.fillRect(0, 0, 64, 64);
  g.globalCompositeOperation = "destination-out";
  for (let y = 4; y < 64; y += 8) for (let x = (y / 8) % 2 ? 4 : 8; x < 64; x += 8) {
    g.beginPath();
    g.arc(x, y, 2.1, 0, Math.PI * 2);
    g.fill();
  }
  return texture(c, true, [14, 9]);
}

/** Soft lit-screen gradient. Deliberately abstract: no invented on-screen content. */
function screenMap(stops: string[]) {
  const [c, g] = canvas(256, 160);
  const lg = g.createLinearGradient(0, 0, 256, 160);
  stops.forEach((s, i) => lg.addColorStop(i / (stops.length - 1), s));
  g.fillStyle = lg;
  g.fillRect(0, 0, 256, 160);
  const rg = g.createRadialGradient(70, 40, 5, 70, 40, 180);
  rg.addColorStop(0, "rgba(255,255,255,0.07)");
  rg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = rg;
  g.fillRect(0, 0, 256, 160);
  return texture(c, true);
}

/** Radial falloff used for LED glows, light pools and the selection highlight. */
function glowMap() {
  const [c, g] = canvas(128, 128);
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, "rgba(255,255,255,1)");
  rg.addColorStop(0.35, "rgba(255,255,255,0.35)");
  rg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = rg;
  g.fillRect(0, 0, 128, 128);
  return texture(c, true);
}

/** Vertical wash of a ceiling spot on the wall. */
function poolMap() {
  // Elliptical falloff (narrow, tall) so the pool fades to zero on every edge.
  const [c, g] = canvas(128, 256);
  g.setTransform(1, 0, 0, 4, 0, 0);
  const rg = g.createRadialGradient(64, 2, 2, 64, 6, 60);
  rg.addColorStop(0, "rgba(255,255,255,0.95)");
  rg.addColorStop(0.45, "rgba(255,255,255,0.3)");
  rg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = rg;
  g.fillRect(0, 0, 128, 64);
  return texture(c, true);
}

export function createLibrary() {
  const tex = {
    brushed: brushedMap(),
    grilleLight: grilleMap(28, "#e9ebea", "#9ea3a7"),
    grilleDark: grilleMap(22, "#2a2c30", "#0c0d0f"),
    keyboard: keyboardMap(),
    oak: oakMap(),
    drum: drumMap(),
    perforated: perforatedMap(),
    tvScreen: screenMap(["#0d2a4a", "#155e75", "#3b2a6b"]),
    laptopScreen: screenMap(["#1e3a8a", "#3b82f6", "#a78bfa"]),
    phoneScreen: screenMap(["#06281d", "#0f5132", "#111827"]),
    glow: glowMap(),
    pool: poolMap(),
  };
  const phys = (p: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(p);
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
  const mats = {
    whiteGloss: phys({ color: "#f3f4f2", roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.12 }),
    whitePlastic: std({ color: "#e4e6e6", roughness: 0.5 }),
    enamel: phys({ color: "#eff0ed", roughness: 0.34, clearcoat: 0.4, clearcoatRoughness: 0.22 }),
    paintedWhite: phys({ color: "#eceeec", roughness: 0.4, metalness: 0.1, clearcoat: 0.25 }),
    inox: phys({ color: "#d3d6d8", metalness: 0.92, roughness: 0.48, roughnessMap: tex.brushed }),
    inoxDark: std({ color: "#8a8f93", metalness: 0.7, roughness: 0.45 }),
    aluminium: std({ color: "#c2c6ca", metalness: 1, roughness: 0.36 }),
    spaceGrey: std({ color: "#5c6065", metalness: 0.85, roughness: 0.4 }),
    chrome: std({ color: "#e6e8ea", metalness: 1, roughness: 0.12 }),
    brass: std({ color: "#c9a24a", metalness: 1, roughness: 0.32 }),
    blackGloss: phys({ color: "#08090b", roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.04 }),
    blackSatin: std({ color: "#151619", roughness: 0.4 }),
    blackMatte: std({ color: "#1c1d20", roughness: 0.66 }),
    darkGrey: std({ color: "#3a3d42", roughness: 0.55 }),
    gasket: std({ color: "#8f969b", roughness: 0.75, side: THREE.DoubleSide }),
    rubber: std({ color: "#1d1e20", roughness: 0.92 }),
    glassDark: phys({ color: "#1a2227", roughness: 0.05, transparent: true, opacity: 0.5, clearcoat: 1, depthWrite: false }),
    oak: std({ map: tex.oak, roughness: 0.6 }),
    fabric: std({ color: "#efe6d6", roughness: 0.95, side: THREE.DoubleSide }),
    keyboard: std({ map: tex.keyboard, roughness: 0.55, metalness: 0.2 }),
    trackpad: std({ color: "#6b6f74", metalness: 0.6, roughness: 0.28 }),
    drum: std({ map: tex.drum, metalness: 0.75, roughness: 0.38, side: THREE.DoubleSide }),
    doorScreen: std({ map: tex.perforated, transparent: true, metalness: 0.4, roughness: 0.5, depthWrite: false }),
    grilleLight: std({ map: tex.grilleLight, roughness: 0.55 }),
    grilleDark: std({ map: tex.grilleDark, roughness: 0.6 }),
    blueMark: std({ color: "#2a78d6", roughness: 0.4 }),
    redMark: std({ color: "#d9483b", roughness: 0.4 }),
    cord: std({ color: "#d8dadb", roughness: 0.62 }),
    cordDark: std({ color: "#232427", roughness: 0.6 }),
    // gallery
    plinth: std({ color: "#4a4c53", roughness: 0.78 }),
    wall: std({ color: "#2a2b30", roughness: 0.94 }),
    floor: std({ color: "#3a3b40", roughness: 0.42 }),
    skirting: std({ color: "#3a3c42", roughness: 0.7 }),
    socketPlate: std({ color: "#e7e9e9", roughness: 0.45 }),
  };
  return {
    ...mats,
    tex,
    dispose() {
      Object.values(mats).forEach((m) => m.dispose());
      Object.values(tex).forEach((t) => t.dispose());
    },
  };
}

export type MaterialLibrary = ReturnType<typeof createLibrary>;
