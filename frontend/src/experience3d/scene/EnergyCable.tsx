import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { V3 } from "../models/catalog";

/**
 * A power cord from the NABD adapter to the appliance. A soft additive sleeve
 * carries light pulses whose brightness and speed follow the measured power
 * (log scale). No reading → no pulses. Stylised on purpose; the cord is real.
 */

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragment = /* glsl */ `
uniform float uTime;
uniform float uSpeed;
uniform float uDensity;
uniform float uIntensity;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  float p = fract(vUv.x * uDensity - uTime * uSpeed);
  float pulse = smoothstep(0.0, 0.3, p) * (1.0 - smoothstep(0.3, 0.62, p));
  float a = uIntensity * (0.16 + 0.84 * pulse);
  gl_FragColor = vec4(uColor * a, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const ENERGY = "#f5b335";
export const ALERT = "#ff5a47";

export function EnergyCable({ points, intensity, anomaly, reduced, cord }: {
  points: V3[]; intensity: number; anomaly: boolean; reduced: boolean; cord: THREE.Material;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const key = JSON.stringify(points);
  const { core, sleeve, length } = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "centripetal", 0.5);
    const len = curve.getLength();
    const seg = Math.max(32, Math.round(len * 90));
    return {
      core: new THREE.TubeGeometry(curve, seg, 0.0042, 8, false),
      sleeve: new THREE.TubeGeometry(curve, seg, 0.0095, 10, false),
      length: len,
    };
    // `key` is the stable identity of `points`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => { core.dispose(); sleeve.dispose(); }, [core, sleeve]);

  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uSpeed: { value: 0.3 }, uDensity: { value: 4 }, uIntensity: { value: 0 },
      uColor: { value: new THREE.Color(ENERGY) },
    },
  }), []);
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    const u = material.uniforms;
    u.uIntensity.value = intensity > 0 ? 0.25 + 0.75 * intensity : 0;
    u.uSpeed.value = 0.1 + 0.55 * intensity;
    u.uDensity.value = Math.max(2, length / 0.2);
    (u.uColor.value as THREE.Color).set(anomaly ? ALERT : ENERGY);
    invalidate();
  }, [material, intensity, anomaly, length, invalidate]);

  useFrame((_, dt) => {
    if (!reduced && intensity > 0) material.uniforms.uTime.value += Math.min(dt, 0.1);
  });

  return (
    <group>
      <mesh geometry={core} material={cord} />
      {intensity > 0 && <mesh geometry={sleeve} material={material} renderOrder={2} />}
    </group>
  );
}
