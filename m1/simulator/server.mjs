import { readFileSync } from 'node:fs';
import { country, createFleet } from './fleet.mjs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import model from '../static/m1/model.js';
import { DeliveryQueue } from './queue.mjs';
import { Sender } from './delivery.mjs';
import { LocationStore, phoneLocation } from './locations.mjs';

const { AdapterBench, adapters, simulatedMinute } = model;
function integerSetting(name, fallback, min, max) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

const port = integerSetting('SIM_PORT', 8787, 1, 65535);
const tickMs = integerSetting('SIM_TICK_MS', 2000, 100, 2147483647);
const target = new URL(process.env.SIM_SINK_URL || 'http://127.0.0.1:8000/api/mesures');
if (!['http:', 'https:'].includes(target.protocol)) throw new Error('SIM_SINK_URL must use HTTP or HTTPS');
const queue = new DeliveryQueue(process.env.SIM_DB || fileURLToPath(new URL('.data/queue.sqlite3', import.meta.url)));
const sender = new Sender(queue, target);
if (process.env.SIM_ADAPTER_KEY) sender.extraHeaders = {'X-Adapter-Key': process.env.SIM_ADAPTER_KEY};
const previous = queue.newest.get();
const bench = new AdapterBench(Math.max(Date.now() - simulatedMinute, previous?.instant ?? 0));
let latest = previous ? JSON.parse(previous.payload) : [];
let running = true;
const subscribers = new Set();
const locationStore = new LocationStore(queue.db);
const fleet = createFleet(locationStore.locations);
let atlas = fleet(latest);
const atlasSubscribers = new Map();
const atlasRoute = '/api/v1/countries/TN';

function atlasEvent(regionId) {
  const {regions, horodatage} = atlas;
  const devices = regionId ? atlas.devices.filter(d => d.region_id === regionId) : [];
  return 'data: ' + JSON.stringify({regions, horodatage, running, devices}) + '\n\n';
}

function publishAtlas() {
  const frames = new Map();
  for (const [client, regionId] of atlasSubscribers) {
    if (client.writableNeedDrain) continue;
    if (!frames.has(regionId)) frames.set(regionId, atlasEvent(regionId));
    client.write(frames.get(regionId));
  }
}

function publish() {
  if (!running) return;
  const rows = bench.tick();
  queue.append(bench.time, rows);
  latest = rows;
  atlas = fleet(rows);
  publishAtlas();
  for (const client of subscribers) {
    if (!client.write(event(rows))) client.destroy();
  }
  void sender.flush();
}

function publicReadings(rows) {
  return rows.map(row => ({...row, country}));
}

function event(rows) {
  return 'event: mesures\ndata: ' + JSON.stringify(publicReadings(rows)) + '\n\n';
}

function status() {
  return {
    running, tick_ms: tickMs, simulated_minutes_per_tick: 1,
    scenario: bench.mode, device_count: adapters.length,
    last_sample: latest[0]?.horodatage ?? null,
    pending_readings: queue.size.get().ticks * adapters.length,
    last_ack: sender.lastAck, delivery_error: sender.error,
  };
}

function json(res, code, body, headers = {}) {
  res.writeHead(code, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers});
  res.end(JSON.stringify(body));
}

async function readControl(req) {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    throw Object.assign(new Error('Expected application/json'), {status: 415});
  }
  const parts = [];
  let size = 0;
  for await (const part of req) {
    size += part.length;
    if (size > 1024) throw Object.assign(new Error('Control payload too large'), {status: 413});
    parts.push(part);
  }
  try {
    const data = JSON.parse(Buffer.concat(parts).toString());
    if (data && !Array.isArray(data) && typeof data === 'object') return data;
  } catch {}
  throw Object.assign(new Error('Expected a JSON object'), {status: 400});
}

