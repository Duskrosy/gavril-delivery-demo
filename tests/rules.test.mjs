import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyImpact, nextFoodState, deliveryModifiers, FOOD } from '../src/rules.js';

const T = { impactMinor: 5, impactCrash: 13 };

test('classifyImpact buckets by relative speed', () => {
  assert.equal(classifyImpact(2, T), 'none');
  assert.equal(classifyImpact(8, T), 'minor');
  assert.equal(classifyImpact(20, T), 'crash');
});

test('nextFoodState escalates damage but never heals', () => {
  assert.equal(nextFoodState(FOOD.FRESH, 'minor'), FOOD.DAMAGED);
  assert.equal(nextFoodState(FOOD.FRESH, 'crash'), FOOD.DESTROYED);
  assert.equal(nextFoodState(FOOD.DAMAGED, 'crash'), FOOD.DESTROYED);
  // a minor hit on already-damaged food stays damaged (no heal, no destroy)
  assert.equal(nextFoodState(FOOD.DAMAGED, 'minor'), FOOD.DAMAGED);
  // none never changes state
  assert.equal(nextFoodState(FOOD.FRESH, 'none'), FOOD.FRESH);
  // destroyed is terminal
  assert.equal(nextFoodState(FOOD.DESTROYED, 'minor'), FOOD.DESTROYED);
});

test('deliveryModifiers penalize damaged food', () => {
  const fresh = deliveryModifiers(FOOD.FRESH);
  const dmg = deliveryModifiers(FOOD.DAMAGED);
  assert.equal(fresh.tipMult, 1);
  assert.equal(fresh.ratingCap, 5);
  assert.ok(dmg.tipMult < 1, 'damaged tip reduced');
  assert.ok(dmg.ratingCap < 5, 'damaged rating capped');
});
