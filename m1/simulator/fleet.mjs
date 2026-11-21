import { readFileSync } from 'node:fs';
import model from '../static/m1/model.js';

export const country = 'TN';
const policy = {id:'TN-demo-v1', unit:'W', economic_max_ratio:1, elevated_max_ratio:1.35};

// Synthetic deployment sizes and inland site centres for the atlas.
const sites = [
  ['tunis', 'Tunis', 36.795, 10.12, 270],
  ['sfax', 'Sfax', 34.775, 10.675, 205],
  ['sousse', 'Sousse', 35.825, 10.545, 145],
  ['kairouan', 'Kairouan', 35.675, 10.095, 110],
  ['kef', 'Le Kef', 36.18, 8.71, 85],
  ['gafsa', 'Gafsa', 34.42, 8.78, 70],
  ['gabes', 'Gabès', 33.875, 9.995, 50],
  ['tataouine', 'Tataouine', 32.93, 10.45, 40],
  ['tozeur', 'Tozeur', 33.92, 8.13, 25],
];

// Demo altitudes are synthetic metres, independent of the roof geometry.
const demoElevation = [14,18,33,68,650,296,16,240,47];
export function createFleet(locations = new Map()) {
  let nextId = model.adapters.length + 1;
  const registry = sites.map(([id, city, latitude, longitude, count], regionIndex) => {
    const {homes} = JSON.parse(readFileSync(new URL('./map/neighborhoods/'+id+'.json', import.meta.url)));
    if (homes.length !== count) throw new Error('Incomplete footprint data for ' + id);
    const devices = Array.from({length:count}, (_, i) => {
      const benchDevice = i === 0 && regionIndex < model.adapters.length;
      const serial = benchDevice ? regionIndex + 1 : nextId++;
      const profile = model.adapters[(serial - 1) % model.adapters.length];
      const {point:[x,y], osm_id} = homes[i];
      const z = demoElevation[regionIndex] + serial % 4 * 3;
      const factor = [1.15, 0.92, 0.62, 1.08, 0.9][(serial - 1) % 5];
      return {
        benchDevice, serial, profile, online:serial % 7 !== 0 && serial % 11 !== 0,
        device:{
          adaptateur_id:'NABD-' + String(serial).padStart(4,'0'), name:profile.name,
          country, region_id:id, city, source:'simulee',
          latitude:y, longitude:x, altitude:z,
          location:{x, y, z, source:'simulated_building', building_id:osm_id},
          reference_watts:Math.round(profile.base * factor),
        },
      };
    });
    return {region:{id, city, latitude, longitude, count}, devices};
  });

  return rows => {
    const actual = new Map(rows.map(row => [row.adaptateur_id, row]));
    const timestamp = rows[0]?.horodatage ?? null;
    const minute = Date.parse(timestamp) / model.simulatedMinute;
    const devices = [];
    const totals = new Map(registry.map(({region}) => [region.id, {...region, count:0, active_count:0}]));
    for (const {region, devices:members} of registry) {
      for (const {benchDevice, serial, profile, online, device} of members) {
        const reading = actual.get(device.adaptateur_id);
        const active = benchDevice ? Boolean(reading) : online && timestamp !== null;
        let watts = null;
        let state = 'offline';
        if (active) {
          const wave = Math.sin(minute * 0.43 + serial) * Math.cos(minute * 0.13 + serial / 7);
          watts = reading?.watts ?? Math.round(profile.base * (1 + profile.variation * wave) * 10) / 10;
          const ratio = watts / device.reference_watts;
          state = ratio <= policy.economic_max_ratio ? 'economic'
            : ratio <= policy.elevated_max_ratio ? 'elevated' : 'high';
        }
        const location = locations.get(device.adaptateur_id);
        let site = totals.get(region.id);
        if (location) {
          // Atlas sectors are catchments around the nine demo cities.
          let nearestKm = 100;
          site = null;
          for (const {region:r} of registry) {
            const km = 111.2 * Math.hypot(location.y-r.latitude,
              (location.x-r.longitude) * Math.cos(location.y*Math.PI/180));
            if (km < nearestKm) { nearestKm = km; site = totals.get(r.id); }
          }
          if (!site) {
            if (!totals.has('outside')) totals.set('outside', {id:'outside', city:'Hors secteurs', count:0, active_count:0});
            site = totals.get('outside');
          }
        }
        site.count++;
        if (active) site.active_count++;
        devices.push({...device, ...(location && {location, latitude:location.y, longitude:location.x,
          altitude:location.z, region_id:site.id, city:site.city}),
          active, watts, horodatage:active ? (reading?.horodatage ?? timestamp) : null, state});
      }
    }
    const regions = [...totals.values()];
    return {country, country_name:'Tunisia', utility:'STEG', source:'simulee', policy,
      horodatage:timestamp, regions, devices};
  };
}
