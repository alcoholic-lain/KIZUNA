const invalid = message => Object.assign(new Error(message), {status:400});

function validPoint(x,y) {
  return Number.isFinite(x) && Math.abs(x) <= 180 && Number.isFinite(y) && Math.abs(y) <= 90;
}

export function phoneLocation(data) {
  const {x, y, z, accuracy_m, captured_at} = data;
  if (!validPoint(x,y)) {
    throw invalid('Longitude ou latitude GPS invalide.');
  }
  if (!Number.isFinite(z)) throw invalid('Une altitude GPS mesurée est requise.');
  if (!Number.isFinite(accuracy_m) || accuracy_m < 0) throw invalid('Précision GPS invalide.');
  const date = typeof captured_at === 'string' && Date.parse(captured_at);
  if (!Number.isFinite(date) || date > Date.now() + 60000) throw invalid('Horodatage GPS invalide.');
  return {x, y, z, accuracy_m, captured_at:new Date(date).toISOString(), source:'phone_gps'};
}

export class LocationStore {
  constructor(db) {
    db.exec('CREATE TABLE IF NOT EXISTS atlas_locations (id TEXT PRIMARY KEY, location TEXT NOT NULL)');
    this.locations = new Map(db.prepare('SELECT id, location FROM atlas_locations').all()
      .map(row => [row.id, JSON.parse(row.location)]));
    this.write = db.prepare('INSERT INTO atlas_locations VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET location=excluded.location');
  }

  save(id, location) {
    const previous = this.locations.get(id);
    if (previous?.captured_at > location.captured_at) {
      throw Object.assign(new Error('Une position plus récente est déjà enregistrée.'), {status:409});
    }
    if (!location.roof && previous?.captured_at === location.captured_at &&
        previous.x === location.x && previous.y === location.y && previous.z === location.z) return;
    this.write.run(id, JSON.stringify(location));
    this.locations.set(id, location);
  }

  markRoof(id, {x, y, captured_at}) {
    const fix = this.locations.get(id);
    if (!fix || fix.captured_at !== captured_at) {
      throw Object.assign(new Error('La position GPS a changé. Sélectionnez à nouveau le bâtiment.'), {status:409});
    }
    if (!validPoint(x,y)) throw invalid('Position du bâtiment invalide.');
    const distance = 111320 * Math.hypot(y-fix.y,(x-fix.x)*Math.cos(fix.y*Math.PI/180));
    if (distance > Math.max(50,fix.accuracy_m)) throw invalid('Choisissez un toit à proximité du relevé GPS.');
    this.save(id, {...fix, roof:{x,y}});
  }
}
