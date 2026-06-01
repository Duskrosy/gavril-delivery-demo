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

You start **on foot** as a blocky avatar, off-shift. You can run deliveries on foot, or ride.

- **W A S D / arrows** — move (walk on foot, drive on the bike)
- **Right-click + drag** — orbit the camera; while held, on foot your character
  turns to face the camera and moves camera-relative (Roblox-style) · **wheel** — zoom
- **Ctrl** — toggle shift-lock (same camera-relative movement, hands-free)
- **F** — walk up to the parked motorcycle and press F to ride; F again to hop off
- **Enter** — chat: type a short message; it pops as a fading **speech bubble** above
  your character (and everyone else's, in multiplayer). Esc cancels.
- **Mobile / tablet**: on-screen **joystick** (move), **drag** anywhere to look,
  **RIDE**, **ACT**, and **💬** buttons. Auto-detected.
- **E** — **clock in** at the restaurant (no orders arrive until you do), accept an
  offered order, or eat when standing by the restaurant / a food stand
- Follow the **cyan marker** to the hub, the restaurant, then the customer's door.

**Optional shift:** orders only come once you clock in at the restaurant hub — wander the
city freely first if you like. The world runs a continuous **day/night cycle** (Morning →
Midday → Dinner → Late-night), shown in the HUD.

## Systems (pace governors — never fail states)

- **Gas** (cyan meter): drains gently while riding. Low gas eases your speed; when it
  runs out the engine cuts but you can **still move — you hop off and push the bike** at a
  crawl. Pull onto a **gas station** pad to refuel automatically.
- **Hunger** (gold meter): drains slowly. Low hunger slows you down. **Eat** at the
  restaurant or a food stand (press **E**) to top up — free.
- **Traffic**: cars, **vans, buses, and motorbikes** drive the grid, **turn at
  intersections**, **brake/car-follow**, **stop at the traffic lights** (several across the
  city), and **give way** at uncontrolled junctions. A few drivers are **aggressive** or
  **despise motorcycles** (they won't yield to the rider and surge). A knock **shakes** the
  food (smaller tip); a crash **destroys** it — ride back for a free remake. Gentle **speed bumps**.
- **People & places**: pedestrians **wander** (you collide with them), **NPC delivery
  riders** weave the roads and hang out at spots, and **points of interest** — plazas, a
  park, food-truck corners — draw little crowds around the city.
- **Camera**: Roblox-style orbit — right-drag or **Ctrl shift-lock** to look around, wheel to zoom.
- **Multiplayer** *(default)*: a single-room server (`server/`). Each player gets a
  **random name + color**, sees everyone else with name tags + chat, and the **server owns
  all the NPCs** (traffic, pedestrians, lights) so everyone sees the same world. The client
  connects to `MULTIPLAYER.url` (config.js) by default; if it can't reach the server it
  **falls back to single-player** with a toast explaining why. Override per-link with
  `?server=wss://YOUR-HOST`. See `server/README.md` to run/host it (Render, etc.).

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
src/rules.js    collision impact + food-state rules (pure, tested)
src/collision.js circle-vs-AABB solid push-out (pure, tested)
src/assets.js   image loader + vector placeholder fallback (tested)
src/world.js    scene, city, landmarks, gas stations, food stands, light, bumps, pedestrians, solids
src/daynight.js continuous time-of-day lighting cycle
src/avatar.js   on-foot blocky Roblox-style character
src/player.js   motorcycle + driving physics
src/camera.js   shared smoothed follow camera (+ shake)
src/mount.js    on-foot ⇄ bike mode controller
src/traffic.js  looping cars, traffic light, car collision
src/ui.js       HUD, meters, order card, vignette, payout, summary
src/main.js     bootstrap, render loop, input, wiring

tests/          node:test logic suites + headless puppeteer harness
```

## Tests

```bash
node --test                # 26 logic tests (state machine, food rules, needs, collision, assets)
node tests/phase2.mjs      # headless browser: mount, clock-in, crash→remake, refuel, eat,
                           #   solid collision, day/night, full shift to summary
```
