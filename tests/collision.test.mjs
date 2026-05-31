import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSolids } from '../src/collision.js';

test('pushes a circle out of an AABB along least penetration (x)', () => {
  const solids = [{ x: 0, z: 0, hx: 5, hz: 5 }];
  const p = { x: 5.5, z: 0 };
  const pushed = resolveSolids(p, 1, solids);
  assert.equal(pushed, true);
  assert.ok(Math.abs(p.x - 6) < 1e-9, 'x pushed to edge + radius');
  assert.equal(p.z, 0);
});

test('pushes out along z when that penetration is smaller', () => {
  const solids = [{ x: 0, z: 0, hx: 5, hz: 5 }];
  const p = { x: 0, z: -5.4 };
  resolveSolids(p, 1, solids);
  assert.ok(Math.abs(p.z + 6) < 1e-9, 'z pushed to -6');
});

test('no push when clear of all solids', () => {
  const p = { x: 20, z: 20 };
  assert.equal(resolveSolids(p, 1, [{ x: 0, z: 0, hx: 5, hz: 5 }]), false);
  assert.equal(p.x, 20);
});