const pages = new Map([
  ['/', ['map/index.html', 'text/html; charset=utf-8']],
  ['/map.js', ['map/map.js', 'text/javascript; charset=utf-8']],
  ['/map.css', ['map/map.css', 'text/css; charset=utf-8']],
  ['/scanner.js', ['map/scanner.js', 'text/javascript; charset=utf-8']],
  ['/street.js', ['map/street.js', 'text/javascript; charset=utf-8']],
  ['/vendor/leaflet.js', ['map/vendor/leaflet.js', 'text/javascript']],
  ['/vendor/leaflet.css', ['map/vendor/leaflet.css', 'text/css']],
  ['/vendor/jsQR.js', ['map/vendor/jsQR.js', 'text/javascript']],
  ...atlas.regions.filter(r => r.id !== 'outside').map(({id}) => ['/neighborhoods/'+id+'.json', ['map/neighborhoods/'+id+'.json', 'application/json']]),
  ['/land.svg', ['map/land.svg', 'image/svg+xml']],
].map(([path, [file, type]]) => [path, {type, body:readFileSync(new URL(file, import.meta.url))}]));

const routes = { '/adaptateurs/associer':'POST', '/adaptateurs/batiment':'POST', [atlasRoute+'/devices']: 'GET', [atlasRoute+'/stream']: 'GET', '/status': 'GET', '/devices': 'GET', '/readings': 'GET', '/stream': 'GET', '/scenario': 'POST', '/control': 'POST' };
const server = createServer(async (req, res) => {
  try {
    const path = req.url.split('?')[0];
    if (pages.has(path)) {
      if (req.method !== 'GET') return json(res, 405, {error:'Method not allowed'}, {Allow:'GET'});
      const asset = pages.get(path);
      res.writeHead(200, {'Content-Type':asset.type});
      return res.end(asset.body);
    }
    if (!Object.hasOwn(routes, path)) return json(res, 404, {error: 'Unknown endpoint', routes});
    if (req.method !== routes[path]) return json(res, 405, {error: 'Method not allowed'}, {Allow: routes[path]});
    if (path === atlasRoute+'/devices') return json(res, 200, atlas);
    if (path === atlasRoute+'/stream') {
      const regionId = new URL(req.url, 'http://localhost').searchParams.get('region');
      if (regionId !== null && !atlas.regions.some(region => region.id === regionId)) {
        return json(res, 404, {error:'Unknown atlas region'});
      }
      res.writeHead(200, {'Content-Type':'text/event-stream', 'Cache-Control':'no-store', 'X-Accel-Buffering':'no'});
      res.write(atlasEvent(regionId));
      atlasSubscribers.set(res, regionId);
      res.on('close', () => atlasSubscribers.delete(res));
      return;
    }
    if (path === '/status') return json(res, 200, status());
    if (path === '/devices') return json(res, 200, adapters.map(d => ({adaptateur_id:d.id, appareil:d.name, watts_nominaux:d.base, country,
      location:atlas.devices.find(device => device.adaptateur_id === d.id).location})));
    if (path === '/readings') return json(res, 200, publicReadings(latest));
    if (path === '/stream') {
      res.writeHead(200, {'Content-Type':'text/event-stream', 'Cache-Control':'no-store', 'X-Accel-Buffering':'no'});
      res.write(event(latest));
      subscribers.add(res);
      res.on('close', () => subscribers.delete(res));
      return;
    }
    const data = await readControl(req);
    if (path === '/adaptateurs/associer' || path === '/adaptateurs/batiment') {
      const id = data.adaptateur_id;
      if (!atlas.devices.some(d => d.adaptateur_id === id)) return json(res, 404, {error:'Adaptateur inconnu.'});
      if (path === '/adaptateurs/associer') locationStore.save(id, phoneLocation(data));
      else locationStore.markRoof(id, data);
      atlas = fleet(latest);
      publishAtlas();
      return json(res, 200, atlas.devices.find(d => d.adaptateur_id === id));
    }
    if (path === '/scenario') {
      if (!['normal', 'spike', 'drift'].includes(data.mode)) return json(res, 400, {error:'Use normal, spike or drift'});
      bench.trigger(data.mode);
    } else {
      if (typeof data.running !== 'boolean') return json(res, 400, {error:'running must be a boolean'});
      running = data.running;
      publishAtlas();
    }
    json(res, 200, status());
  } catch (error) {
    json(res, error.status ?? 500, {error: error.status ? error.message : 'Simulator request failed'});
  }
});

server.listen(port, '127.0.0.1', () => {
  publish();
  setInterval(publish, tickMs);
  // Keep clearing the backlog even when generation is paused.
  setInterval(() => void sender.flush(), 1000);
  console.log(`Adapter simulator on http://127.0.0.1:${port} · 5 devices every ${tickMs} ms`);
});
