/* ===== CORE: state, save/load, settings, audio, quests, progression ===== */
(function(){
const SAVE_KEY = 'english_adventure_save_v1';
const SET_KEY = 'english_adventure_settings_v1';

/* ---------- helpers ---------- */
EA.rand = (a, b) => a + Math.random() * (b - a);
EA.randInt = (a, b) => Math.floor(EA.rand(a, b + 1));
EA.pick = arr => arr[Math.floor(Math.random() * arr.length)];
EA.shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
EA.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
EA.$ = id => document.getElementById(id);
EA.esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
EA.fill = s => String(s).replace(/\{name\}/g, EA.state ? EA.state.name : 'Player');

/* ---------- settings ---------- */
EA.settings = {audio: true, translate: true, textSize: 0, contrast: false, rate: 0.9, voiceURI: '', voiceMode: 'hq', autoRead: true, volMaster: 0.8, volMusic: 0.5, volVoice: 1, volFx: 0.7, music: true, charVoices: true, dayNight: true};
try { Object.assign(EA.settings, JSON.parse(localStorage.getItem(SET_KEY) || '{}')); } catch (e) {}
EA.saveSettings = () => { try { localStorage.setItem(SET_KEY, JSON.stringify(EA.settings)); } catch (e) {} };
EA.applySettings = () => {
  document.body.classList.toggle('text-large', EA.settings.textSize === 1);
  document.body.classList.toggle('text-xlarge', EA.settings.textSize === 2);
  document.body.classList.toggle('high-contrast', !!EA.settings.contrast);
  if (!EA.settings.audio && window.speechSynthesis) window.speechSynthesis.cancel();
};

/* ---------- voice (browser speech synthesis) ---------- */
// Picks the most natural voices available (Edge "Natural", Google, Apple "Premium/Enhanced"...),
// gives each character its own voice/pitch, and supports word-by-word highlighting.
EA.voice = {list: [], en: null, pt: null, ready: false};
const FEMALE = /female|woman|aria|jenny|ava\b|emma|samantha|zira|susan|karen|moira|tessa|victoria|libby|sonia|natasha|michelle|allison|joanna|salli|kimberly|ivy|kendra|catherine|hazel|serena|nicky|ana\b|jane|sara|nancy|amber|ashley|cora|elizabeth|monica|clara|google us english|google uk english female|francisca|thalita|luciana|maria/i;
const MALE = /\bmale|guy|david|mark|daniel|alex\b|fred|andrew|brian|christopher|eric|roger|ryan|thomas|steffan|george|james|aaron|arthur|davis|jason|tony|william|oliver|google uk english male|antonio|donato|felipe/i;
EA.voiceGender = v => FEMALE.test(v.name) ? 'f' : MALE.test(v.name) ? 'm' : '?';
EA.voiceScore = function(v){
  const n = v.name; let s = 0;
  if (/natural|neural/i.test(n)) s += 70;
  if (/premium|enhanced|siri/i.test(n)) s += 50;
  if (/google/i.test(n)) s += 38;
  if (/online/i.test(n)) s += 20;
  if (/^en[-_]US/i.test(v.lang)) s += 8; else if (/^en[-_](GB|AU|CA|IE)/i.test(v.lang)) s += 4;
  if (/compact|espeak|robot|novelty|bad news|bells|boing|bubbles|cellos|whisper|zarvox|trinoids|albert|jester|organ|superstar|wobble/i.test(n)) s -= 80;
  if (/desktop/i.test(n)) s -= 4;
  if (v.default) s += 2;
  return s;
};
function loadVoices(){
  if (!window.speechSynthesis) return;
  const all = speechSynthesis.getVoices() || [];
  const en = all.filter(v => /^en/i.test(v.lang)).sort((a, b) => EA.voiceScore(b) - EA.voiceScore(a));
  EA.voice.list = en;
  EA.voice.en = en.find(v => v.voiceURI === EA.settings.voiceURI) || en[0] || null;
  const pt = all.filter(v => /^pt/i.test(v.lang)).sort((a, b) => (EA.voiceScore(b) + (/BR/i.test(b.lang) ? 15 : 0)) - (EA.voiceScore(a) + (/BR/i.test(a.lang) ? 15 : 0)));
  EA.voice.pt = pt[0] || null;
  EA.voice.ready = all.length > 0;
}
EA.loadVoices = loadVoices;
if (window.speechSynthesis) {
  loadVoices();
  if (speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', loadVoices); else speechSynthesis.onvoiceschanged = loadVoices;
  setTimeout(loadVoices, 600); setTimeout(loadVoices, 2000);
}
// voice personality of each character: gender, pitch and speed
EA.NPC_VOICE = {
  rose: {g: 'f', pitch: 1.05, rate: 0.85}, lily: {g: 'f', pitch: 1.25, rate: 1}, tom: {g: 'm', pitch: 1.35, rate: 1.05},
  sam: {g: 'm', pitch: 0.8, rate: 0.82}, ben: {g: 'm', pitch: 1.3, rate: 1}, walker: {g: 'm', pitch: 0.95, rate: 0.95},
  greenms: {g: 'f', pitch: 1.05, rate: 0.88}, anna: {g: 'f', pitch: 1.3, rate: 1}, clara: {g: 'f', pitch: 1.15, rate: 0.95},
  paws: {g: 'm', pitch: 1, rate: 0.92}, rosa: {g: 'f', pitch: 1.1, rate: 0.95}, leo: {g: 'm', pitch: 0.85, rate: 0.95}, fresh: {g: 'm', pitch: 1.05, rate: 0.97}
};
function voiceFor(g){
  const L = EA.voice.list, base = EA.voice.en;
  if (!base || !g || g === '?') return base;
  if (EA.voiceGender(base) === g) return base;
  const top = EA.voiceScore(base);
  const cand = L.find(v => EA.voiceGender(v) === g && EA.voiceScore(v) >= top - 35);
  return cand || base;
}
let speakTimer = 0;
/* ---------- recorded neural voices (assets/voice/*.mp3, listed in js/voice-manifest.js) ---------- */
EA.VOICE_FILES = EA.VOICE_FILES || {};
EA.normKey = s => String(s).replace(/\{name\}/g, '').replace(/['’]/g, '').toLowerCase().replace(/[^a-z0-9à-ú ]+/g, ' ').replace(/\s+/g, ' ').trim();
EA.recordedFor = function(text, opts){
  opts = opts || {};
  if (EA.settings.voiceMode === 'browser') return null;
  const n = EA.normKey(text); if (!n) return null;
  const vid = opts.lang === 'pt' ? 'pt' : opts.who ? opts.who : opts.player ? 'p' : 'n';
  return EA.VOICE_FILES[vid + '|' + n] || (vid !== 'pt' ? EA.VOICE_FILES['n|' + n] : null) || null;
};
let audioEl = null, current = null;
EA.canSpeak = () => !!(EA.settings.audio && ((window.speechSynthesis && window.SpeechSynthesisUtterance) || Object.keys(EA.VOICE_FILES).length));
EA.stopSpeech = () => {
  clearTimeout(speakTimer);
  if (current) { const c = current; current = null; c.stop(); }
  try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {}
};
function playRecorded(rec, text, opts){
  EA.stopSpeech();
  const a = audioEl || (audioEl = new Audio());
  let rate = (EA.settings.rate || 0.9) / 0.9; if (opts.slow) rate *= 0.7;
  rate = Math.max(0.5, Math.min(1.6, rate));
  let ended = false, started = false, raf = 0;
  const handle = {};
  const finish = cb => { if (ended) return; ended = true; EA.speakingWho = null; cancelAnimationFrame(raf); a.onended = a.onerror = a.onplaying = null; if (current === handle) current = null; if (cb) cb(); };
  handle.stop = () => { try { a.pause(); } catch (e) {} finish(opts.onend); };
  const tick = () => { if (ended) return; if (opts.onprogress && a.duration) opts.onprogress(Math.min(1, a.currentTime / a.duration)); raf = requestAnimationFrame(tick); };
  const fallback = () => finish(() => speakTTS(text, opts));
  a.onended = () => { if (opts.onprogress) opts.onprogress(1); finish(opts.onend); };
  a.onerror = fallback;
  a.onplaying = () => { a.playbackRate = rate; if (!started) { started = true; EA.speakingWho = opts.who || (opts.player ? 'player' : 'n'); if (opts.onstart) opts.onstart(); tick(); } };
  a.preservesPitch = a.mozPreservesPitch = a.webkitPreservesPitch = true;
  a.src = 'assets/voice/' + rec[0] + '.mp3';
  a.volume = Math.max(0, Math.min(1, EA.vol ? EA.vol('voice') : 1));
  a.defaultPlaybackRate = rate; a.playbackRate = rate;
  current = handle;
  const p = a.play(); if (p && p.catch) p.catch(fallback);
  return handle;
}
// opts: {who: npcId, player: true, lang: 'pt', slow: true, onboundary, onprogress, onstart, onend}
EA.say = function(text, opts){
  opts = opts || {};
  if (!EA.settings.audio || !text) { if (opts.onend) setTimeout(opts.onend, 0); return null; }
  const rec = EA.recordedFor(text, opts);
  if (rec) return playRecorded(rec, text, opts);
  return speakTTS(text, opts);
};
function speakTTS(text, opts){
  opts = opts || {};
  if (!EA.settings.audio || !window.speechSynthesis || !window.SpeechSynthesisUtterance || !text) { if (opts.onend) setTimeout(opts.onend, 0); return null; }
  if (!EA.voice.list.length) loadVoices();
  try {
    const clean = EA.fill(String(text)).replace(/_{2,}/g, ' blank ').replace(/[🔊⭐✔✖▶↩]/g, '').trim();
    const u = new SpeechSynthesisUtterance(clean);
    let rate = EA.settings.rate || 0.9, pitch = 1, v = null;
    if (opts.lang === 'pt') { v = EA.voice.pt; u.lang = v ? v.lang : 'pt-BR'; }
    else {
      const pv = opts.who && EA.settings.charVoices ? EA.NPC_VOICE[opts.who] : null;
      v = pv ? voiceFor(pv.g) : EA.voice.en;
      if (pv) { rate *= pv.rate; pitch = pv.pitch; }
      u.lang = v ? v.lang : 'en-US';
    }
    if (v) u.voice = v;
    if (opts.slow) rate *= 0.62;
    // natural/online voices already sound slower; keep inside a comfortable range
    u.rate = Math.max(0.45, Math.min(1.4, rate)); u.pitch = Math.max(0.5, Math.min(1.8, pitch)); u.volume = Math.max(0, Math.min(1, EA.vol ? EA.vol('voice') : 1));
    if (opts.onboundary) u.onboundary = opts.onboundary;
    u.onstart = () => { EA.speakingWho = opts.who || (opts.player ? 'player' : 'n'); if (opts.onstart) opts.onstart(); };
    let ended = false; const end = () => { if (ended) return; ended = true; EA.speakingWho = null; if (opts.onend) opts.onend(); };
    u.onend = end; u.onerror = end;
    clearTimeout(speakTimer);
    if (current) { const c = current; current = null; c.stop(); }
    speechSynthesis.cancel();
    // a short pause after cancel() avoids the Chrome bug where the new utterance is swallowed
    speakTimer = setTimeout(() => { try { speechSynthesis.resume(); speechSynthesis.speak(u); } catch (e) { end(); } }, 80);
    return u;
  } catch (e) { if (opts.onend) setTimeout(opts.onend, 0); return null; }
};
document.addEventListener('visibilitychange', () => { if (document.hidden) EA.stopSpeech(); });
let actx = null;
EA.beep = function(type){
  if (!EA.vol || EA.vol('fx') <= 0) return;
  try {
    actx = (EA.music && EA.music.audioCtx()) || actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const out = (EA.music && EA.music.ctx === actx) ? EA.music.fxBus() : actx.destination;
    const seq = type === 'good' ? [[660,.08],[880,.12]] : type === 'bad' ? [[220,.15]] : type === 'level' ? [[523,.1],[659,.1],[784,.1],[1046,.2]] : [[440,.05]];
    let t = actx.currentTime;
    seq.forEach(([f, d]) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(0.05 * EA.vol('fx'), t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + d); t += d;
    });
  } catch (e) {}
};

/* ---------- toast ---------- */
EA.toast = function(msg, kind){
  const box = EA.$('toasts');
  const d = document.createElement('div');
  d.className = 'toast ' + (kind || '');
  d.textContent = msg;
  box.appendChild(d);
  while (box.children.length > 4) box.removeChild(box.firstChild);
  setTimeout(() => d.remove(), 3200);
};

/* ---------- state ---------- */
EA.newState = function(){
  const inv = {};
  Object.values(EA.ITEMS).forEach(i => { if (i.start) inv[i.id] = 1; });
  return {
    v: 1, name: 'Player',
    look: {skin: 1, hair: 0, hc: 1, style: 'short'},
    outfit: {top: 'tshirt_white', bottom: 'pants_blue', shoes: 'shoes_brown', hat: null, glasses: null, jacket: null, acc: null, dress: null},
    inv, coins: 50, xp: 0, level: 1,
    q: {}, discovered: {}, learned: {}, flags: {}, stats: {},
    pet: null,
    map: 'home', x: 8 * 32, y: 9 * 32, dir: 'down',
    playTime: 0
  };
};
EA.state = EA.newState();
EA.hasSave = () => { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } };
EA.save = function(quiet){
  try {
    const s = EA.state;
    if (EA.world && EA.world.player) { s.x = EA.world.player.x; s.y = EA.world.player.y; s.dir = EA.world.player.dir; s.map = EA.world.mapId; }
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    if (!quiet) EA.toast('Game saved 💾', 'good');
  } catch (e) { if (!quiet) EA.toast('Could not save the game', 'bad'); }
};
EA.load = function(){
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!raw) return false;
    const base = EA.newState();
    EA.state = Object.assign(base, raw);
    EA.state.look = Object.assign(base.look, raw.look);
    EA.state.outfit = Object.assign(base.outfit, raw.outfit);
    return true;
  } catch (e) { return false; }
};
EA.resetGame = function(){
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  EA.state = EA.newState();
};

/* ---------- inventory & clothes ---------- */
EA.count = id => EA.state.inv[id] || 0;
EA.has = id => EA.count(id) > 0;
EA.giveItem = function(id, n){
  n = n || 1;
  const it = EA.ITEMS[id]; if (!it) return;
  const had = EA.count(id);
  EA.state.inv[id] = had + n;
  if (it.word) EA.learn(it.word);
  if (!had) EA.emit('own', id);
};
EA.takeItem = function(id, n){
  n = n || 1;
  if (EA.count(id) < n) return false;
  EA.state.inv[id] -= n;
  if (EA.state.inv[id] <= 0 && !EA.ITEMS[id].start) delete EA.state.inv[id];
  return true;
};
EA.equip = function(id){
  const it = EA.ITEMS[id]; if (!it || !it.slot || !EA.has(id)) return false;
  const o = EA.state.outfit;
  if (it.slot === 'dress') { o.dress = id; }
  else { o[it.slot] = id; if (it.slot === 'top' || it.slot === 'bottom') o.dress = null; }
  EA.emit('wear', id);
  return true;
};
EA.unequip = function(slot){ EA.state.outfit[slot] = null; };

/* ---------- learning ---------- */
EA.learn = function(wordId, silent){
  const w = EA.WORD[wordId]; if (!w) return;
  const L = EA.state.learned;
  if (!L[wordId]) {
    L[wordId] = 1;
    if (!silent) EA.toast('New word: ' + w.en + ' = ' + w.pt, 'good');
    EA.addXP(2, true);
    EA.emit('learn');
  } else L[wordId]++;
};
EA.learnedCount = () => Object.keys(EA.state.learned).length;

/* ---------- XP / coins / levels ---------- */
EA.addCoins = function(n){ EA.state.coins = Math.max(0, EA.state.coins + n); EA.updateHUD && EA.updateHUD(); };
EA.addXP = function(n, quiet){
  const s = EA.state;
  s.xp += n;
  const L = EA.levelFor(s.xp);
  while (s.level < L.lv) {
    s.level++;
    const lv = EA.LEVELS.find(l => l.lv === s.level);
    EA.beep('level');
    if (EA.world && EA.world.burst && EA.world.map) EA.world.burst('confetti');
    EA.toast('⭐ LEVEL UP! Level ' + lv.lv + ' — ' + lv.name, 'good');
    if (lv.rew) {
      if (lv.rew.coins) s.coins += lv.rew.coins;
      (lv.rew.items || []).forEach(id => { EA.giveItem(id, 1); EA.toast('Reward unlocked: ' + EA.ITEMS[id].name + ' ' + EA.ITEMS[id].icon, 'good'); });
      if (lv.rew.text) EA.toast(lv.rew.text, 'good');
    }
    EA.save(true);
  }
  EA.updateHUD && EA.updateHUD();
};
EA.applyReward = function(r){
  if (!r) return;
  if (r.coins) EA.addCoins(r.coins);
  if (r.items) Object.entries(r.items).forEach(([id, n]) => { EA.giveItem(id, n); EA.toast('Reward: ' + EA.ITEMS[id].name + ' ' + EA.ITEMS[id].icon + (n > 1 ? ' x' + n : ''), 'good'); });
  if (r.xp) EA.addXP(r.xp);
};

/* ---------- quests ---------- */
EA.qstate = id => EA.state.q[id] || (EA.state.q[id] = {p: 0, done: false});
EA.emit = function(ev, arg){
  EA.QUESTS.forEach(q => {
    if (q.ev !== ev) return;
    if (q.arg !== undefined && q.arg !== arg) return;
    const st = EA.qstate(q.id);
    if (st.done) return;
    st.p++;
    if (st.p >= q.n) completeQuest(q);
    EA.updateHUD && EA.updateHUD();
  });
};
function completeQuest(q){
  const st = EA.qstate(q.id);
  st.done = true; st.p = q.n;
  EA.beep('good');
  EA.toast('✅ Quest complete: ' + q.name, 'good');
  if (EA.world && EA.world.burst && EA.world.map) EA.world.burst('sparkle');
  EA.applyReward(q.rew);
  const mains = EA.QUESTS.filter(x => x.main && x.id !== 'm9');
  if (q.main && mains.every(x => EA.qstate(x.id).done) && !EA.qstate('m9').done) {
    setTimeout(() => EA.emit('__main'), 600);
  }
  if (q.id === 'm9') {
    EA.state.flags.finished = true;
    setTimeout(() => EA.ui && EA.ui.showEnding && EA.ui.showEnding(), 1200);
  }
  EA.save(true);
}
EA.currentQuest = () => EA.QUESTS.find(q => q.main && !EA.qstate(q.id).done && q.id !== 'm9') || EA.QUESTS.find(q => !EA.qstate(q.id).done);
EA.discover = function(placeId){
  if (EA.state.discovered[placeId]) return;
  EA.state.discovered[placeId] = true;
  const p = EA.PLACES[placeId];
  EA.toast('📍 Discovered: ' + p.name + ' (' + p.pt + ')', 'good');
  EA.addXP(5, true);
  EA.learn(EA.wordId(p.name) || '', true);
  EA.emit('discover', placeId);
  EA.emit('place', placeId);
};

/* ---------- pet ---------- */
EA.petHappiness = () => { const p = EA.state.pet; return p ? Math.round((p.hunger + p.thirst + p.fun + p.love) / 4) : 0; };
EA.petMood = () => { const h = EA.petHappiness(); return h > 70 ? '😄' : h > 45 ? '🙂' : h > 25 ? '😐' : '😢'; };
EA.petTick = function(dt){
  const p = EA.state.pet; if (!p) return;
  p.hunger = Math.max(5, p.hunger - 0.10 * dt);
  p.thirst = Math.max(5, p.thirst - 0.14 * dt);
  p.fun = Math.max(5, p.fun - 0.12 * dt);
  p.love = Math.max(5, p.love - 0.05 * dt);
};

/* ---------- input ---------- */
EA.keys = {};
EA.input = {dx: 0, dy: 0};
EA.updateInput = function(){
  const k = EA.keys;
  EA.input.dx = (k.ArrowRight || k.KeyD || k.tright ? 1 : 0) - (k.ArrowLeft || k.KeyA || k.tleft ? 1 : 0);
  EA.input.dy = (k.ArrowDown || k.KeyS || k.tdown ? 1 : 0) - (k.ArrowUp || k.KeyW || k.tup ? 1 : 0);
};
})();
