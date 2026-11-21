import assert from 'node:assert/strict';
import test from 'node:test';
import { DeliveryQueue } from './queue.mjs';
import { Sender } from './delivery.mjs';
import model from '../static/m1/model.js';

test('a partial tick is retried with original identifiers and times', async t => {
  const queue = new DeliveryQueue(':memory:');
  t.after(() => queue.db.close());
  const bench = new model.AdapterBench();
  const rows = bench.tick();
  queue.append(bench.time, rows);
  const sender = new Sender(queue, 'http://example.invalid/mesures');
  const requests = [];
  t.mock.method(sender, 'post', async row => {
    requests.push(row);
    return Response.json({acquittees: requests.length === 3 ? 0 : 1});
  });
  await sender.flush();
  assert.equal(queue.size.get().ticks, 1);
  assert.equal(sender.error, 'Incomplete batch acknowledgement');
  sender.nextAttempt = 0;
  await sender.flush();
  assert.equal(queue.size.get().ticks, 0);
  assert.deepEqual(requests.slice(3), rows);
  assert.equal(sender.error, null);
});

test('backlog replay fits the ingestion limit and retains the last timestamp', async t => {
  const queue = new DeliveryQueue(':memory:');
  t.after(() => queue.db.close());
  const bench = new model.AdapterBench();
  for (let i = 0; i < 22; i++) {
    const rows = bench.tick();
    queue.append(bench.time, rows);
  }
  const counts = [];
  const sender = new Sender(queue, 'http://example.invalid/mesures');
  t.mock.method(sender, 'post', async batch => {
    counts.push(batch.length);
    return Response.json({acquittees: batch.length});
  });
  await sender.flush();
  assert.deepEqual(counts, [100, 10]);
  assert.equal(queue.newest.get().instant, bench.time);
  assert.equal(queue.size.get().ticks, 0);
});
