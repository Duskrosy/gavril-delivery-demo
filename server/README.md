# Gavril: One Shift — multiplayer server

A tiny single-room WebSocket relay. Every player who connects gets a random
name + color and is broadcast to everyone else. No database, no accounts.

## Run locally

```bash
cd server
npm install
npm start            # listens on ws://localhost:8080
```

Then open the game pointed at it (two tabs to see yourself twice):

```
http://localhost:8000/?server=ws://localhost:8080
```

(Serve the game with `python -m http.server 8000` from `web-demo/` as usual.)

## Host it (so friends can join over the internet)

Any Node host works. Easiest free options — deploy this `server/` folder:

- **Render** (render.com): New → Web Service → connect the repo → Root Directory
  `server`, Build `npm install`, Start `npm start`. It gives you a URL like
  `gavril-mp.onrender.com`. Use `wss://gavril-mp.onrender.com` as the server URL.
- **Railway / Fly.io / Glitch**: same idea — Node app, start `npm start`, it
  binds to `process.env.PORT` automatically.

The server answers plain HTTP on `/` (a health line) so platform health checks pass.

## Point the game at your server

Two ways:
1. **Per-link:** share `https://duskrosy.github.io/gavril-delivery-demo/?server=wss://YOUR-HOST`
2. **Baked in:** set `MULTIPLAYER.url` in `web-demo/src/config.js` to your `wss://…`
   URL and redeploy the page. Then plain visits are multiplayer by default.

Use `wss://` (secure) when the game is served over https (GitHub Pages is https) —
browsers block insecure `ws://` from an https page.
