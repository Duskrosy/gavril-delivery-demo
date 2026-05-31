// ============================================================
//  GAVRIL — One Shift · config.js
//  Pure data. Import-safe in Node (no browser globals at top level).
//  Shared source of truth for palette, tuning, and world layout.
// ============================================================

// --- Palette ---------------------------------------------------------------
// Surfaces are the deck's exact hex. Accents are hex approximations of the
// deck's oklch tokens, chosen so THREE.Color and CSS read the same hue.
export const PALETTE = {
  bg:       '#0b0812',
  bg2:      '#0f0a18',
  panel:    '#16101f',
  panel2:   '#1c1429',
  line:     '#2a2138',
  line2:    '#372c4a',

  ink:      '#ece8f6',
  inkDim:   '#a89ec6',
  inkFaint: '#6f6688',

  action:   '#b58cff', // purple  — player action
  system:   '#7da0ff', // indigo  — system / state
  decision: '#ff8ec8', // magenta — choice / branch
  reward:   '#ffc864', // gold    — payoff / reward
  nav:      '#6fd2e6', // cyan    — navigation / info
};

// CSS var names paired with palette keys (used by ui.js for color coding).
export const COLOR_VARS = {
  action:   '--action',
  system:   '--system',
  decision: '--decision',
  reward:   '--reward',
  nav:      '--nav',
};

// --- Tuning ----------------------------------------------------------------
// Units are world-units and seconds. Kept "chill": gentle accel, modest top speed.
export const TUNING = {
  // driving
  maxSpeed:      26,
  accel:         34,
  reverseAccel:  18,
  friction:      14,   // passive decel when no throttle
  brakeFriction: 40,   // decel when pressing opposite
  turnRate:      2.4,  // rad/s at speed
  lean:          0.32, // max body roll (rad)

  // follow camera
  camDist:   14,
  camHeight: 8.0,
  camLerp:   3.2,  // higher = snappier
  camLook:   2.2,  // look-ahead height

  // on-foot avatar
  footSpeed:   10,
  footAccel:   60,
  footFriction: 40,
  footTurn:    6.0,
  footCamDist: 8.5,
  footCamHeight: 5.2,
  footCamLook: 1.8,
  footCamLerp: 6.0,

  // mounting
  mountRadius: 5.5,   // how close to the parked bike to ride

  // gameplay
  pickupRadius:  7,
  handoffRadius: 7,
  refuelRadius:  7,
  eatRadius:     7,
  ordersPerShift: 3,

  // needs — pace governors (never fail states)
  gasMax:        100,
  gasDrainPerSec: 5.0,   // while the bike is moving
  gasLow:        25,     // below this, speed is capped
  gasLowSpeedMult: 0.55, // speed multiplier when low on gas
  refuelPerSec:  70,     // ~1.5s to fill at a station
  hungerMax:     100,
  hungerDrainPerSec: 1.6,
  hungerLow:     35,
  hungerMinMult: 0.5,    // slowest you move when starving

  // collision impact thresholds (relative speed, world-units/sec)
  impactMinor:   5,      // above this a hit damages the food
  impactCrash:   13,     // above this a hit destroys the food
  collisionCooldown: 1.2,
  knockback:     8,

  // speed bumps
  bumpSlowMult:  0.45,   // speed retained when crossing a bump
  bumpCooldown:  0.8,

  // traffic
  carCount:      7,
  carSpeed:      11,
  lightCycle:    { green: 6, yellow: 1.6, red: 5 }, // seconds per phase
};

// --- city props ------------------------------------------------------------
// Gas stations: pull onto the pad to auto-refuel.
export const GAS_STATIONS = [
  { id: 'gas-a', position: { x: 24, z: -12 } },
  { id: 'gas-b', position: { x: -24, z: 14 } },
];

// Food stand: press E nearby to eat (free). The restaurant also feeds you.
export const FOOD_STAND = { id: 'stand', position: { x: 13, z: 16 } };

// One working traffic light governing the central N–S road (x ≈ 0).
export const TRAFFIC_LIGHT = { position: { x: 0, z: -24 }, axis: 'z' };

