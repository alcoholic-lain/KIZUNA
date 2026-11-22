/** Public entry of the immersive 3D experiment. Nothing exported here imports
 * three.js; the scene itself is lazy-loaded by DeviceSpace. */
export { experience3dEnabledFor, EXPERIENCE_3D_ROLES } from "./config";
export { DeviceSpace } from "./ui/DeviceSpace";
