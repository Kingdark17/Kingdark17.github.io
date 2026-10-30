/* ===== UI: HUD, overlay, dialogue (LET'S TALK!), menus (inventory, quests, map, settings, progress, words) ===== */
(function(){
const $ = EA.$, esc = EA.esc;
const ui = EA.ui = {};
let onCloseCb = null;

EA.tr = pt => EA.settings.translate ? pt : '';
const trSpan = pt => EA.settings.translate && pt ? ' <small style="color:#6d5f8a">— ' + esc(pt) + '</small>' : '';

/* ---------- HUD ---------- */
EA.updateHUD = function(){
  const s = EA.state; if (!s) return;
  const L = EA.levelFor(s.xp), next = EA.LEVELS.find(l => l.lv === L.lv + 1);
  $('hudName').textContent = s.name;
  $('hudLevel').textContent = 'Lv ' + L.lv + ' ' + L.name;
  const pct = next ? (s.xp - L.xp) / (next.xp - L.xp) * 100 : 100;
  $('hudXpFill').style.width = Math.max(0, Math.min(100, pct)) + '%';
  $('hudXpText').textContent = next ? s.xp + ' / ' + next.xp + ' XP' : s.xp + ' XP (MAX)';
  $('hudCoins').textContent = s.coins;
  const q = EA.currentQuest();
  $('hudQuest').innerHTML = q ? '<b>📜 ' + esc(q.name) + '</b>' + esc(q.goal) + (q.n > 1 ? ' (' + EA.qstate(q.id).p + '/' + q.n + ')' : '') : '<b>📜 All quests done!</b>Explore freely.';
};

/* ---------- overlay ---------- */
ui.blocking = () => !$('overlay').classList.contains('hidden') || !$('dialog').classList.contains('hidden');
ui.open = function(html, onClose){
  const ov = $('overlay'), p = $('panel');
  p.innerHTML = html; ov.classList.remove('hidden'); p.scrollTop = 0;
  onCloseCb = onClose || null;
  ui.bind(p);
  return p;
};
ui.close = function(){
  $('overlay').classList.add('hidden'); $('panel').innerHTML = '';
  const cb = onCloseCb; onCloseCb = null; if (cb) cb();
  EA.updateHUD();
};
ui.isOpen = () => !$('overlay').classList.contains('hidden');
ui.bind = function(root){
  root.querySelectorAll('[data-say]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); EA.say(b.dataset.say); }));
  root.querySelectorAll('[data-slow]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); EA.say(b.dataset.slow, {slow: true}); }));
  root.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => ui.close()));
};
ui.drawPreview = function(canvas, who, u){
  const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
  c.clearRect(0, 0, canvas.width, canvas.height);
  EA.drawCharacter(c, canvas.width / 2, canvas.height - 14, who, 'down', 0, u || 6);
};
ui.petPreview = function(canvas, type, acc, u, mood){
  const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
  c.clearRect(0, 0, canvas.width, canvas.height);
  EA.drawPet(c, canvas.width / 2, canvas.height - 16, type, 'right', 0, acc, mood || 'happy', u || 6);
};
const wordRow = (w, dim) => '<div class="wordcard' + (dim ? ' new' : '') + '"><span><b>' + esc(w.en) + '</b>' + trSpan(w.pt) + '</span><span class="row" style="gap:4px;flex-wrap:nowrap"><button class="listen" data-say="' + esc(w.en) + '">🔊 Listen</button><button class="listen" data-slow="' + esc(w.en) + '" title="Slow">🐢</button></span></div>';
ui.wordRow = wordRow;
const btnClose = '<button data-close>✖ Close</button>';

/* ---------- dialogue ---------- */
let dlg = null;
ui.talk = function(npc){
  const def = EA.DIALOGS[npc.id]; if (!def) return;
  const first = !EA.state.flags['talked_' + npc.id];
  const startId = (!first && def.again) ? def.again : def.start;
  EA.state.flags['talked_' + npc.id] = true;
  npc.talking = true;
  dlg = {npc, def, id: startId, node: null};
  $('dialog').classList.remove('hidden');
  EA.emit('talk', npc.id);
  EA.addXP(first ? 4 : 0, true);
  showNode(startId);
};
ui.endDialog = function(){
  if (dlg) { dlg.npc.talking = false; EA.stopSpeech(); }
  dlg = null; $('dialog').classList.add('hidden');
};

/* ---------- karaoke reading: highlights each word while it is spoken ---------- */
let karaokeId = 0;
ui.karaoke = function(el, text, opts){
  opts = opts || {};
  const full = EA.fill(text);
  const parts = [], re = /\S+/g; let m, last = 0, html = '';
  while ((m = re.exec(full))) { html += esc(full.slice(last, m.index)) + '<span class="kw">' + esc(m[0]) + '</span>'; last = m.index + m[0].length; parts.push({i: m.index, w: m[0]}); }
  el.innerHTML = html + esc(full.slice(last));
  const spans = Array.from(el.querySelectorAll('.kw'));
  spans.forEach((s, j) => s.addEventListener('click', e => { e.stopPropagation(); EA.say(parts[j].w.replace(/[^\w'’-]/g, ''), {who: opts.who}); }));
  if (opts.silent || !EA.canSpeak()) return;
  const id = ++karaokeId;
  let got = false, timer = 0;
  const mark = k => spans.forEach((s, j) => { s.classList.toggle('on', j === k); s.classList.toggle('done', j < k); });
  const clear = () => { clearTimeout(timer); if (id === karaokeId) spans.forEach(s => s.classList.remove('on', 'done')); };
  // timing weights for recorded audio: longer words and pauses after punctuation take more time
  const nm = EA.normKey(EA.state ? EA.state.name : '');
  const weights = parts.map(p => (opts.raw && /\{name\}/.test(opts.raw) && EA.normKey(p.w) === nm) ? 0 : p.w.replace(/[^\w]/g, '').length + 2 + (/[.!?]$/.test(p.w) ? 4 : /[,;:]$/.test(p.w) ? 2 : 0));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  EA.say(opts.raw || full, Object.assign({}, opts, {
    onprogress: f => {
      if (id !== karaokeId) return;
      got = true; clearTimeout(timer);
      let acc = 0, k = 0; const target = f * total * 1.02;
      for (let j = 0; j < parts.length; j++) { if (weights[j] && acc <= target) k = j; acc += weights[j]; }
      mark(f >= 1 ? parts.length : k);
    },
    onboundary: e => {
      if (id !== karaokeId || (e.name && e.name !== 'word')) return;
      got = true; clearTimeout(timer);
      let k = 0; for (let j = 0; j < parts.length; j++) if (e.charIndex >= parts[j].i) k = j;
      mark(k);
    },
    onstart: () => {
      if (id !== karaokeId) return;
      mark(0);
      // some voices never send word events: estimate the timing instead
      timer = setTimeout(function step(k){
        if (got || id !== karaokeId) return;
        k = k || 0; mark(k);
        const rate = (EA.settings.rate || 0.9) * (opts.slow ? 0.62 : 1);
        const ms = (190 + parts[k].w.length * 62) / rate;
        if (k + 1 < parts.length) timer = setTimeout(() => step(k + 1), ms);
      }, 250);
    },
    onend: () => { if (id === karaokeId) clear(); }
  }));
};
function showNode(id){
  if (!dlg) return;
  const node = dlg.def.nodes[id]; if (!node) { ui.endDialog(); return; }
  if (node.fx) { const r = EA.fx(node.fx); if (typeof r === 'string') { showNode(r); return; } if (!dlg) return; }
  dlg.id = id; dlg.node = node;
  (node.learn || []).forEach(w => EA.learn(w));
  const npcDef = EA.NPCS[dlg.npc.id];
  $('dlgName').textContent = npcDef.name + ' · ' + npcDef.role;
  const who = dlg.npc.id;
  ui.karaoke($('dlgText'), node.t, {who, raw: node.t, silent: !EA.settings.autoRead});
  $('dlgPt').textContent = EA.settings.translate ? EA.fill(node.pt || '') : '';
  const fb = $('dlgFeedback'); fb.textContent = ''; fb.className = '';
  $('dlgListen').onclick = () => ui.karaoke($('dlgText'), node.t, {who, raw: node.t});
  $('dlgSlow').onclick = () => ui.karaoke($('dlgText'), node.t, {who, raw: node.t, slow: true});
  const ptb = $('dlgPtBtn');
  ptb.classList.toggle('hidden', !(EA.settings.translate && node.pt && (EA.voice.pt || EA.recordedFor(node.pt, {lang: 'pt'}))));
  ptb.onclick = () => EA.say(node.pt, {lang: 'pt'});
  renderChoices(node);
}
function renderChoices(node){
  const box = $('dlgChoices'); box.innerHTML = '';
  const mk = (label, pt, cb) => {
    const b = document.createElement('button');
    b.innerHTML = esc(EA.fill(label)) + (EA.settings.translate && pt ? '<span class="ch-pt">' + esc(EA.fill(pt)) + '</span>' : '');
    b.addEventListener('click', cb); box.appendChild(b); return b;
  };
  if (node.ch) {
    node.ch.forEach((ch, i) => mk(ch.t, ch.pt, () => pick(node, ch, i)));
    const first = box.querySelector('button'); if (first) first.focus();
  } else {
    const b = mk(node.next ? 'Next ▶' : 'Close ✖', '', () => { if (node.next) showNode(node.next); else ui.endDialog(); });
    b.focus();
  }
}
function pick(node, ch, i){
  const fb = $('dlgFeedback'), box = $('dlgChoices');
  EA.say(ch.t, {player: true});
  if (ch.ok === false) {
    fb.textContent = 'Try another answer! 🤔'; fb.className = 'bad'; EA.beep('bad');
    return;
  }
  let next = ch.next;
  const key = 'rew_' + dlg.npc.id + '_' + dlg.id + '_' + i;
  if (ch.rew && !EA.state.flags[key]) { EA.state.flags[key] = true; EA.applyReward(ch.rew); }
  if (ch.ok === true) { fb.textContent = 'Great job! ⭐'; fb.className = 'good'; EA.beep('good'); }
  if (ch.fx) { const r = EA.fx(ch.fx); if (typeof r === 'string') next = r; if (!dlg) return; }
  if (ch.ok === true) {
    box.innerHTML = '';
    const b = document.createElement('button'); b.textContent = next ? 'Continue ▶' : 'Close ✖';
    b.addEventListener('click', () => { if (next) showNode(next); else ui.endDialog(); });
    box.appendChild(b); b.focus();
  } else {
    if (next) showNode(next); else ui.endDialog();
  }
}

/* ---------- fx dispatcher (dialogue effects) ---------- */
EA.fx = function(code){
  const [kind, arg] = code.split(':');
  if (kind === 'mg') { ui.endDialog(); setTimeout(() => EA.minigames.start(arg), 50); return; }
  if (kind === 'words') { ui.endDialog(); ui.wordBook(true); return; }
  if (kind === 'shop') { ui.endDialog(); ui.shop(arg); return; }
  if (kind === 'adopt') { ui.endDialog(); ui.adoptMenu(); return; }
  if (kind === 'give') {
    const n = EA.state.flags['given_' + arg] || 0;
    if (n < 3) { EA.state.flags['given_' + arg] = n + 1; EA.giveItem(arg, 1); EA.toast('You got: ' + EA.ITEMS[arg].name + ' ' + EA.ITEMS[arg].icon, 'good'); }
    else EA.toast('No more ' + EA.ITEMS[arg].name + 's today!', '');
    return;
  }
  if (kind === 'order') {
    if (EA.state.coins < 5) return 'poor';
    EA.addCoins(-5); EA.giveItem('sandwich', 1); EA.learn('sandwich'); EA.emit('order_sandwich'); EA.addXP(10);
    EA.toast('You paid 5 coins 🪙', ''); return 'r4';
  }
};

/* ---------- interactable objects ---------- */
ui.act = function(a, obj){
  const s = EA.state;
  switch (a.type) {
    case 'wardrobe': ui.wardrobe(); break;
    case 'mirror': ui.customize(false); break;
    case 'wordbook': ui.wordBook(false); break;
    case 'words': ui.wordBook(true); break;
    case 'progress': ui.progress(); break;
    case 'pet': ui.petMenu(); break;
    case 'adopt': ui.adoptMenu(); break;
    case 'shop': ui.shop(a.shop); break;
    case 'market': ui.info(a.title, a.words.map(id => EA.WORD[id]), '<button id="mkBuy">🛒 Buy here</button>', () => { const b = $('mkBuy'); if (b) b.onclick = () => ui.shop('market', a.cat); }); break;
    case 'info': ui.info(a.title, a.cat ? EA.VOCAB.filter(w => w.cat === a.cat) : a.words.map(id => EA.WORD[id])); break;
    case 'bed':
      EA.learn('sleep'); EA.learn('sleep', true);
      if (s.pet) { s.pet.fun = Math.min(100, s.pet.fun + 10); s.pet.love = Math.min(100, s.pet.love + 10); }
      $('fade').classList.add('on'); EA.world.transition = true;
      setTimeout(() => { $('fade').classList.remove('on'); EA.world.transition = false; EA.toast('😴 You slept well! Game saved.', 'good'); EA.save(true); }, 900);
      break;
    case 'fridge':
      ui.open('<h2>🧊 Fridge</h2><p>Yummy food! Click to eat or drink.</p><div class="grid">' +
        ['milk', 'juice', 'cheese', 'egg'].map(id => { const w = EA.WORD[id]; const ic = {milk: '🥛', juice: '🧃', cheese: '🧀', egg: '🥚'}[id]; return '<div class="card" data-f="' + id + '"><span class="ic">' + ic + '</span><b>' + w.en + '</b><small>' + EA.tr(w.pt) + '</small></div>'; }).join('') +
        '</div><p class="row"><button data-close>✖ Close</button></p>');
      $('panel').querySelectorAll('[data-f]').forEach(c => c.onclick = () => { const id = c.dataset.f; EA.say(EA.WORD[id].en); EA.learn(id); EA.learn('eat', true); EA.toast('Yum! 😋', 'good'); });
      break;
    case 'bench':
      EA.learn('bench'); EA.toast('You sit on the bench. Relax! 🌳', ''); if (s.pet) s.pet.love = Math.min(100, s.pet.love + 3); break;
    case 'petplay':
      if (!s.pet) { EA.toast('You need a pet! Visit the Pet Shop 🐶', 'bad'); break; }
      { const now = Date.now(); if (now - (s.flags.lastPlay || 0) < 15000) { EA.toast(s.pet.name + ' is tired. Wait a little!', ''); break; }
        s.flags.lastPlay = now; s.pet.fun = Math.min(100, s.pet.fun + 25); s.pet.love = Math.min(100, s.pet.love + 8);
        EA.learn('play'); EA.learn('run'); EA.addXP(4); EA.toast('🐾 ' + s.pet.name + ' runs and plays! Run! Play!', 'good'); }
      break;
  }
};

/* ---------- word book / lesson ---------- */
ui.wordBook = function(lesson){
  let cat = EA.CATS[0];
  const draw = () => {
    const words = EA.VOCAB.filter(w => w.cat === cat);
    const p = ui.open('<h2>' + (lesson ? '🏫 Learn new words' : '📖 My Word Book') + '</h2>' +
      '<p>' + (lesson ? 'Press 🔊 Listen to hear each word. You learn it when you listen!' : 'Words you learned are bright. Listen to practice!') + ' <b>' + EA.learnedCount() + '/' + EA.VOCAB.length + '</b> learned.</p>' +
      '<div class="tabs">' + EA.CATS.map(c => '<button data-cat="' + c + '" class="' + (c === cat ? 'on' : '') + '">' + c + '</button>').join('') + '</div>' +
      words.map(w => wordRow(w, !EA.state.learned[w.id])).join('') + '<p class="row"><button data-close>✖ Close</button></p>');
    p.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { cat = b.dataset.cat; draw(); });
    if (lesson) p.querySelectorAll('.wordcard').forEach((row, i) => row.querySelector('[data-say]').addEventListener('click', () => { const was = EA.state.learned[words[i].id]; EA.learn(words[i].id); if (!was) { row.classList.remove('new'); } }));
  };
  draw();
};
ui.info = function(title, words, extraHtml, after){
  ui.open('<h2>' + esc(title) + '</h2>' + words.map(w => wordRow(w)).join('') + '<p class="row">' + (extraHtml || '') + '<button data-close>✖ Close</button></p>');
  $('panel').querySelectorAll('[data-say]').forEach((b, i) => b.addEventListener('click', () => EA.learn(words[i].id)));
  if (after) after();
};

/* ---------- progress ---------- */
ui.progress = function(){
  const s = EA.state, L = EA.levelFor(s.xp), next = EA.LEVELS.find(l => l.lv === L.lv + 1);
  const qd = EA.QUESTS.filter(q => EA.qstate(q.id).done).length;
  const bars = EA.CATS.map(c => { const all = EA.VOCAB.filter(w => w.cat === c), got = all.filter(w => s.learned[w.id]).length; return '<div class="row"><span style="width:140px">' + c + '</span><div class="bar"><div style="width:' + got / all.length * 100 + '%"></div></div><span>' + got + '/' + all.length + '</span></div>'; }).join('');
  ui.open('<h2>📊 My Progress</h2><div class="msg"><b>' + esc(s.name) + '</b> — Level ' + L.lv + ': ' + L.name + '<br>XP: ' + s.xp + (next ? ' / ' + next.xp + ' (next: ' + next.name + ')' : ' (MAX LEVEL)') + ' • Coins: 🪙 ' + s.coins + '<br>Quests completed: ' + qd + '/' + EA.QUESTS.length + ' • Words learned: ' + EA.learnedCount() + '/' + EA.VOCAB.length + '</div>' +
    '<h3>Vocabulary by category</h3>' + bars +
    '<h3>Level rewards</h3><div class="row">' + EA.LEVELS.filter(l => l.rew).map(l => '<span class="msg">' + (s.level >= l.lv ? '✅' : '🔒') + ' Lv ' + l.lv + ' ' + l.name + ': ' + (l.rew.items || []).map(i => EA.ITEMS[i].icon + ' ' + EA.ITEMS[i].name).join(', ') + ' +' + l.rew.coins + '🪙</span>').join('') + '</div>' +
    '<h3>Best scores</h3><div class="msg">' + (Object.keys(s.stats).length ? Object.entries(s.stats).map(([k, v]) => k + ': ' + v).join(' • ') : 'Play minigames to set records!') + '</div>' +
    '<p class="row"><button data-close>✖ Close</button></p>');
};

/* ---------- quests ---------- */
ui.quests = function(){
  const item = q => { const st = EA.qstate(q.id); const r = q.rew; const rt = '🏅 ' + (r.xp ? r.xp + ' XP ' : '') + (r.coins ? '🪙' + r.coins + ' ' : '') + (r.items ? Object.keys(r.items).map(i => EA.ITEMS[i].icon).join('') : '');
    return '<div class="quest ' + (st.done ? 'done' : '') + '"><b>' + (st.done ? '✅ ' : '⬜ ') + esc(q.name) + '</b><span class="tag ' + (q.main ? 'main' : '') + '">' + (q.main ? 'MAIN' : 'SIDE') + '</span>' + trSpan(q.pt) + '<br>' + esc(q.desc) + '<br><small>Goal: ' + esc(q.goal) + ' • From: ' + esc(q.giver) + '</small>' +
      '<div class="row"><div class="bar"><div style="width:' + (st.p / q.n * 100) + '%"></div></div><span>' + st.p + '/' + q.n + '</span><small>' + rt + '</small></div></div>'; };
  ui.open('<h2>📜 Quests</h2><h3>Main quests</h3>' + EA.QUESTS.filter(q => q.main).map(item).join('') + '<h3>Side quests</h3>' + EA.QUESTS.filter(q => !q.main).map(item).join('') + '<p class="row"><button data-close>✖ Close</button></p>');
};

/* ---------- inventory ---------- */
ui.inventory = function(){
  const tabs = [['all', 'All'], ['clothes', 'Clothes'], ['acc', 'Accessories'], ['food', 'Food'], ['toy', 'Toys'], ['object', 'Objects'], ['petacc', 'Pet items'], ['reward', 'Rewards']];
  let tab = 'all', sel = null;
  const draw = () => {
    const ids = Object.keys(EA.state.inv).filter(id => EA.ITEMS[id] && EA.count(id) > 0 && (tab === 'all' || EA.ITEMS[id].cat === tab));
    const it = sel && EA.ITEMS[sel];
    let detail = '<div class="msg">Select an item to see its name.</div>';
    if (it) {
      const eq = it.slot && EA.state.outfit[it.slot] === it.id;
      detail = '<div class="msg"><span class="ic" style="font-size:2em">' + it.icon + '</span> <b class="big-word" style="font-size:1.3em">' + esc(it.name) + '</b> <button class="listen" data-say="' + esc(it.name) + '">🔊 Listen</button><br>' + (EA.settings.translate ? '🇧🇷 ' + esc(it.pt) + '<br>' : '') + esc(it.desc) + '<br><small>Category: ' + it.cat.toUpperCase() + '</small><div class="row" style="margin-top:6px">' +
        (it.slot ? '<button id="iEquip">' + (eq ? '👕 Take off' : '👕 Put on') + '</button>' : '') +
        (it.human ? '<button id="iEat">😋 Eat</button>' : '') +
        (it.cat === 'food' && it.pet ? '<button id="iFeed">🐾 Feed pet</button>' : '') +
        (it.cat === 'toy' ? '<button id="iPlay">🎾 Play with pet</button>' : '') +
        (it.cat === 'petacc' ? '<button id="iPetAcc">🐾 Put on pet</button>' : '') + '</div></div>';
    }
    const p = ui.open('<h2>🎒 Inventory</h2><div class="tabs">' + tabs.map(([k, n]) => '<button data-tab="' + k + '" class="' + (k === tab ? 'on' : '') + '">' + n + '</button>').join('') + '</div>' + detail +
      '<div class="grid">' + (ids.map(id => { const i = EA.ITEMS[id]; const eq = i.slot && EA.state.outfit[i.slot] === id; return '<div class="card ' + (sel === id ? 'sel' : '') + '" data-i="' + id + '"><span class="ic">' + i.icon + '</span><b>' + esc(i.name) + '</b>' + (i.color ? '<span class="sw" style="background:' + EA.COLOR[i.color] + '"></span>' : '') + '<small>' + (eq ? '✔ wearing' : (EA.count(id) > 1 ? 'x' + EA.count(id) : '')) + '</small></div>'; }).join('') || '<p>Nothing here yet.</p>') + '</div><p class="row"><button data-close>✖ Close</button></p>');
    p.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
    p.querySelectorAll('[data-i]').forEach(c => c.onclick = () => { sel = c.dataset.i; EA.say(EA.ITEMS[sel].name); if (EA.ITEMS[sel].word) EA.learn(EA.ITEMS[sel].word); draw(); });
    const b = id => p.querySelector(id);
    if (b('#iEquip')) b('#iEquip').onclick = () => { const eq = EA.state.outfit[it.slot] === it.id; if (eq) EA.unequip(it.slot); else EA.equip(it.id); draw(); };
    if (b('#iEat')) b('#iEat').onclick = () => { if (EA.takeItem(it.id)) { EA.toast('Yum! You eat the ' + it.name.toLowerCase() + '. 😋', 'good'); EA.learn('eat'); if (it.word) EA.learn(it.word); if (!EA.count(it.id)) sel = null; EA.addXP(1, true); draw(); } };
    if (b('#iFeed')) b('#iFeed').onclick = () => { if (ui.feedPet(it.id)) { if (!EA.count(it.id)) sel = null; draw(); } };
    if (b('#iPlay')) b('#iPlay').onclick = () => { ui.playPet(it.id); };
    if (b('#iPetAcc')) b('#iPetAcc').onclick = () => { if (!EA.state.pet) { EA.toast('You need a pet first!', 'bad'); return; } EA.state.pet.acc = it.id; EA.toast(EA.state.pet.name + ' looks great! ✨', 'good'); };
  };
  draw();
};

/* ---------- map ---------- */
ui.map = function(){
  const s = EA.state, town = EA.MAPS.town, W = EA.world;
  const p = ui.open('<h2>🗺️ Map of English Town</h2><canvas id="mapCv" width="640" height="460" style="width:100%;max-width:640px;border:3px solid #2b2340;border-radius:10px;background:#7ccd5b"></canvas><div id="mapWhere" class="msg"></div><div class="row" id="mapList"></div><p class="row"><button data-close>✖ Close</button></p>');
  const cv = $('mapCv'), c = cv.getContext('2d'), k = 10;
  const colors = {0: '#7ccd5b', 8: '#6bbd4c', 1: '#5b5f6e', 2: '#d9d2c3', 3: '#4fa8e8', 4: '#e2c590'};
  for (let y = 0; y < town.h; y++) for (let x = 0; x < town.w; x++) { c.fillStyle = colors[town.ground[y][x]] || '#7ccd5b'; c.fillRect(x * k, y * k, k, k); }
  town.objs.filter(o => o.k === 'tree' || o.k === 'pine').forEach(o => { c.fillStyle = '#3a9a44'; c.beginPath(); c.arc((o.box.x + 9) / 32 * k, (o.box.y) / 32 * k, 3, 0, 7); c.fill(); });
  const t = performance.now();
  town.objs.filter(o => o.k === 'building').forEach(o => {
    const b = o.box; c.fillStyle = o.style.wall; c.fillRect(b.x / 32 * k, b.y / 32 * k, b.w / 32 * k, b.h / 32 * k);
    c.fillStyle = o.style.roof; c.fillRect(b.x / 32 * k, b.y / 32 * k, b.w / 32 * k, b.h / 32 * k * 0.35);
    c.strokeStyle = '#2b2340'; c.lineWidth = 2; c.strokeRect(b.x / 32 * k, b.y / 32 * k, b.w / 32 * k, b.h / 32 * k);
    if (o.place) {
      const pl = EA.PLACES[o.place], seen = s.discovered[o.place];
      c.textAlign = 'center'; c.fillStyle = '#2b2340'; c.font = 'bold 13px sans-serif';
      const cx = (b.x + b.w / 2) / 32 * k, cy = (b.y + b.h / 2) / 32 * k;
      c.font = '20px sans-serif'; c.fillText(seen ? pl.icon : '❓', cx, cy + 2);
      c.font = 'bold 11px sans-serif'; c.fillStyle = '#fff'; c.strokeStyle = '#2b2340'; c.lineWidth = 3;
      const lab = seen ? pl.name : 'Unknown place'; c.strokeText(lab, cx, cy + 18); c.fillText(lab, cx, cy + 18);
      if (s.level < pl.reqLevel) { c.font = '14px sans-serif'; c.fillText('🔒', cx + 22, cy - 6); }
    }
  });
  // park label
  c.font = '20px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#000'; const pk = s.discovered.park; c.fillText(pk ? '🌳' : '❓', 31 * k, 36.6 * k + 2);
  c.font = 'bold 12px sans-serif'; c.fillStyle = '#fff'; c.strokeStyle = '#2b2340'; c.lineWidth = 3; c.strokeText(pk ? 'Park' : 'Unknown place', 31 * k, 44 * k); c.fillText(pk ? 'Park' : 'Unknown place', 31 * k, 44 * k);
  // player marker
  let mx, my, where;
  if (W.map.id === 'town') { mx = W.player.x / 32 * k; my = W.player.y / 32 * k; where = 'You are in English Town.'; }
  else { const b = town.objs.find(o => o.place === W.map.id); mx = (b.doorX) / 32 * k; my = (b.box.y + b.box.h) / 32 * k + 8; where = 'You are inside: ' + W.map.name; }
  c.fillStyle = '#ff3b5c'; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(mx, my, 6, 0, 7); c.fill(); c.stroke();
  c.font = 'bold 11px sans-serif'; c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 3; c.strokeText('YOU', mx, my - 10); c.fillText('YOU', mx, my - 10);
  $('mapWhere').textContent = '📍 ' + where;
  $('mapList').innerHTML = Object.entries(EA.PLACES).map(([id, pl]) => '<span class="msg" style="margin:2px">' + (s.discovered[id] ? '✅ ' + pl.icon + ' ' + pl.name + EA.tr(' (' + pl.pt + ')') : '❓ Not visited yet') + (s.level < pl.reqLevel ? ' 🔒 Lv ' + pl.reqLevel : '') + '</span>').join('');
};

/* ---------- settings / how to / about / ending ---------- */
ui.settings = function(fromTitle){
  const draw = () => {
    const S = EA.settings;
    EA.loadVoices();
    const V = EA.voice.list, best = V[0];
    const star = v => EA.voiceScore(v) >= 40 ? ' ★' : '';
    const vopts = '<option value="">Automatic — best voice' + (best ? ' (' + esc(best.name) + ')' : '') + '</option>' +
      V.map(v => '<option value="' + esc(v.voiceURI) + '"' + (S.voiceURI === v.voiceURI ? ' selected' : '') + '>' + esc(v.name) + ' · ' + esc(v.lang) + star(v) + '</option>').join('');
    const sl = (id, label, val) => '<div class="row vol"><span class="vol-l">' + label + '</span><input type="range" id="' + id + '" min="0" max="1" step="0.05" value="' + val + '"><b id="' + id + 'V">' + Math.round(val * 100) + '%</b></div>';
    const vv = (k, d) => S[k] == null ? d : S[k];
    const p = ui.open('<h2>⚙️ Settings</h2>' +
      '<div class="msg voicebox"><b>🔊 Volume</b>' +
      sl('vMaster', '🔊 Master', vv('volMaster', 0.8)) + sl('vMusic', '🎵 Music', vv('volMusic', 0.5)) + sl('vVoice', '🗣️ Voices', vv('volVoice', 1)) + sl('vFx', '🔔 Effects', vv('volFx', 0.7)) +
      '<label class="opt"><input type="checkbox" id="sMusic" ' + (S.music !== false ? 'checked' : '') + '> 🎵 Background music</label></div>' +
      '<label class="opt"><input type="checkbox" id="sAudio" ' + (S.audio ? 'checked' : '') + '> 🔊 Audio and pronunciation (voice)</label>' +
      '<div class="msg voicebox"><b>🗣️ Reading voice</b>' +
      '<label class="opt"><input type="radio" name="vmode" id="sHQ" ' + (S.voiceMode !== 'browser' ? 'checked' : '') + '> 🎙️ Studio voices — natural, a different voice for each character (recommended)</label>' +
      '<label class="opt"><input type="radio" name="vmode" id="sBR" ' + (S.voiceMode === 'browser' ? 'checked' : '') + '> 🌐 Browser voice</label>' +
      '<div class="row"><button id="sTestHQ">▶ Test</button><span>🐢</span><input type="range" id="sRate" min="0.6" max="1.3" step="0.05" value="' + (S.rate || 0.9) + '"><span>🐇</span><b id="sRateV">' + Math.round((S.rate || 0.9) / 0.9 * 100) + '%</b></div>' +
      '<label class="opt"><input type="checkbox" id="sAuto" ' + (S.autoRead ? 'checked' : '') + '> Read dialogues aloud automatically</label>' +
      '<details' + (S.voiceMode === 'browser' ? ' open' : '') + '><summary><small>Browser voice options (also used for your name and any line without a studio recording)</small></summary>' +
      (window.speechSynthesis ? (V.length ? '<div class="row" style="margin-top:6px"><select id="sVoice" style="flex:1;min-width:200px">' + vopts + '</select><button id="sTest">▶ Test</button></div>' +
        '<label class="opt"><input type="checkbox" id="sChar" ' + (S.charVoices ? 'checked' : '') + '> Different voice for each character</label>' +
        '<small>★ = natural, high-quality voice. Best voices: <b>Microsoft Edge</b> ("Natural" voices) or <b>Google Chrome</b> ("Google" voices). On Windows you can add more voices in Settings › Time &amp; Language › Speech.</small>'
        : '<p><small>Loading voices… If nothing appears, your browser or system has no English voice installed. Try Microsoft Edge or Google Chrome.</small></p>')
        : '<p><small>Your browser does not support speech. Try Microsoft Edge or Google Chrome.</small></p>') + '</details></div>' +
      '<label class="opt"><input type="checkbox" id="sDay" ' + (S.dayNight ? 'checked' : '') + '> 🌇 Day and night cycle</label>' +
      '<label class="opt"><input type="checkbox" id="sTr" ' + (S.translate ? 'checked' : '') + '> 🇧🇷 Show Portuguese translations</label>' +
      '<label class="opt"><input type="checkbox" id="sCon" ' + (S.contrast ? 'checked' : '') + '> 🌓 High contrast</label>' +
      '<div class="opt">🔠 Text size: ' + ['Normal', 'Large', 'Extra large'].map((n, i) => '<button data-ts="' + i + '" class="' + (S.textSize === i ? 'on' : '') + '" style="' + (S.textSize === i ? 'background:#ff7a59;color:#fff' : '') + '">' + n + '</button>').join('') + '</div>' +
      '<p class="row">' + (!fromTitle ? '<button id="sSave">💾 Save game</button><button id="sReset">🗑️ Restart game</button><button id="sTitle">🏠 Title screen</button>' : '<button id="sReset">🗑️ Delete saved game</button>') + '<button data-close>✖ Close</button></p><div id="sMsg"></div>');
    const apply = () => { EA.saveSettings(); EA.applySettings(); };
    $('sAudio').onchange = e => { S.audio = e.target.checked; apply(); if (S.audio) EA.say('Audio on'); };
    $('sTr').onchange = e => { S.translate = e.target.checked; apply(); };
    $('sCon').onchange = e => { S.contrast = e.target.checked; apply(); };
    const syncMusicBtn = () => { const b = $('btnMusic'); if (b) b.textContent = S.music === false ? '🔇' : '🎵'; };
    [['vMaster', 'volMaster'], ['vMusic', 'volMusic'], ['vVoice', 'volVoice'], ['vFx', 'volFx']].forEach(([id, key]) => {
      $(id).oninput = e => { S[key] = +e.target.value; $(id + 'V').textContent = Math.round(S[key] * 100) + '%'; if (EA.music) { EA.music.unlock(); EA.music.update(); } };
      $(id).onchange = () => { apply(); if (key === 'volVoice') EA.say('Hello! Welcome to English Town. How are you today?'); if (key === 'volFx') EA.beep('good'); };
    });
    $('sMusic').onchange = e => { S.music = e.target.checked; apply(); syncMusicBtn(); if (EA.music) { EA.music.unlock(); EA.music.update(); } };
    $('sDay').onchange = e => { S.dayNight = e.target.checked; apply(); };
    const testLine = 'Hello! Welcome to English Town. How are you today?';
    $('sHQ').onchange = () => { S.voiceMode = 'hq'; apply(); EA.say(testLine); };
    $('sBR').onchange = () => { S.voiceMode = 'browser'; apply(); EA.say(testLine); };
    $('sTestHQ').onclick = () => EA.say(testLine);
    $('sRate').oninput = e => { S.rate = +e.target.value; $('sRateV').textContent = Math.round(S.rate / 0.9 * 100) + '%'; };
    $('sRate').onchange = () => { apply(); EA.say('This is my reading speed.'); };
    $('sAuto').onchange = e => { S.autoRead = e.target.checked; apply(); };
    if ($('sVoice')) {
      $('sVoice').onchange = e => { S.voiceURI = e.target.value; apply(); EA.loadVoices(); const vm = S.voiceMode; S.voiceMode = 'browser'; EA.say('Hello! I am your English teacher. Let\'s learn together!'); S.voiceMode = vm; };
      $('sTest').onclick = () => { const vm = S.voiceMode; S.voiceMode = 'browser'; EA.say(testLine); S.voiceMode = vm; };
      $('sChar').onchange = e => { S.charVoices = e.target.checked; apply(); };
    }
    p.querySelectorAll('[data-ts]').forEach(b => b.onclick = () => { S.textSize = +b.dataset.ts; apply(); draw(); });
    if ($('sSave')) $('sSave').onclick = () => EA.save();
    if ($('sTitle')) $('sTitle').onclick = () => { EA.save(true); ui.close(); EA.main.toTitle(); };
    $('sReset').onclick = () => {
      $('sMsg').innerHTML = '<div class="msg bad"><b>Are you sure?</b> All progress will be lost.<div class="row"><button id="sYes" style="background:#e74c3c;color:#fff">Yes, restart</button><button id="sNo">No, keep playing</button></div></div>';
      $('sNo').onclick = () => { $('sMsg').innerHTML = ''; };
      $('sYes').onclick = () => { EA.resetGame(); ui.close(); EA.main.toTitle(); EA.toast('Game reset. Press PLAY to start again!', 'good'); };
    };
  };
  draw();
};
ui.howTo = function(){
  ui.open('<h2>❓ How to play</h2><div class="msg"><b>Move:</b> W A S D or the arrow keys (hold Shift to run). On phones use the on-screen pad.<br><b>Interact:</b> press <b>E</b> near people, doors and objects.<br><b>Menus:</b> I = inventory • M = map • Q = quests • Esc = settings.</div>' +
    '<div class="msg"><b>Goal:</b> Explore English Town, learn English words, talk to people, dress up, adopt and care for a pet, finish quests and minigames. Earn XP, coins and rewards!<br>Answer in English in conversations. Press 🔊 Listen to hear the pronunciation.</div>' +
    '<div class="msg">💡 Start at home: use the <b>mirror</b>, the <b>wardrobe</b>, your <b>word book</b> and talk to Grandma Rose. Then open the door and explore!</div><p class="row"><button data-close>✖ Close</button></p>');
};
ui.about = function(){
  ui.open('<h2>ℹ️ About English Adventure</h2><div class="msg">English Adventure is an educational game that teaches English to beginners (Portuguese speakers). You learn more than 90 words and phrases in 8 categories: Body Parts, Clothes, Animals, Food, Colors, City, Actions and Conversation.</div>' +
    '<div class="msg">You learn by exploring, talking, completing quests and playing 6 minigames: Body Challenge, Dress Up, Pet Care, Word Hunt, English Quiz and Conversation Challenge. Your progress is saved in your browser.</div><div class="msg">Made with HTML5, CSS3 and JavaScript. No external libraries. Have fun! 🎉</div><p class="row"><button data-close>✖ Close</button></p>');
};
ui.showEnding = function(){
  const s = EA.state;
  ui.open('<h2>🏆 Congratulations, ' + esc(s.name) + '!</h2><div class="msg">You finished all the main quests and became an <b>English Master</b>! You met everyone in English Town, learned <b>' + EA.learnedCount() + '</b> words and completed amazing challenges.</div><div class="msg">You can keep exploring, playing minigames and earning new rewards. See you soon! 👋</div><p class="row"><button data-close>▶ Keep playing</button></p>');
  EA.say('Congratulations! You are an English Master!');
};
})();
