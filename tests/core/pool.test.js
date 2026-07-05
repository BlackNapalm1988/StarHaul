import test from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../../core/pool.js';

test('createPool pre-fills using the factory when given an initial size', () => {
  let created = 0;
  const pool = createPool(() => ({ id: ++created }), 3);
  assert.equal(pool.size(), 3);
  assert.equal(created, 3);
});

test('acquire drains pre-filled objects before calling the factory again', () => {
  let created = 0;
  const pool = createPool(() => ({ id: ++created }), 2);
  pool.acquire();
  pool.acquire();
  assert.equal(created, 2, 'no extra objects created while pool had spares');
  pool.acquire();
  assert.equal(created, 3, 'factory invoked once pool is empty');
});

test('release makes an object available for reuse via acquire', () => {
  const pool = createPool(() => ({ life: 0 }));
  const obj = pool.acquire();
  obj.life = 42;
  pool.release(obj);
  assert.equal(pool.size(), 1);
  const reused = pool.acquire();
  assert.equal(reused, obj, 'acquire returns the exact released instance');
  assert.equal(reused.life, 42, 'released object retains its mutated state');
  assert.equal(pool.size(), 0);
});

test('acquire falls back to the factory when the pool is empty', () => {
  const pool = createPool(() => ({ fresh: true }));
  const obj = pool.acquire();
  assert.deepEqual(obj, { fresh: true });
  assert.equal(pool.size(), 0);
});
