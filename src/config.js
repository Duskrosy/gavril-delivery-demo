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

  // gameplay (radii are generous so reaching a building's edge counts as
  // "arrived" — buildings are solid, so you stop ~hx+bodyRadius from centre)
  pickupRadius:  11,
  handoffRadius: 11,
  refuelRadius:  9,
  eatRadius:     11,
  ordersPerShift: 3,

  // needs — pace governors (gentle; never fail states)
  gasMax:        100,
  gasDrainPerSec: 2.2,   // while the bike is moving (much gentler now)
  gasLow:        20,     // below this, speed eases off
  gasLowSpeedMult: 0.7,  // speed multiplier when low on gas
  gasPushMult:   0.22,   // out of gas → you can still push the bike at a crawl
  refuelPerSec:  70,     // ~1.5s to fill at a station
  hungerMax:     100,
  hungerDrainPerSec: 0.7, // gentler
  hungerLow:     30,
  hungerMinMult: 0.6,    // slowest you move when starving

  // collision impact thresholds (relative speed, world-units/sec) — softened
  impactMinor:   8,      // above this a hit damages the food
  impactCrash:   17,     // above this a hit destroys the food
  collisionCooldown: 1.2,
  knockback:     5,

  // speed bumps
  bumpSlowMult:  0.4,    // speed retained when crossing a bump
  bumpBounce:    0.55,   // camera vertical jolt
  bumpBand:      2.6,    // perpendicular detection half-width
  bumpCooldown:  0.7,

  // traffic
  carCount:      26,
  carSpeed:      10,
  carAccel:      9,      // m/s² toward target speed
  carBrake:      22,     // m/s² when yielding
  carLookAhead:  11,     // how far ahead a car watches for obstacles
  carYieldDist:  4.5,    // brake if an obstacle is within this of the look point
  carTurnChance: 0.4,    // probability of turning (vs. straight) at an intersection
  lightCycle:    { green: 6.5, yellow: 1.8, red: 6.5 }, // per phase, per axis

  // pedestrians
  pedCount:      14,
  pedSpeed:      3.2,
  pedTurnEvery:  [2.5, 6],  // seconds between heading changes (min,max)

  // clock-in / shift
  clockInRadius: 12,

  // day/night
  dayCycleSeconds: 210,  // full Morning→…→Late-night→Morning loop
  dayStart:        0.78, // begin at dusk/late-evening
};

// --- city props ------------------------------------------------------------
// IMPORTANT: roads sit on multiples of blockSpacing (…,-30,0,30,…). Every prop
// below lives at a *block centre* (±15,±45,±75,±105 — i.e. ≡15 mod 30) so it
// sits BETWEEN roads and cars never drive through it. Only the traffic light
// is placed on a road intersection.

// Gas stations: pull onto the pad to auto-refuel.
export const GAS_STATIONS = [
  { id: 'gas-a', position: { x: 45, z: -15 } },
  { id: 'gas-b', position: { x: -45, z: 15 } },
  { id: 'gas-c', position: { x: 45, z: 75 } },
];

// Food stands: press E nearby to eat (free). The restaurant also feeds you.
export const FOOD_STANDS = [
  { id: 'stand-a', position: { x: -15, z: -45 } },
  { id: 'stand-b', position: { x: 15, z: 75 } },
];

// One working traffic light at a real road intersection (x=0, z=-30).
export const TRAFFIC_LIGHT = { position: { x: 0, z: -30 }, axis: 'z' };

// Speed bumps: humps across a road. Each sits ON a road (one coord ≡0 mod 30);
// axis = the road's travel direction.
export const SPEED_BUMPS = [
  { position: { x: 0,   z: 45 },  axis: 'z' },
  { position: { x: 0,   z: -75 }, axis: 'z' },
  { position: { x: 45,  z: 0 },   axis: 'x' },
  { position: { x: -45, z: 0 },   axis: 'x' },
  { position: { x: 60,  z: 45 },  axis: 'z' },
];

// Where the player spawns on foot and where the bike is parked at start
// (block centre (15,45), one block north of the hub — off the road).
export const SPAWN = { foot: { x: 18, z: 48, yaw: Math.PI }, bike: { x: 6, z: 48, yaw: Math.PI } };

// --- World layout ----------------------------------------------------------
// Roomy night-city blocks. half MUST be a multiple of blockSpacing so the road
// grid is symmetric through the origin. Roads at 0,±30,±60,±90,±120.
export const WORLD = {
  half: 120,         // ground extends [-half, half]; 120 = 4 × blockSpacing
  blockSpacing: 30,  // road grid spacing
  roadWidth: 12,
  restaurant: { id: 'restaurant', position: { x: 15, z: 15 } }, // central block, off-road
};

export const LANDMARKS = [
  { id: 'clock',    label: 'the clock tower',  position: { x: -75, z: -105 }, colorKey: 'system' },
  { id: 'fountain', label: 'the fountain',     position: { x:  75, z: -105 }, colorKey: 'nav' },
  { id: 'neon',     label: 'the big neon sign', position: { x:  75, z:  105 }, colorKey: 'decision' },
  { id: 'park',     label: 'the little park',  position: { x: -75, z:  105 }, colorKey: 'reward' },
];

// Each house sits one block in front of its landmark (same block-centre column).
export const HOUSES = [
  { id: 'house-1', landmarkId: 'clock',    position: { x: -75, z: -75 } },
  { id: 'house-2', landmarkId: 'fountain', position: { x:  75, z: -75 } },
  { id: 'house-3', landmarkId: 'neon',     position: { x:  75, z:  75 } },
  { id: 'house-4', landmarkId: 'park',     position: { x: -75, z:  75 } },
];

// --- Day/night keyframes ----------------------------------------------------
// Lerped by the day cycle. t in [0,1). Colors are hex; intensities are scalars.
// fogNear/Far in world units; bloom scales the post strength.
export const DAYNIGHT = [
  { t: 0.00, name: 'Morning',    sky: '#9fb3e8', fog: '#b9c4e6', fogNear: 70, fogFar: 320,
    hemiSky: '#bcc6ee', hemiGround: '#5a5170', hemiInt: 1.15, keyColor: '#fff0d6', keyInt: 1.7, ambInt: 0.5, bloom: 0.35, sun: [60, 70, 40] },
  { t: 0.30, name: 'Midday',     sky: '#aec4ef', fog: '#c6d2ee', fogNear: 90, fogFar: 360,
    hemiSky: '#cdd8f3', hemiGround: '#62597a', hemiInt: 1.3, keyColor: '#ffffff', keyInt: 2.0, ambInt: 0.55, bloom: 0.28, sun: [10, 95, 20] },
  { t: 0.55, name: 'Dinner rush', sky: '#e79a6a', fog: '#caa2a0', fogNear: 60, fogFar: 280,
    hemiSky: '#f0b483', hemiGround: '#4a3a52', hemiInt: 1.0, keyColor: '#ffb061', keyInt: 1.6, ambInt: 0.4, bloom: 0.5, sun: [-50, 35, 30] },
  { t: 0.78, name: 'Late-night', sky: '#0b0812', fog: '#0b0812', fogNear: 55, fogFar: 200,
    hemiSky: '#6a5fa0', hemiGround: '#1a1428', hemiInt: 0.95, keyColor: '#b3a8e6', keyInt: 1.15, ambInt: 0.42, bloom: 0.7, sun: [-70, 60, -30] },
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