// Speed bumps: short humps spanning a road. axis = road travel direction.
export const SPEED_BUMPS = [
  { position: { x: 0, z: 12 },  axis: 'z' },
  { position: { x: -24, z: -10 }, axis: 'z' },
  { position: { x: 20, z: 0 },  axis: 'x' },
];

// Where the player spawns on foot and where the bike is parked at start.
export const SPAWN = { foot: { x: 3, z: 30, yaw: Math.PI }, bike: { x: -3, z: 30, yaw: Math.PI } };

// --- World layout ----------------------------------------------------------
// Compact night-city block. Roads run along X/Z. y is up.
// The restaurant is the central hub; each house sits beside a landmark.
export const WORLD = {
  half: 70,          // ground extends [-half, half] on X and Z
  blockSpacing: 24,  // road grid spacing
  restaurant: { id: 'restaurant', position: { x: 0, z: 4 } },
};

export const LANDMARKS = [
  { id: 'clock',    label: 'the clock tower', position: { x: -46, z: -46 }, colorKey: 'system' },
  { id: 'fountain', label: 'the fountain',    position: { x:  46, z: -46 }, colorKey: 'nav' },
  { id: 'neon',     label: 'the big neon sign', position: { x:  46, z:  46 }, colorKey: 'decision' },
  { id: 'park',     label: 'the little park',  position: { x: -46, z:  46 }, colorKey: 'reward' },
];

// Each house is anchored a few units "in front of" its landmark.
export const HOUSES = [
  { id: 'house-1', landmarkId: 'clock',    position: { x: -46, z: -28 } },
  { id: 'house-2', landmarkId: 'fountain', position: { x:  46, z: -28 } },
  { id: 'house-3', landmarkId: 'neon',     position: { x:  46, z:  28 } },
  { id: 'house-4', landmarkId: 'park',     position: { x: -46, z:  28 } },
];

export const CUSTOMERS = [
  {
    id: 'mika', name: 'Mika', portrait: 'portrait-1.png', prefers: 'friendly',
    line: 'Oh — that was fast! You found it past the clock tower okay?',
  },
  {
    id: 'ren', name: 'Ren', portrait: 'portrait-2.png', prefers: 'quick',
    line: 'Long shift. Thanks for hustling, just hand it over.',
  },
  {
    id: 'odette', name: 'Odette', portrait: 'portrait-3.png', prefers: 'polite',
    line: 'Good evening. I do appreciate a rider with manners.',
  },
  {
    id: 'kaz', name: 'Kaz', portrait: 'portrait-4.png', prefers: 'friendly',
    line: 'Yo! Perfect timing, I am starving over here.',
  },
];

// Orders reference a customer, a house, the house's landmark, and a dish.
// At least 4 so a 3-order shift can draw distinct orders.
export const ORDERS = [
  {
    id: 'o1', customerId: 'mika',   houseId: 'house-1', landmarkId: 'clock',
    food: 'food-1.png', foodName: 'Midnight Ramen',
    addressHint: 'Apt by the clock tower, north-west corner.', basePay: 12,
  },
  {
    id: 'o2', customerId: 'ren',    houseId: 'house-2', landmarkId: 'fountain',
    food: 'food-2.png', foodName: 'Commuter Bento',
    addressHint: 'The blue door beside the fountain, north-east.', basePay: 10,
  },
  {
    id: 'o3', customerId: 'odette', houseId: 'house-3', landmarkId: 'neon',
    food: 'food-3.png', foodName: 'Honey Pancakes',
    addressHint: 'Under the big neon sign, south-east block.', basePay: 14,
  },
  {
    id: 'o4', customerId: 'kaz',    houseId: 'house-4', landmarkId: 'park',
    food: 'food-4.png', foodName: 'Taro Bubble Tea',
    addressHint: 'Cottage facing the little park, south-west.', basePay: 9,
  },
];

// Resolve helpers so other modules can join the tables without re-importing all.
export function customerById(id) { return CUSTOMERS.find(c => c.id === id); }
export function houseById(id)    { return HOUSES.find(h => h.id === id); }
export function landmarkById(id) { return LANDMARKS.find(l => l.id === id); }
