import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Framing } from "./layout";

const DIR = new THREE.Vector3(0, 0.15, 1).normalize();

/**
 * Eases the camera to frame the gallery or the selected appliance. No orbit
 * controls: vertical touch drags keep scrolling the page. When the whole wall
 * would be too small (phones), the overview frames a window of it and a
 * horizontal drag pans along the wall. `insetLeft` (px) keeps the focused
 * appliance clear of an overlay panel. Reduced motion: jumps, no parallax.
 */
export function CameraRig({ framing, overview, galleryWidth, insetLeft, reduced, onPannable }: {
  framing: Framing; overview: boolean; galleryWidth: number; insetLeft: number; reduced: boolean;
  onPannable: (p: boolean) => void;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const look = useRef(new THREE.Vector3(framing.cx, framing.cy, framing.cz));
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const first = useRef(true);
  const pan = useRef(0);
  const fine = useMemo(() => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: fine)").matches, []);

  const goal = useMemo(() => {
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const inset = Math.min(insetLeft, size.width * 0.45);
    const aspect = Math.max(0.3, (size.width - inset) / Math.max(1, size.height));
    let w = framing.w;
    let range = 0;
    if (overview && w > framing.h * aspect * 1.6) {
      w = Math.max(3.2, framing.h * aspect * 1.15);
      range = Math.max(0, (galleryWidth - w) / 2 + 0.2);
    }
    const dist = Math.max(0.55, Math.max(framing.h / 2 / t, w / 2 / (t * aspect)) * 1.1);
    const visibleW = 2 * dist * t * (size.width / Math.max(1, size.height));
    const shift = (inset / 2 / size.width) * visibleW;
    const target = new THREE.Vector3(framing.cx - shift, framing.cy, framing.cz);
    return { target, pos: target.clone().addScaledVector(DIR, dist), dist, range, pxToM: visibleW / Math.max(1, size.width) };
  }, [framing, overview, galleryWidth, insetLeft, size.width, size.height, camera.fov]);

  // A pannable overview opens at the first room, or around the appliance that was just focused.
  const lastFocus = useRef<number | null>(null);
  useEffect(() => {
    if (!overview) lastFocus.current = framing.cx;
  }, [overview, framing.cx]);
  useEffect(() => {
    const r = goal.range;
    pan.current = r <= 0 ? 0 : lastFocus.current === null ? -r : THREE.MathUtils.clamp(lastFocus.current, -r, r);
    onPannable(r > 0);
  }, [goal.range, onPannable]);

  const apply = (k: number, px = 0, py = 0) => {
    tmp.set(goal.pos.x + pan.current + px, goal.pos.y + py, goal.pos.z);
    camera.position.lerp(tmp, k);
    tmp.copy(goal.target).setX(goal.target.x + pan.current);
    look.current.lerp(tmp, k);
    camera.lookAt(look.current);
  };

  useEffect(() => {
    if (reduced || first.current) {
      apply(1);
      first.current = false;
    }
    invalidate();
    // apply() only reads refs and `goal`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, reduced, invalidate]);

  // Horizontal drag pans the overview along the wall.
  useEffect(() => {
    if (goal.range <= 0) return;
    const el = gl.domElement;
    let x0 = 0, p0 = 0, down = false;
    const onDown = (e: PointerEvent) => { down = true; x0 = e.clientX; p0 = pan.current; };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      pan.current = THREE.MathUtils.clamp(p0 - (e.clientX - x0) * goal.pxToM, -goal.range, goal.range);
      if (reduced) { apply(1); invalidate(); }
    };
    const onUp = () => { down = false; };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // apply() only reads refs and `goal`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, goal, reduced, invalidate]);

  useFrame((state, dt) => {
    if (reduced) return;
    const k = 1 - Math.exp(-3.4 * Math.min(dt, 0.12));
    const px = fine ? state.pointer.x * 0.025 * goal.dist : 0;
    const py = fine ? state.pointer.y * 0.012 * goal.dist : 0;
    apply(k, px, py);
  });

  return null;
}
