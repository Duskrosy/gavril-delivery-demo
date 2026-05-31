# Gavril: One Shift — 3D delivery demo

A small, polished 3D vertical slice of the *Gavril* food-delivery game's core loop:
**accept → ride → pick up → find the house → hand-off → get paid → repeat**, across a
3-order shift. Built with Three.js, no build step.

## Run it

A local server is needed so the local image assets load without `file://` CORS issues
(Three.js itself loads from a CDN).

```bash
cd web-demo
python -m http.server 8000
# then open http://localhost:8000/
```

Or any static server (`npx serve`, etc.).

## Controls

You start **on foot** as a blocky avatar. You can run deliveries on foot, or ride.

- **W A S D / arrows** — move (walk on foot, drive on the bike)
- **F** — walk up to the parked motorcycle and press F to ride; F again to hop off
- **E** — accept an offered order, or eat when standing by the restaurant / food stand
- Follow the **cyan marker** to the restaurant, then to the customer's door.

## Systems (pace governors — never fail states)

- **Gas** (cyan meter): drains while riding. Low gas caps your speed; empty cuts the
  engine until you refuel. Pull onto a **gas station** pad to fill up automatically.
- **Hunger** (gold meter): drains slowly. Low hunger slows you down. **Eat** at the
  restaurant or the food stand (press **E**) to top up — free.
- **Traffic & collisions**: cars loop the main roads and obey one **traffic light**.
  A minor knock **shakes** the food (smaller tip, lower rating); a real **crash destroys**
  it — ride back to the restaurant for a free remake. **Speed bumps** jolt and slow you.

## Tests (logic only, headless)

```bash
node --test          # game state machine + asset fallback
```

## Hybrid art — Codex assets

The demo runs fully with **vector placeholders**. Drop these square PNGs into
`web-demo/assets/` and they upgrade automatically (no code change):

| File | Prompt seed |
|------|-------------|
| `portrait-1.png` | Cheerful student, anime-minimal flat portrait, deep plum bg, lilac/gold accents, shoulders-up, no text |
| `portrait-2.png` | Tired night-shift worker, same style |
| `portrait-3.png` | Elegant older woman, same style |
| `portrait-4.png` | Hurried young man, same style |
| `food-1.png` | Top-down ramen bowl on dark plum surface, anime-minimal, soft rim light, no text |
| `food-2.png` | Top-down bento box, same style |
| `food-3.png` | Top-down stack of honey pancakes, same style |
| `food-4.png` | Top-down taro bubble tea, same style |
| `title-bg.png` *(optional)* | Wide low-poly night-city skyline, deep plum, gold streetlights, soft fog, no text |

## Structure

```
index.html   importmap, canvas, HUD/overlay DOM
styles.css   deck tokens + HUD styling
src/config.js   palette, tuning, world layout, orders, props (pure data)
src/game.js     GameState — state machine + food state (pure logic, tested)
src/rules.js    impact classification + food-state rules (pure, tested)
src/needs.js    gas + hunger pace governors (pure, tested)
src/assets.js   image loader + vector placeholder fallback (tested)
src/world.js    scene, lights, fog, city, landmarks, gas stations, props, pedestrians
src/avatar.js   on-foot blocky Roblox-style character
src/player.js   motorcycle + driving physics
src/camera.js   shared smoothed follow camera (+ shake)
src/mount.js    on-foot ⇄ bike mode controller
src/traffic.js  looping cars, traffic light, collision
src/ui.js       HUD, meters, order card, vignette, payout, summary
src/main.js     bootstrap, render loop, input, wiring

tests/          node:test logic suites + headless puppeteer harnesses
```

## Tests

```bash
node --test                # 21 logic tests (state machine, food rules, needs, assets)
node tests/phase2.mjs      # headless browser: mount, crash→remake, refuel, eat, full shift
```
