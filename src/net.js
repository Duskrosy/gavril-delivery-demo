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

  // onWelcome(welcome) fires once we've joined; onFail(reason) fires once if
  // we can't (no URL, error, closed early, or timeout) → caller falls back to
  // single-player. Non-blocking: the game stays playable while we try.
  connect(onWelcome, onFail) {
    this._onWelcome = onWelcome;
    this.joined = false;
    let failed = false;
    const fail = (reason) => { if (!failed && !this.joined) { failed = true; onFail?.(reason); } };

    if (!this.url) { fail('no server set'); return; }
    if (typeof WebSocket === 'undefined') { fail('this browser has no WebSocket'); return; }

    // nudge the host awake (free hosts sleep) — the request alone wakes it
    try { fetch(this.url.replace(/^ws/, 'http'), { mode: 'no-cors' }).catch(() => {}); } catch { /* ignore */ }

    let ws;
    try { ws = new WebSocket(this.url); } catch { fail('bad server URL'); return; }
    this.ws = ws;

    const timer = setTimeout(() => fail('server didn’t respond (it may be waking up — refresh in a moment)'), 12000);

    ws.onopen = () => { this.connected = true; };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'welcome') {
        clearTimeout(timer);
        this.joined = true;
        this.selfId = m.id; this.name = m.name; this.color = m.color;
        this._onWelcome?.(m);
      } else if (m.t === 'players') {
        this._snapshot = m.players || [];
      }
    };
    ws.onclose = () => { this.connected = false; clearTimeout(timer); fail('server unavailable'); };
    ws.onerror = () => { fail('couldn’t reach the server'); };
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
