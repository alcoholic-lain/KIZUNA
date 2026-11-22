export type Fix = { x: number; y: number; z: number | null; accuracy_m: number; captured_at: string };

/**
 * Read the phone's GPS. Waits up to `altitudeMs` for a fix that includes an
 * altitude (phones often send one without it first), then settles for the best
 * fix seen. Rejects with a French message when location is refused or missing.
 */
export function readGps({ altitudeMs = 8000, timeoutMs = 30000 } = {}): { promise: Promise<Fix>; cancel: () => void } {
  let cancel = () => {};
  const promise = new Promise<Fix>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Le GPS nécessite une connexion HTTPS."));
    let best: GeolocationPosition | null = null;
    const finish = (p: GeolocationPosition) => {
      stop();
      const { longitude: x, latitude: y, altitude, accuracy } = p.coords;
      resolve({ x, y, z: Number.isFinite(altitude) ? altitude : null, accuracy_m: Math.round(accuracy * 10) / 10, captured_at: new Date(p.timestamp).toISOString() });
    };
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        if (!best || p.coords.accuracy <= best.coords.accuracy) best = p;
        if (Number.isFinite(p.coords.altitude)) finish(p);
      },
      (e) => { stop(); reject(new Error(e.code === 1 ? "Autorisez la localisation pour enregistrer la position de l'adaptateur." : "Position GPS indisponible. Réessayez près d'une fenêtre ou à l'extérieur.")); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
    );
    const settle = setTimeout(() => { if (best) finish(best); }, altitudeMs);
    const giveUp = setTimeout(() => { stop(); reject(new Error("Position GPS indisponible. Réessayez près d'une fenêtre ou à l'extérieur.")); }, timeoutMs);
    function stop() { navigator.geolocation.clearWatch(watch); clearTimeout(settle); clearTimeout(giveUp); }
    cancel = () => { stop(); reject(new Error("Annulé")); };
  });
  return { promise, cancel };
}
