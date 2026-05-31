import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/game.js';
import { FOOD } from '../src/rules.js';

// Minimal orders with embedded customer {prefers} and basePay.
function makeOrders() {
  return [
    { id: 'a', basePay: 10, customer: { name: 'A', prefers: 'friendly' } },
    { id: 'b', basePay: 20, customer: { name: 'B', prefers: 'quick' } },
    { id: 'c', basePay: 30, customer: { name: 'C', prefers: 'polite' } },
    { id: 'd', basePay: 40, customer: { name: 'D', prefers: 'friendly' } },
  ];
}
const TUNING = { ordersPerShift: 3 };

test('starts in OFFER with first order', () => {
  const g = new GameState(makeOrders(), TUNING);
  assert.equal(g.state, 'OFFER');
  assert.equal(g.current.id, 'a');
  assert.equal(g.cash, 0);
});

test('accept moves to TO_RESTAURANT', () => {
  const g = new GameState(makeOrders(), TUNING);
  g.accept();
  assert.equal(g.state, 'TO_RESTAURANT');
});

test('happy path reaches PAID then next() offers a new order', () => {
  const g = new GameState(makeOrders(), TUNING);
  g.accept();
  assert.equal(g.arriveRestaurant(), 'PICKED_UP'); // transient beat returned
  assert.equal(g.state, 'TO_HOUSE');
  g.arriveHouse();
  assert.equal(g.state, 'HANDOFF');
  const r = g.resolveHandoff('friendly');
  assert.equal(g.state, 'PAID');
  assert.ok(r.total > 0);
  g.next();
  assert.equal(g.state, 'OFFER');
  assert.equal(g.current.id, 'b');
});

test('after ordersPerShift orders, next() ends the shift', () => {
  const g = new GameState(makeOrders(), TUNING);
  for (let i = 0; i < 3; i++) {
    g.accept(); g.arriveRestaurant(); g.arriveHouse();
    g.resolveHandoff('quick');
    g.next();
  }
  assert.equal(g.state, 'SHIFT_DONE');
  assert.equal(g.current, null);
  assert.equal(g.summary.ordersDone, 3);
});

test('matching the customer preference beats a mismatch (tip + rating)', () => {
  const g1 = new GameState(makeOrders(), TUNING);
  g1.accept(); g1.arriveRestaurant(); g1.arriveHouse();
  const match = g1.resolveHandoff('friendly'); // order a prefers friendly

  const g2 = new GameState(makeOrders(), TUNING);
  g2.accept(); g2.arriveRestaurant(); g2.arriveHouse();
  const miss = g2.resolveHandoff('quick'); // mismatch

  assert.ok(match.rating > miss.rating, 'match rating higher');
  assert.ok(match.tip > miss.tip, 'match tip higher');
  assert.equal(match.pay, 10, 'pay equals basePay');
});

test('food starts NONE, becomes FRESH at pickup, NONE after delivery', () => {
  const g = new GameState(makeOrders(), TUNING);
  assert.equal(g.foodState, FOOD.NONE);
  g.accept(); g.arriveRestaurant();
  assert.equal(g.foodState, FOOD.FRESH);
  assert.equal(g.carrying, true);
  g.arriveHouse(); g.resolveHandoff('friendly');
  assert.equal(g.foodState, FOOD.NONE);
});

test('damaged food cuts the tip and caps the rating', () => {
  const g = new GameState(makeOrders(), TUNING);
  g.accept(); g.arriveRestaurant();
  g.damageFood('minor');
  assert.equal(g.foodState, FOOD.DAMAGED);
  g.arriveHouse();
  const r = g.resolveHandoff('friendly'); // would be 5★ fresh
  assert.ok(r.rating <= 3, 'rating capped for damaged');
  assert.equal(r.foodState, FOOD.DAMAGED);
});

test('a crash destroys food, blocks hand-off, and remake restocks fresh', () => {
  const g = new GameState(makeOrders(), TUNING);
  g.accept(); g.arriveRestaurant();
  g.damageFood('crash');
  assert.equal(g.needsRemake, true);
  assert.throws(() => g.arriveHouse(), /destroyed|remake/i);
  g.remakePickup();
  assert.equal(g.foodState, FOOD.FRESH);
  g.arriveHouse();
  const r = g.resolveHandoff('friendly');
  assert.equal(r.rating, 5);
});

test('illegal transitions throw', () => {
  const g = new GameState(makeOrders(), TUNING);
  assert.throws(() => g.arriveHouse(), /OFFER|expected/i);
  g.accept();
  assert.throws(() => g.accept(), /TO_RESTAURANT|expected/i);
});

test('summary totals match accumulated cash and ratings', () => {
  const g = new GameState(makeOrders(), TUNING);
  let expectedCash = 0;
  const ratings = [];
  for (let i = 0; i < 3; i++) {
    g.accept(); g.arriveRestaurant(); g.arriveHouse();
    const r = g.resolveHandoff('friendly');
    expectedCash += r.total;
    ratings.push(r.rating);
    g.next();
  }
  const avg = ratings.reduce((s, x) => s + x, 0) / ratings.length;
  assert.equal(g.summary.totalCash, expectedCash);
  assert.equal(g.summary.avgRating, avg);
});
