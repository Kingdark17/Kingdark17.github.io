/* ===== MINIGAMES 2: PET CARE, WORD HUNT / SHOPPING LIST, ENGLISH QUIZ, CONVERSATION CHALLENGE ===== */
(function(){
const $ = EA.$, esc = EA.esc, ui = EA.ui, MG = EA.minigames;

/* ======================= PET CARE (timed requests) ======================= */
const REQ = [
  {say: "I'm hungry!", pt: 'Estou com fome!', ans: 'eat', e: '🍖'},
  {say: "I'm thirsty!", pt: 'Estou com sede!', ans: 'drink', e: '💧'},
  {say: 'I want to play!', pt: 'Eu quero brincar!', ans: 'play', e: '🎾'},
  {say: "I'm sleepy.", pt: 'Estou com sono.', ans: 'sleep', e: '😴'},
  {say: "I'm dirty!", pt: 'Estou sujo!', ans: 'wash', e: '🛁'},
  {say: 'I need love!', pt: 'Eu preciso de carinho!', ans: 'pet', e: '❤'}
];
const ACTS = [['eat', '🍖', 'Eat'], ['drink', '💧', 'Drink'], ['play', '🎾', 'Play'], ['sleep', '🛏️', 'Sleep'], ['wash', '🛁', 'Wash'], ['pet', '✋', 'Pet']];
MG.reg('petcare', {run: lvl => {
  const type = EA.state.pet ? EA.state.pet.type : EA.pick(['dog', 'cat']);
  const pname = EA.state.pet ? EA.state.pet.name : (type === 'dog' ? 'Buddy' : 'Misty');
  const total = 10, limit = [9, 6.5, 4.5][lvl - 1] * 1000;
  let i = 0, score = 0, t0 = 0, raf = 0, req = null, locked = false, order = ACTS.slice();
  const p = ui.open('<h2>🐾 PET CARE — Level ' + lvl + '</h2><div class="row between"><span class="msg" id="pcInfo"></span><span class="msg">⭐ <b id="pcScore">0</b></span></div><canvas class="pv" id="pcv" width="300" height="200" style="width:100%;max-width:420px"></canvas><div class="bar" style="height:18px;margin:6px 0"><div id="pcBar" style="width:100%;background:#2ecc71"></div></div><div id="pcFb" class="msg">Get ready...</div><div class="grid" id="pcBtns" style="grid-template-columns:repeat(3,1fr)"></div><p class="row"><button id="pcQuit">✖ Quit</button></p>', () => cancelAnimationFrame(raf));
  const cv = $('pcv'), c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  const btns = () => {
    if (lvl === 3) order = EA.shuffle(ACTS);
    $('pcBtns').innerHTML = order.map(([k, ic, n]) => '<button data-a="' + k + '" style="font-size:1.1em">' + ic + '<br>' + n + '</button>').join('');
    $('pcBtns').querySelectorAll('[data-a]').forEach(b => b.onclick = () => answer(b.dataset.a));
  };
  let react = null;
  const draw = () => {
    if (!document.body.contains(cv)) return;
    const t = performance.now();
    c.clearRect(0, 0, 300, 200);
    const bounce = react && t - react.t < 700 ? -Math.abs(Math.sin((t - react.t) / 90)) * 12 : 0;
    EA.drawPet(c, 150, 170 + bounce, type, 'right', 0, EA.state.pet ? EA.state.pet.acc : null, react && react.ok ? 'happy' : '', 6);
    if (req && !locked) {
      c.fillStyle = '#fff'; c.strokeStyle = '#2b2340'; c.lineWidth = 3; c.beginPath(); c.roundRect(20, 8, 260, 48, 14); c.fill(); c.stroke();
      c.fillStyle = '#2b2340'; c.font = 'bold 20px sans-serif'; c.textAlign = 'center'; c.fillText(req.say, 150, 40);
    }
    if (react && t - react.t < 700) { c.font = '34px sans-serif'; c.globalAlpha = 1 - (t - react.t) / 700; c.fillText(react.ok ? react.e : '❓', 215, 100 - (t - react.t) / 12); c.globalAlpha = 1; }
    if (req && !locked) {
      const left = Math.max(0, 1 - (t - t0) / limit); $('pcBar').style.width = left * 100 + '%'; $('pcBar').style.background = left > .5 ? '#2ecc71' : left > .25 ? '#f39c12' : '#e74c3c';
      if (left <= 0) { timeUp(); }
    }
    raf = requestAnimationFrame(draw);
  };
  const next = () => {
    if (i >= total) { cancelAnimationFrame(raf); const s = EA.state.pet; if (s) { s.fun = Math.min(100, s.fun + 15); s.love = Math.min(100, s.love + 10); } MG.result('petcare', lvl, score, total, 'You practiced: eat, drink, play and sleep!'); return; }
    req = EA.pick(REQ); locked = false; t0 = performance.now(); i++;
    $('pcInfo').textContent = pname + ' asks for something (' + i + '/' + total + ')';
    $('pcFb').className = 'msg'; $('pcFb').innerHTML = 'Read what ' + esc(pname) + ' says. ' + (EA.settings.translate ? '<small>(' + req.pt + ')</small>' : '');
    EA.say(req.say); btns();
  };
  const finishRound = (ok, msg) => {
    locked = true; react = {t: performance.now(), ok, e: req.e};
    $('pcFb').className = 'msg ' + (ok ? 'good' : 'bad'); $('pcFb').innerHTML = msg;
    setTimeout(next, 900);
  };
  const answer = a => {
    if (locked || !req) return;
    if (a === req.ans) {
      const left = Math.max(0, 1 - (performance.now() - t0) / limit), pts = 0.5 + 0.5 * left; score += pts; $('pcScore').textContent = Math.round(score * 10) / 10;
      EA.beep('good'); EA.learn(a, true); EA.say(a);
      finishRound(true, '<b>Great job!</b> ' + esc(pname) + ' is happy! ' + req.e);
    } else { EA.beep('bad'); finishRound(false, '<b>Oops!</b> ' + esc(pname) + ' said: "' + esc(req.say) + '"'); }
  };
  const timeUp = () => { if (locked) return; EA.beep('bad'); finishRound(false, '<b>Too slow!</b> Try to be faster.'); };
  $('pcQuit').onclick = () => { cancelAnimationFrame(raf); ui.close(); };
  setTimeout(() => { if ($('pcv')) { next(); draw(); } }, 900);
}});

/* ======================= WORD HUNT / SHOPPING LIST (world) ======================= */
const HUNT_ITEMS = [
  ['apple', '🍎'], ['banana', '🍌'], ['bread', '🍞'], ['milk', '🥛'], ['carrot', '🥕'], ['tomato', '🍅'], ['cheese', '🧀'], ['egg', '🥚'],
  ['hat', '🎩'], ['shoes', '👞'], ['dog', '🐶'], ['cat', '🐱'], ['ball', '🎾'], ['fish', '🐟'], ['bone', '🦴'], ['flower', '🌸'], ['juice', '🧃'], ['soap', '🧼']
];
const SHOP_ITEMS = [['apple', '🍎'], ['banana', '🍌'], ['bread', '🍞'], ['milk', '🥛'], ['carrot', '🥕'], ['tomato', '🍅'], ['cheese', '🧀'], ['egg', '🥚'], ['juice', '🧃'], ['soap', '🧼'], ['toothpaste', '🪥'], ['bone', '🦴'], ['fish', '🐟'], ['water', '💧']];
let hunt = null, bar = null;
function huntBar(){
  if (!bar) {
    bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;top:92px;left:50%;transform:translateX(-50%);z-index:12;background:#2b2340;color:#fff;border:3px solid #f7c948;border-radius:14px;padding:8px 16px;text-align:center;font-weight:800;max-width:94vw';
    document.body.appendChild(bar);
  }
  return bar;
}
function huntRender(){
  const b = huntBar(), h = hunt; if (!h) { b.style.display = 'none'; return; }
  b.style.display = 'block';
  const cur = EA.WORD[h.targets[h.idx]];
  b.innerHTML = '<div style="font-size:1.25em">🔍 Find the ' + esc(cur.en.toLowerCase()) + '!</div><div style="font-size:.8em;font-weight:600">' + (EA.settings.translate ? esc(cur.pt) + ' • ' : '') + (h.idx) + '/' + h.targets.length + ' found • mistakes: ' + h.mistakes + '</div>' +
    '<div style="margin-top:4px"><button id="hLis" style="font-size:.8em;padding:.1em .6em">🔊</button> <button id="hHint" style="font-size:.8em;padding:.1em .6em">💡 Hint</button> <button id="hQuit" style="font-size:.8em;padding:.1em .6em">✖ Stop</button></div>';
  $('hLis').onclick = () => EA.say('Find the ' + cur.en.toLowerCase());
  $('hHint').onclick = () => { const it = h.items.find(x => x.wordId === h.targets[h.idx] && !x.taken); if (!it) return; let where; const y = it.box.y, x = it.box.x;
    if (h.kind === 'shop') where = (x < 320 ? 'on the left' : x > 400 ? 'on the right' : 'in the middle') + ' of the supermarket'; else where = y > 34 * 32 ? 'in the Park' : y < 11 * 32 ? 'in the north meadow' : y < 23 * 32 ? 'near the main street (north side)' : 'near the main street (south side)';
    EA.toast('💡 Hint: it is ' + where + '.', ''); };
  $('hQuit').onclick = () => huntStop(false);
}
function huntStop(){ hunt = null; EA.world.setHuntItems(null); huntRender(); }
function spots(kind){
  const W = EA.world, m = EA.MAPS[kind === 'shop' ? 'supermarket' : 'town'];
  const out = [];
  EA.shuffle(m.hunt).forEach(([tx, ty]) => { const x = tx * 32 + 16, y = ty * 32 + 26; const r = {x: x - 8, y: y - 10, w: 16, h: 10}; if (!m.solids.some(s => r.x < s.x + s.w && r.x + r.w > s.x && r.y < s.y + s.h && r.y + r.h > s.y)) out.push([x, y]); });
  return out;
}
function startHunt(kind, lvl){
  const n = kind === 'shop' ? [4, 6, 8][lvl - 1] : [5, 7, 9][lvl - 1];
  const pool = kind === 'shop' ? SHOP_ITEMS : HUNT_ITEMS;
  const mapId = kind === 'shop' ? 'supermarket' : 'town';
  if (EA.world.mapId !== mapId) { EA.toast('Go to the ' + (kind === 'shop' ? 'Supermarket' : 'town') + ' to play!', 'bad'); ui.close(); return; }
  const targets = EA.shuffle(pool).slice(0, n);
  const decoys = EA.shuffle(pool.filter(x => !targets.includes(x))).slice(0, Math.min(4, pool.length - n));
  const all = EA.shuffle(targets.concat(decoys));
  const sp = spots(kind);
  const items = [];
  all.forEach((it, k) => { const pos = sp[k]; if (!pos) return; items.push({k: 'hunt', wordId: it[0], emoji: it[1], box: {x: pos[0] - 12, y: pos[1] - 22, w: 24, h: 22}}); });
  const present = targets.filter(t => items.some(x => x.wordId === t[0]));
  hunt = {kind, lvl, targets: present.map(t => t[0]), idx: 0, mistakes: 0, items};
  EA.world.setHuntItems(mapId, items);
  ui.close(); huntRender();
  EA.say('Find the ' + EA.WORD[hunt.targets[0]].en.toLowerCase());
}
MG.huntPick = function(item){
  const h = hunt; if (!h) { EA.toast('This is a ' + EA.WORD[item.wordId].en.toLowerCase() + '. 😊', ''); EA.say(EA.WORD[item.wordId].en); return; }
  const want = h.targets[h.idx], w = EA.WORD[item.wordId];
  if (item.wordId === want) {
    item.taken = true; EA.beep('good'); EA.learn(want, true); EA.say(w.en);
    EA.toast('Excellent! You found the ' + w.en.toLowerCase() + '! ' + item.emoji, 'good');
    h.idx++;
    if (h.idx >= h.targets.length) {
      const gid = h.kind === 'shop' ? 'shop' : 'hunt', lvl = h.lvl, n = h.targets.length, mis = h.mistakes; huntStop();
      setTimeout(() => MG.result(gid, lvl, Math.max(0, n - mis * 0.5), n, 'You found ' + n + ' objects!'), 400);
    } else { huntRender(); EA.say('Find the ' + EA.WORD[h.targets[h.idx]].en.toLowerCase()); }
  } else {
    h.mistakes++; EA.beep('bad'); EA.say(w.en);
    EA.toast('That is the ' + w.en.toLowerCase() + '. Find the ' + EA.WORD[want].en.toLowerCase() + '!', 'bad'); huntRender();
  }
};
MG.huntActive = () => !!hunt;
MG.reg('hunt', {run: lvl => startHunt('town', lvl)});
MG.reg('shop', {run: lvl => startHunt('shop', lvl)});

/* ======================= ENGLISH QUIZ ======================= */
MG.reg('quiz', {run: lvl => {
  const easyCats = ['BODY PARTS', 'COLORS', 'ANIMALS', 'FOOD'];
  const pool = EA.VOCAB.filter(w => lvl === 1 ? easyCats.includes(w.cat) && !w.en.includes(' ') : lvl === 2 ? !w.en.includes('?') && !w.en.includes('...') : true);
  const single = EA.VOCAB.filter(w => !w.en.includes(' ') && !w.en.includes('?'));
  const types = lvl === 1 ? ['en2pt', 'pt2en', 'listen', 'category'] : lvl === 2 ? ['en2pt', 'pt2en', 'listen', 'category', 'type'] : ['en2pt', 'pt2en', 'listen', 'type', 'type', 'category'];
  const qs = [];
  const used = new Set();
  while (qs.length < 10) {
    const w = EA.pick(pool); if (used.has(w.id) && used.size < pool.length) continue; used.add(w.id);
    let t = EA.pick(types);
    if (t === 'listen' && !EA.settings.audio) t = 'pt2en';
    const same = EA.VOCAB.filter(x => x.id !== w.id && x.cat === w.cat);
    const others = EA.shuffle(same.length >= 3 ? same : EA.VOCAB.filter(x => x.id !== w.id)).slice(0, 3);
    qs.push({w, t, others});
  }
  let i = 0, score = 0, locked = false;
  const draw = () => {
    const q = qs[i], w = q.w;
    let body = '', opts = null;
    if (q.t === 'en2pt') { body = '<b>What does "' + esc(w.en) + '" mean in Portuguese?</b> <button class="listen" data-say="' + esc(w.en) + '">🔊 Listen</button>'; opts = EA.shuffle([w].concat(q.others)).map(o => [o.pt, o.id === w.id]); }
    else if (q.t === 'pt2en') { body = '<b>How do you say "' + esc(w.pt) + '" in English?</b>'; opts = EA.shuffle([w].concat(q.others)).map(o => [o.en, o.id === w.id]); }
    else if (q.t === 'listen') { body = '<b>Listen and choose the word.</b> <button class="listen" data-say="' + esc(w.en) + '">🔊 Listen</button>'; opts = EA.shuffle([w].concat(q.others)).map(o => [o.en, o.id === w.id]); }
    else if (q.t === 'category') { const cats = EA.shuffle(EA.CATS.filter(c => c !== w.cat)).slice(0, 3).concat(w.cat); body = '<b>"' + esc(w.en) + '" is in which group?</b> <button class="listen" data-say="' + esc(w.en) + '">🔊 Listen</button>'; opts = EA.shuffle(cats).map(c => [c, c === w.cat]); }
    else { body = '<b>Write in English:</b> <span class="big-word">' + esc(w.pt) + '</span>'; }
    const p = ui.open('<h2>❓ ENGLISH QUIZ — Level ' + lvl + '</h2><div class="row between"><span class="msg">Question ' + (i + 1) + ' of 10</span><span class="msg">⭐ <b>' + score + '</b></span></div><div class="msg" style="font-size:1.15em">' + body + '</div>' +
      (opts ? '<div class="row" id="qOpts">' + opts.map((o, k) => '<button data-k="' + k + '" style="min-width:140px;flex:1">' + esc(o[0]) + '</button>').join('') + '</div>' : '<div class="row"><input type="text" id="qIn" autocomplete="off" placeholder="Type here..." style="flex:1"><button id="qOk">✔ Check</button></div>') +
      '<div id="qFb" class="msg">Choose your answer.</div><p class="row"><button data-close>✖ Quit</button></p>');
    if (q.t === 'listen') setTimeout(() => EA.say(w.en), 300);
    const done = (ok, correctText) => {
      if (locked) return; locked = true;
      if (ok) { score++; EA.beep('good'); EA.learn(w.id, true); } else EA.beep('bad');
      EA.say(w.en);
      const fb = $('qFb'); fb.className = 'msg ' + (ok ? 'good' : 'bad');
      fb.innerHTML = (ok ? '<b>Great job! ⭐</b>' : '<b>Not quite.</b> The answer is: <b>' + esc(correctText) + '</b>') + '<br>' + esc(w.en) + (EA.settings.translate ? ' = ' + esc(w.pt) : '');
      p.querySelectorAll('button[data-k],#qOk').forEach(b => b.disabled = true);
      const nb = document.createElement('button'); nb.textContent = i + 1 >= 10 ? 'Finish ▶' : 'Next ▶'; fb.appendChild(document.createElement('br')); fb.appendChild(nb); nb.focus();
      nb.onclick = () => { locked = false; i++; if (i >= 10) MG.result('quiz', lvl, score, 10, 'You practiced ' + new Set(qs.map(x => x.w.id)).size + ' different words!'); else draw(); };
    };
    if (opts) p.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { const o = opts[+b.dataset.k]; b.style.background = o[1] ? '#b8f5c8' : '#ffc4c4'; done(o[1], opts.find(x => x[1])[0]); });
    else {
      const inp = $('qIn'); inp.focus();
      const check = () => { const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim(); done(norm(inp.value) === norm(w.en), w.en); };
      $('qOk').onclick = check; inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') check(); };
    }
  };
  draw();
}});

/* ======================= CONVERSATION CHALLENGE ======================= */
const SENT = [
  [['Hello!', 'Olá!'], ['I am fine.', 'Eu estou bem.'], ['Thank you!', 'Obrigado!'], ['I like cats.', 'Eu gosto de gatos.'], ['I have a dog.', 'Eu tenho um cachorro.'], ['Good morning!', 'Bom dia!']],
  [['My name is Sam.', 'Meu nome é Sam.'], ['How are you today?', 'Como você está hoje?'], ['Nice to meet you!', 'Prazer em conhecer você!'], ['I want a red hat.', 'Eu quero um chapéu vermelho.'], ['The cat is hungry.', 'O gato está com fome.'], ['Where is the park?', 'Onde fica o parque?']],
  [['I would like a sandwich, please.', 'Eu gostaria de um sanduíche, por favor.'], ['Where is the school, please?', 'Onde fica a escola, por favor?'], ['Can I have some water, please?', 'Posso tomar um pouco de água, por favor?'], ['I want to buy a blue shirt.', 'Eu quero comprar uma camisa azul.'], ['My dog likes to play in the park.', 'Meu cachorro gosta de brincar no parque.'], ['Thank you very much for your help.', 'Muito obrigado pela sua ajuda.']]
];
const GAPS = [
  [{l: [['Waiter', 'Good afternoon! What would you like?'], ['You', '___, please.']], o: ['A sandwich', 'A table', 'Goodbye'], a: 'A sandwich', pt: 'Garçom: Boa tarde! O que você gostaria? / Você: ___, por favor.'},
   {l: [['Lily', 'Hi! What is your name?'], ['You', 'My name ___ Alex.']], o: ['is', 'are', 'am'], a: 'is', pt: 'Lily: Oi! Qual é o seu nome? / Você: Meu nome ___ Alex.'},
   {l: [['Lily', 'How are you?'], ['You', "I'm ___, thank you!"]], o: ['fine', 'shoes', 'blue'], a: 'fine', pt: 'Lily: Como você está? / Você: Estou ___, obrigado!'}],
  [{l: [['Clara', 'Can I help you?'], ['You', 'Yes, I want a ___ hat.']], o: ['red', 'run', 'dog'], a: 'red', pt: 'Clara: Posso ajudar? / Você: Sim, eu quero um chapéu ___.'},
   {l: [['Dr. Paws', 'What does your dog need?'], ['You', 'My dog needs food and ___.']], o: ['water', 'school', 'hello'], a: 'water', pt: 'Dr. Paws: O que seu cachorro precisa? / Você: Meu cachorro precisa de comida e ___.'},
   {l: [['Mr. Walker', 'Excuse me! Where is the park?'], ['You', 'The park is ___ the fountain.']], o: ['near', 'eat', 'purple'], a: 'near', pt: 'Sr. Walker: Com licença! Onde fica o parque? / Você: O parque fica ___ da fonte.'}],
  [{l: [['Waiter', 'That is five coins.'], ['You', 'Here you ___. Thank you!']], o: ['are', 'is', 'am'], a: 'are', pt: 'Garçom: São cinco moedas. / Você: Aqui ___. Obrigado!'},
   {l: [['Ms. Green', 'What color is your shirt?'], ['You', 'My shirt ___ blue.']], o: ['is', 'are', 'have'], a: 'is', pt: 'Profa. Green: Qual é a cor da sua camisa? / Você: Minha camisa ___ azul.'},
   {l: [['Ben', 'Do you like animals?'], ['You', 'Yes, I ___ dogs and cats.']], o: ['love', 'wear', 'open'], a: 'love', pt: 'Ben: Você gosta de animais? / Você: Sim, eu ___ cachorros e gatos.'}]
];
MG.reg('conv', {run: lvl => {
  const rounds = [];
  const sents = EA.shuffle(SENT[lvl - 1]), gaps = EA.shuffle(GAPS[lvl - 1]);
  for (let k = 0; k < 3; k++) { rounds.push({t: 'order', s: sents[k]}); rounds.push({t: 'gap', g: gaps[k]}); }
  let i = 0, score = 0, tries = 0;
  const next = () => { i++; tries = 0; if (i >= rounds.length) MG.result('conv', lvl, score, rounds.length, 'You can build sentences and finish conversations!'); else draw(); };
  const draw = () => {
    const r = rounds[i];
    if (r.t === 'order') {
      const [en, pt] = r.s, words = en.split(' '), pick = [];
      let chips = EA.shuffle(words.map((w, k) => ({w, k})));
      const render = (fb) => {
        const p = ui.open('<h2>💬 CONVERSATION CHALLENGE — Level ' + lvl + '</h2><div class="row between"><span class="msg">Question ' + (i + 1) + ' of ' + rounds.length + '</span><span class="msg">⭐ <b>' + score + '</b></span></div><div class="msg"><b>Build the sentence in English:</b><br>' + (EA.settings.translate ? '<span class="big-word" style="font-size:1.2em">' + esc(pt) + '</span>' : '<small>(translations are off — use the 🔊 button)</small>') + ' <button class="listen" data-say="' + esc(en) + '">🔊 Listen</button></div>' +
          '<div class="msg" id="oSlot" style="min-height:3em">' + (pick.map((c, n) => '<span class="chip" data-p="' + n + '">' + esc(c.w) + '</span>').join('') || '<small>Tap the words below in the right order...</small>') + '</div><div id="oChips">' + chips.map((c, n) => '<span class="chip ' + (c.used ? 'used' : '') + '" data-c="' + n + '">' + esc(c.w) + '</span>').join('') + '</div>' +
          '<div id="oFb" class="msg ' + (fb ? fb.cls : '') + '">' + (fb ? fb.text : '&nbsp;') + '</div><p class="row"><button id="oOk">✔ Check</button><button id="oReset">↺ Reset</button><button data-close>✖ Quit</button></p>');
        p.querySelectorAll('[data-c]').forEach(e => e.onclick = () => { const c = chips[+e.dataset.c]; c.used = true; pick.push(c); render(); });
        p.querySelectorAll('[data-p]').forEach(e => e.onclick = () => { const c = pick.splice(+e.dataset.p, 1)[0]; c.used = false; render(); });
        $('oReset').onclick = () => { pick.length = 0; chips.forEach(c => c.used = false); render(); };
        $('oOk').onclick = () => {
          if (pick.length < words.length) { render({cls: 'bad', text: 'Use all the words!'}); return; }
          if (pick.map(c => c.w).join(' ') === en) {
            score += tries === 0 ? 1 : 0.5; EA.beep('good'); EA.say(en);
            ui.open('<h2>💬 CONVERSATION CHALLENGE</h2><div class="msg good" style="text-align:center"><p class="big-word">Great job! ⭐</p><p><b>' + esc(en) + '</b></p>' + (EA.settings.translate ? '<p><small>' + esc(pt) + '</small></p>' : '') + '</div><p class="row"><button id="oNext">' + (i + 1 >= rounds.length ? 'Finish ▶' : 'Next ▶') + '</button></p>');
            $('oNext').onclick = next;
          } else { tries++; EA.beep('bad'); render({cls: 'bad', text: 'Try another answer! Check the order of the words.'}); }
        };
      };
      render();
    } else {
      const g = r.g;
      const p = ui.open('<h2>💬 CONVERSATION CHALLENGE — Level ' + lvl + '</h2><div class="row between"><span class="msg">Question ' + (i + 1) + ' of ' + rounds.length + '</span><span class="msg">⭐ <b>' + score + '</b></span></div><div class="msg"><b>Finish the conversation:</b>' +
        g.l.map(([who, line]) => '<p><b>' + esc(who) + ':</b> ' + esc(line) + ' <button class="listen" data-say="' + esc(line.replace('___', '...')) + '">🔊</button></p>').join('') + (EA.settings.translate ? '<small>' + esc(g.pt) + '</small>' : '') + '</div><div class="row" id="gOpts">' +
        EA.shuffle(g.o).map(o => '<button data-o="' + esc(o) + '" style="min-width:120px;flex:1">' + esc(o) + '</button>').join('') + '</div><div id="gFb" class="msg">Choose the best answer.</div><p class="row"><button data-close>✖ Quit</button></p>');
      p.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
        if (b.dataset.o === g.a) {
          score += tries === 0 ? 1 : 0.5; EA.beep('good'); const full = g.l[g.l.length - 1][1].replace('___', g.a); EA.say(full);
          p.querySelectorAll('[data-o]').forEach(x => x.disabled = true); b.style.background = '#b8f5c8';
          const fb = $('gFb'); fb.className = 'msg good'; fb.innerHTML = '<b>Great job! ⭐</b><br>' + esc(full) + '<br>';
          const nb = document.createElement('button'); nb.textContent = i + 1 >= rounds.length ? 'Finish ▶' : 'Next ▶'; nb.onclick = next; fb.appendChild(nb); nb.focus();
        } else { tries++; EA.beep('bad'); b.disabled = true; b.style.background = '#ffc4c4'; const fb = $('gFb'); fb.className = 'msg bad'; fb.innerHTML = '<b>Try another answer!</b>'; }
      });
    }
  };
  draw();
}});
})();
