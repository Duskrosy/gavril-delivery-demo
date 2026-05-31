// ============================================================
//  GAVRIL — One Shift · ui.js
//  DOM-overlay HUD: stats, order card, waypoint arrow, hand-off
//  vignette, payout, and shift summary. Knows nothing about Three.js.
// ============================================================

const CHOICES = [
  { key: 'friendly', tag: 'FRIENDLY', label: 'Warm & chatty — “Hey! Enjoy your night.”' },
  { key: 'quick',    tag: 'QUICK',    label: 'Quick & efficient — “Order up, have a good one.”' },
  { key: 'polite',   tag: 'POLITE',   label: 'Polite & formal — “Good evening. With care.”' },
];

const $ = (id) => document.getElementById(id);

function setImage(imgEl, src) {
  if (!imgEl) return;
  // src may be an HTMLImageElement, a placeholder <canvas>, or a string URL.
  if (typeof src === 'string') { imgEl.src = src; return; }
  if (src && src.tagName === 'CANVAS') { imgEl.src = src.toDataURL(); return; }
  if (src && src.src) { imgEl.src = src.src; return; }
}

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'),
      start: $('start'), startBtn: $('start-btn'), loadnote: $('loadnote'),
      clock: $('stat-clock'), cash: $('stat-cash'), rating: $('stat-rating'), progress: $('stat-progress'),
      objective: $('objective'),
      waypoint: $('waypoint'), wpDist: $('wp-dist'), wpArrow: document.querySelector('.wp-arrow'),
      orderCard: $('order-card'), ocImg: $('oc-img'), ocFood: $('oc-food'),
      ocCust: $('oc-cust'), ocPay: $('oc-pay'), ocAddr: $('oc-addr'), ocAccept: $('oc-accept'),
      toast: $('toast'),
      modeChip: $('mode-chip'), modeText: $('mode-text'),
      fillGas: $('fill-gas'), fillHunger: $('fill-hunger'), carry: $('carry'), prompt: $('prompt'),
      vignette: $('vignette'), vgImg: $('vg-img'), vgName: $('vg-name'), vgLine: $('vg-line'), vgChoices: $('vg-choices'),
      payout: $('payout'), poTotal: $('po-total'), poBreak: $('po-break'), poStars: $('po-stars'), poContinue: $('po-continue'),
      summary: $('summary'), sumCash: $('sum-cash'), sumRating: $('sum-rating'), sumOrders: $('sum-orders'), sumReplay: $('sum-replay'),
    };
    this._toastTimer = null;
  }

  // --- start -------------------------------------------------------------
  onStart(cb) { this.el.startBtn.addEventListener('click', cb); }
  setReady() { this.el.startBtn.disabled = false; this.el.loadnote.textContent = 'ready when you are.'; }
  beginPlay() {
    this.el.start.classList.add('hidden');
    this.el.hud.classList.remove('hidden');
  }

  // --- stats -------------------------------------------------------------
  setStats({ cash, avgRating, served, total, clock }) {
    if (cash != null) this.el.cash.textContent = `$${cash}`;
    if (avgRating != null) this.el.rating.textContent = `★ ${avgRating.toFixed(1)}`;
    if (served != null && total != null) this.el.progress.textContent = `${served} / ${total}`;
    if (clock) this.el.clock.textContent = clock;
  }

  // --- objective ---------------------------------------------------------
  setObjective(html) {
    this.el.objective.innerHTML = html;
    this.el.objective.classList.toggle('show', !!html);
  }

  // --- needs / mode / carry ---------------------------------------------
  setMode(riding, label) {
    this.el.modeChip.classList.toggle('riding', riding);
    this.el.modeText.textContent = label || (riding ? 'RIDING' : 'ON FOOT');
  }
  setNeeds({ gasPct, hungerPct, lowGas, lowHunger }) {
    this.el.fillGas.style.width = `${Math.max(0, Math.min(1, gasPct)) * 100}%`;
    this.el.fillHunger.style.width = `${Math.max(0, Math.min(1, hungerPct)) * 100}%`;
    this.el.fillGas.classList.toggle('low', !!lowGas);
    this.el.fillHunger.classList.toggle('low', !!lowHunger);
  }
  // foodState: 'none' | 'fresh' | 'damaged' | 'destroyed'
  setCarry(foodState) {
    const c = this.el.carry;
    if (!foodState || foodState === 'none') { c.classList.add('hidden'); return; }
    c.classList.remove('hidden', 'damaged', 'destroyed');
    if (foodState === 'damaged') { c.classList.add('damaged'); c.textContent = 'CARRYING · SHAKEN'; }
    else if (foodState === 'destroyed') { c.classList.add('destroyed'); c.textContent = 'FOOD RUINED'; }
    else c.textContent = 'CARRYING · FRESH';
  }
  setPrompt(html) {
    if (!html) { this.el.prompt.classList.add('hidden'); return; }
    this.el.prompt.innerHTML = html;
    this.el.prompt.classList.remove('hidden');
  }

  // --- order card --------------------------------------------------------
  showOrder(order, foodImg, onAccept) {
    setImage(this.el.ocImg, foodImg);
    this.el.ocFood.textContent = order.foodName;
    this.el.ocCust.textContent = `for ${order.customer.name}`;
    this.el.ocPay.textContent = `$${order.basePay}`;
    this.el.ocAddr.textContent = order.addressHint;
    this.el.orderCard.classList.remove('hidden');
    // re-bind accept (replace node to clear old listeners)
    const fresh = this.el.ocAccept.cloneNode(true);
    this.el.ocAccept.replaceWith(fresh);
    this.el.ocAccept = fresh;
    fresh.addEventListener('click', onAccept);
  }
  hideOrderCard() { this.el.orderCard.classList.add('hidden'); }

  // --- waypoint arrow ----------------------------------------------------
  // pose: { visible, x, y, angle (rad), dist (m) }
  setWaypoint(pose) {
    const wp = this.el.waypoint;
    if (!pose.visible) { wp.classList.remove('show'); return; }
    wp.classList.add('show');
    wp.style.left = `${pose.x}px`;
    wp.style.top = `${pose.y}px`;
    this.el.wpArrow.style.transform = `rotate(${pose.angle}rad)`;
    this.el.wpDist.textContent = `${Math.round(pose.dist)}m`;
  }

  // --- toast -------------------------------------------------------------
  toast(text) {
    const t = this.el.toast;
    t.textContent = text;
    t.classList.remove('pop'); void t.offsetWidth; t.classList.add('pop');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('pop'), 1500);
  }

  // --- vignette ----------------------------------------------------------
  openVignette(order, portraitImg, onChoice) {
    setImage(this.el.vgImg, portraitImg);
    this.el.vgName.textContent = order.customer.name;
    this.el.vgLine.textContent = `“${order.customer.line}”`;
    this.el.vgChoices.innerHTML = '';
    for (const c of CHOICES) {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.innerHTML = `<span class="ch-tag">${c.tag}</span>${c.label}`;
      btn.addEventListener('click', () => onChoice(c.key), { once: true });
      this.el.vgChoices.appendChild(btn);
    }
    this.el.vignette.classList.remove('hidden');
  }
  closeVignette() { this.el.vignette.classList.add('hidden'); }

  // --- payout ------------------------------------------------------------
  showPayout(result, onContinue, isLast) {
    this.el.poTotal.textContent = `$${result.total}`;
    this.el.poBreak.textContent = `$${result.pay} fare  +  $${result.tip} tip${result.match ? '  ·  they loved it' : ''}`;
    this.el.poStars.innerHTML = this._stars(result.rating);
    this.el.poContinue.textContent = isLast ? 'Finish shift ▸' : 'Next order ▸';
    this.el.payout.classList.remove('hidden');
    const fresh = this.el.poContinue.cloneNode(true);
    this.el.poContinue.replaceWith(fresh);
    this.el.poContinue = fresh;
    fresh.addEventListener('click', onContinue, { once: true });
  }
  hidePayout() { this.el.payout.classList.add('hidden'); }

  _stars(n) {
    let s = '';
    for (let i = 1; i <= 5; i++) s += i <= n ? '★' : '<span class="empty">★</span>';
    return s;
  }

  // --- summary -----------------------------------------------------------
  showSummary(summary, onReplay) {
    this.el.sumCash.textContent = `$${summary.totalCash}`;
    this.el.sumRating.textContent = `★ ${summary.avgRating.toFixed(1)}`;
    this.el.sumOrders.textContent = `${summary.ordersDone}`;
    this.el.hud.classList.add('hidden');
    this.el.summary.classList.remove('hidden');
    const fresh = this.el.sumReplay.cloneNode(true);
    this.el.sumReplay.replaceWith(fresh);
    this.el.sumReplay = fresh;
    fresh.addEventListener('click', onReplay, { once: true });
  }
  hideSummary() { this.el.summary.classList.add('hidden'); }
}
