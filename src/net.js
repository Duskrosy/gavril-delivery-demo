// ============================================================
//  GAVRIL — One Shift · net.js
//  Thin multiplayer client: connects to the relay server, sends our
//  state, and keeps the latest snapshot of everyone else. Fully
//  optional — with no server URL it stays dormant (single-player).
// ============================================================

export class Net {
  constructor(url) {
    this.url = url || '';
    this.ws = null;
    this.connected = false;
    this.selfId = null;
    this.name = null;
    this.color = null;
    this._snapshot = [];
    this._onWelcome = null;
  }

  connect(onWelcome) {
    this._onWelcome = onWelcome;
    if (!this.url || typeof WebSocket === 'undefined') return;
    let ws;
    try { ws = new WebSocket(this.url); } catch { return; }
    this.ws = ws;
    ws.onopen = () => { this.connected = true; };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'welcome') {
        this.selfId = m.id; this.name = m.name; this.color = m.color;
        this._onWelcome?.(m);
      } else if (m.t === 'players') {
        this._snapshot = m.players || [];
      }
    };
    ws.onclose = () => { this.connected = false; };
    ws.onerror = () => { /* swallow — stay single-player */ };
  }

  send(state) {
    if (this.connected && this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ t: 'state', ...state }));
    }
  }

  // everyone except us
  remotes() { return this._snapshot.filter((p) => p.id !== this.selfId); }
  get online() { return this._snapshot.length; }
}
