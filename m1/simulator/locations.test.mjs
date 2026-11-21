import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {LocationStore, phoneLocation} from './locations.mjs';

const sample = {x:10.12345, y:36.71234, z:0, accuracy_m:4, captured_at:'2026-01-01T12:00:00Z'};

test('a phone scan requires a measured 3D fix and accepts altitude zero', () => {
  assert.equal(phoneLocation(sample).z,0);
  for (const change of [{x:181},{y:null},{z:null},{z:'12'},{accuracy_m:-1},{captured_at:null}]) {
    assert.throws(() => phoneLocation({...sample,...change}),{status:400});
  }
});

test('saved roof placement survives replay and reload while the original GPS fix is preserved', () => {
  const db = new DatabaseSync(':memory:');
  const store = new LocationStore(db);
  const fix = phoneLocation(sample);
  store.save('NABD-0001',fix);
  const roof = {x:fix.x+0.00003,y:fix.y};
  store.markRoof('NABD-0001',{...roof,captured_at:fix.captured_at});
  store.save('NABD-0001',fix);
  assert.deepEqual(new LocationStore(db).locations.get('NABD-0001'),{...fix,roof});
  assert.throws(() => store.markRoof('NABD-0001',{...roof,captured_at:'older'}),{status:409});
  assert.throws(() => store.markRoof('NABD-0001',{x:0,y:0,captured_at:fix.captured_at}),{status:400});
  assert.throws(() => store.save('NABD-0001',{...fix,captured_at:'2025-12-31T22:30:05.000Z'}),{status:409});
  db.close();
});
