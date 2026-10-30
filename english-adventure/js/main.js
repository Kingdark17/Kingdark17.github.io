/* ===== MAIN: game loop, title screen, input, start / continue ===== */
(function(){
const $ = EA.$, ui = EA.ui, W = EA.world;
const canvas = $('game'), ctx = canvas.getContext('2d');
const tcv = $('titleBg'), tctx = tcv.getContext('2d');
let running = false, last = performance.now(), autosave = 0;
const M = EA.main = {};

function resize(){
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
  tcv.width = canvas.width; tcv.height = canvas.height;
}
window.addEventListener('resize', resize); resize();

/* ---------- title ---------- */
M.refreshTitle = function(){ $('tContinue').disabled = !EA.hasSave(); };
M.toTitle = function(){
  running = false; ['hud', 'controlsHint', 'prompt', 'touch'].forEach(id => $(id).classList.add('hidden'));
  ui.endDialog(); $('title').classList.remove('hidden'); M.refreshTitle();
};
function showGameUI(){
  $('title').classList.add('hidden'); $('hud').classList.remove('hidden'); $('controlsHint').classList.remove('hidden');
  if (('ontouchstart' in window) || navigator.maxTouchPoints > 0) $('touch').classList.remove('hidden');
  EA.updateHUD(); running = true; last = performance.now();
}
M.begin = function(){          // new game after character creation
  const s = EA.state;
  s.map = 'home'; s.x = 8 * 32; s.y = 9 * 32; s.dir = 'down';
  W.npcCache = {}; W.setHuntItems(null); W.walkDist = 0;
  W.setMap('home', s.x, s.y, 'down');
  showGameUI();
  EA.discover('home');
  EA.save(true);
  EA.toast('Welcome, ' + s.name + '! Talk to Grandma Rose 👵', 'good');
  setTimeout(() => EA.toast('Move: WASD / arrows • Interact: E', ''), 1800);
};
M.resume = function(){
  const s = EA.state;
  W.npcCache = {}; W.setHuntItems(null); W.walkDist = 0;
  const m = EA.MAPS[s.map] || EA.MAPS.home;
  W.setMap(m.id, s.x, s.y, s.dir);
  if (W.blocked({x: s.x - 6, y: s.y - 8, w: 12, h: 8})) {
    if (m.interior) W.setMap(m.id, m.W / 2, m.H - 2 * 32 + 8, 'up');
    else { const sp = m.spawnAt.home; W.setMap(m.id, sp.x, sp.y, 'down'); }
  }
  showGameUI();
  EA.toast('Welcome back, ' + s.name + '! 👋', 'good');
};

/* ---------- title buttons ---------- */
$('tPlay').onclick = () => {
  const start = () => { EA.resetGame(); ui.customize(true); };
  if (EA.hasSave()) {
    ui.open('<h2>New adventure</h2><div class="msg">You already have a saved game. Starting a new adventure will <b>replace</b> it.</div><p class="row"><button id="npYes">▶ Start new game</button><button data-close>↩ Keep my game</button></p>');
    $('npYes').onclick = () => { ui.close(); start(); };
  } else start();
};
$('tContinue').onclick = () => { if (EA.load()) M.resume(); else EA.toast('No saved game found.', 'bad'); };
$('tSettings').onclick = () => ui.settings(true);
$('tHow').onclick = () => ui.howTo();
$('tAbout').onclick = () => ui.about();

/* ---------- HUD buttons ---------- */
const canMenu = () => running && !ui.isOpen() && !W.transition && $('dialog').classList.contains('hidden');
$('btnInv').onclick = () => { if (canMenu()) ui.inventory(); };
$('btnMap').onclick = () => { if (canMenu()) ui.map(); };
$('btnQuests').onclick = () => { if (canMenu()) ui.quests(); };
$('hudQuest').onclick = () => { if (canMenu()) ui.quests(); };
$('btnSettings').onclick = () => { if (canMenu()) ui.settings(false); };
$('btnPet').onclick = () => { if (canMenu()) ui.petMenu(); };
const musicBtn = () => { $('btnMusic').textContent = EA.settings.music === false ? '🔇' : '🎵'; };
$('btnMusic').onclick = () => { EA.settings.music = EA.settings.music === false; EA.saveSettings(); musicBtn(); if (EA.music) { EA.music.unlock(); EA.music.update(); } EA.toast(EA.settings.music ? '🎵 Music on' : '🔇 Music off', ''); };
musicBtn();

/* ---------- keyboard ---------- */
const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
window.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'textarea';
  if (e.code === 'Escape') {
    if (ui.isOpen()) ui.close();
    else if (!$('dialog').classList.contains('hidden')) ui.endDialog();
    else if (running && !W.transition) ui.settings(false);
    return;
  }
  if (typing) return;
  if (!running) return;
  if (GAME_KEYS.includes(e.code) && !ui.isOpen()) e.preventDefault();
  EA.keys[e.code] = true;
  if (e.repeat) return;
  const dlgOpen = !$('dialog').classList.contains('hidden');
  if (dlgOpen) {
    const bs = $('dlgChoices').querySelectorAll('button');
    if (/^Digit[1-9]$/.test(e.code)) { const b = bs[+e.code.slice(5) - 1]; if (b) b.click(); }
    else if ((e.code === 'KeyE' || e.code === 'Space') && bs.length === 1) bs[0].click();
    return;
  }
  if (ui.isOpen()) return;
  if (e.code === 'KeyE') W.interact();
  else if (e.code === 'KeyI') ui.inventory();
  else if (e.code === 'KeyM') ui.map();
  else if (e.code === 'KeyQ') ui.quests();
});
window.addEventListener('keyup', e => { EA.keys[e.code] = false; });
window.addEventListener('blur', () => { EA.keys = {}; });

/* ---------- touch controls ---------- */
document.querySelectorAll('#dpad button').forEach(b => {
  const k = 't' + b.dataset.k;
  const on = e => { e.preventDefault(); EA.keys[k] = true; }, off = e => { e.preventDefault(); EA.keys[k] = false; };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
});
$('touchE').addEventListener('pointerdown', e => { e.preventDefault(); if (running && !ui.isOpen() && $('dialog').classList.contains('hidden')) W.interact(); });

/* ---------- loop ---------- */
function frame(now){
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (EA.music) EA.music.update();
  if (running) {
    const frozen = ui.blocking();
    W.update(dt, frozen);
    EA.state.playTime += dt;
    EA.petTick(dt * (frozen ? 0.3 : 1));
    autosave += dt; if (autosave > 20) { autosave = 0; EA.save(true); }
    W.render(ctx, canvas.width, canvas.height);
  } else if (!$('title').classList.contains('hidden')) {
    const s = 2, vw = tcv.width / s, vh = tcv.height / s, m = EA.MAPS.town;
    const k = (Math.sin(now / 14000) + 1) / 2;
    const camX = Math.round(60 + k * Math.max(0, m.W - vw - 120)), camY = Math.round(Math.max(0, 10 * 32 - vh / 4));
    W.renderBackdrop(tctx, tcv.width, tcv.height, camX, camY, s);
  }
  requestAnimationFrame(frame);
}
window.addEventListener('beforeunload', () => { if (running) EA.save(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && running) EA.save(true); });

/* ---------- boot ---------- */
EA.applySettings();
M.refreshTitle();
requestAnimationFrame(frame);
})();
