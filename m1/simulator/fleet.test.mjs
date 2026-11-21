import test from 'node:test';
import assert from 'node:assert/strict';
import model from '../static/m1/model.js';
import {createFleet} from './fleet.mjs';

test('regional totals include every registered device and distinguish offline from low power', () => {
  const snapshot = createFleet()(new model.AdapterBench().tick());
  assert.equal(snapshot.country, 'TN');
  assert.equal(snapshot.devices.length, 1000);
  assert.equal(new Set(snapshot.devices.map(d => d.adaptateur_id)).size, 1000);
  assert.equal(snapshot.regions.reduce((sum,r) => sum + r.count, 0), 1000);
  assert.ok(new Set(snapshot.regions.map(r => r.count)).size > 1);
  for (const region of snapshot.regions) {
    const members = snapshot.devices.filter(d => d.region_id === region.id);
    assert.equal(members.length, region.count);
    assert.equal(members.filter(d => d.active).length, region.active_count);
    assert.ok(region.active_count > 0 && region.active_count < region.count);
  }
  for (const d of snapshot.devices) {
    if (d.active) {
      assert.ok(Number.isFinite(d.watts));
      assert.equal(d.horodatage, snapshot.horodatage);
    } else {
      assert.equal(d.state, 'offline');
      assert.equal(d.watts, null);
      assert.equal(d.horodatage, null);
    }
  }
});

test('each tick preserves device locations and updates live readings including the original bench', () => {
  const bench = new model.AdapterBench(Date.parse('2026-11-21T20:00:00Z'));
  const fleet = createFleet();
  const start = fleet(bench.tick());
  bench.trigger('spike');
  const rows = bench.tick();
  const next = fleet(rows);
  for (const [i,d] of next.devices.entries()) {
    assert.equal(d.adaptateur_id,start.devices[i].adaptateur_id);
    assert.equal(d.latitude,start.devices[i].latitude);
    assert.equal(d.longitude,start.devices[i].longitude);
    if (d.active) assert.notEqual(d.horodatage,start.devices[i].horodatage);
  }
  for (const row of rows) {
    const device = next.devices.find(d => d.adaptateur_id === row.adaptateur_id);
    assert.equal(device.watts,row.watts);
    assert.equal(device.horodatage,row.horodatage);
  }
  const synthetic = index => index.devices.find(d => d.adaptateur_id === 'NABD-0006');
  assert.notEqual(synthetic(start).watts,synthetic(next).watts);
});

test('country policy includes its boundary values', () => {
  const fleet = createFleet();
  const row = {adaptateur_id:'NABD-0004', horodatage:'2026-11-21T20:00:00Z', watts:0};
  const inspect = watts => fleet([{...row, watts}]).devices.find(d => d.adaptateur_id === row.adaptateur_id);
  const reference = inspect(0).reference_watts;
  for (const [ratio,state] of [[1,'economic'],[1.35,'elevated'],[1.36,'high']]) {
    assert.equal(inspect(reference * ratio).state,state);
  }
});

test('a scan moves the registered device and regional totals, preserving its live reading', () => {
  const locations = new Map();
  const fleet = createFleet(locations);
  const rows = new model.AdapterBench().tick();
  const before = fleet(rows);
  const target = before.devices.find(d => d.region_id === 'sfax').location;
  const location = {x:target.x, y:target.y, z:0, source:'phone_gps', accuracy_m:4, captured_at:new Date().toISOString()};
  locations.set('NABD-0001',location);
  const after = fleet(rows);
  const moved = after.devices.find(d => d.adaptateur_id === 'NABD-0001');
  assert.equal(moved.region_id,'sfax');
  assert.deepEqual(moved.location,location);
  assert.deepEqual([moved.longitude,moved.latitude,moved.altitude], [location.x,location.y,0]);
  assert.equal(moved.watts,rows[0].watts);
  assert.equal(after.devices.length,1000);
  assert.equal(after.regions.find(r => r.id === 'sfax').count,206);
  assert.equal(after.regions.find(r => r.id === 'tunis').count,269);
  for (const device of before.devices) {
    assert.equal(device.location.source,'simulated_building');
    assert.ok(device.location.building_id);
    assert.ok([device.location.x,device.location.y,device.location.z].every(Number.isFinite));
  }
});
