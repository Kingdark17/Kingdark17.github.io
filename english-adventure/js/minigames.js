/* ===== MINIGAMES: framework + BODY CHALLENGE + DRESS UP ===== */
(function(){
const $ = EA.$, esc = EA.esc, ui = EA.ui;
const MG = EA.minigames = {games: {}};
MG.reg = (id, def) => { MG.games[id] = def; };

const INFO = {
  body:    {title: 'BODY CHALLENGE', icon: '🧍', ev: 'body_done', desc: 'Learn the parts of the body in English. Read the instruction and click the correct part on the character.', objective: 'Click the right body part.', scoring: '1 point for each correct answer at the first try, half a point at the second try.', levels: ['Easy: simple words', 'Medium: all body parts', 'Hard: clues and descriptions']},
  dress:   {title: 'DRESS UP', icon: '👗', ev: 'dress_done', desc: 'Read the instruction in English and dress the character. Then press Check.', objective: 'Put on the right clothes.', scoring: '1 point for each correct outfit at the first check.', levels: ['Easy: names are shown', 'Medium: more clothes', 'Hard: only pictures and colors']},
  petcare: {title: 'PET CARE', icon: '🐾', ev: 'petcare_done', desc: 'Your pet asks for things. Read what it says and press the right action before time runs out!', objective: 'Take care of the pet quickly.', scoring: 'Each correct and fast answer gives points.', levels: ['Easy: lots of time', 'Medium: less time', 'Hard: very fast and buttons move']},
  hunt:    {title: 'WORD HUNT', icon: '🔍', ev: 'hunt_done', desc: 'Walk around English Town and find the objects. Press E near an object to pick it. Read the instruction at the top of the screen.', objective: 'Find every object in the list.', scoring: 'You get more points with fewer mistakes.', levels: ['Easy: 5 objects', 'Medium: 7 objects', 'Hard: 9 objects']},
  shop:    {title: 'SHOPPING LIST', icon: '🛒', ev: 'shop_done', desc: 'Walk around the supermarket. Find the products from the list. Press E near a product to pick it.', objective: 'Find every product on the list.', scoring: 'You get more points with fewer mistakes.', levels: ['Easy: 4 products', 'Medium: 6 products', 'Hard: 8 products']},
  quiz:    {title: 'ENGLISH QUIZ', icon: '❓', ev: 'quiz_done', desc: 'Answer questions about English words: translations, listening, spelling, colors, animals, clothes and more.', objective: 'Answer 10 questions.', scoring: '1 point for each correct answer.', levels: ['Easy: simple words', 'Medium: all words', 'Hard: phrases and spelling']},
  conv:    {title: 'CONVERSATION CHALLENGE', icon: '💬', ev: 'conv_done', desc: 'Complete conversations. Build sentences with the words and finish the dialogues.', objective: 'Complete every conversation.', scoring: '1 point for each correct answer at the first try.', levels: ['Easy: short sentences', 'Medium: longer sentences', 'Hard: long sentences']}
};

MG.start = function(id){
  const info = INFO[id], g = MG.games[id]; if (!g) return;
  let lvl = 1;
  const draw = () => {
    const p = ui.open('<h2>' + info.icon + ' ' + info.title + '</h2><div class="msg"><b>What is it?</b><br>' + esc(info.desc) + '</div><div class="msg"><b>🎯 Objective:</b> ' + esc(info.objective) + '<br><b>⭐ Scoring:</b> ' + esc(info.scoring) + '</div>' +
      '<h3>Choose a level</h3><div class="row">' + info.levels.map((l, i) => '<button data-lv="' + (i + 1) + '" style="' + (lvl === i + 1 ? 'background:#ff7a59;color:#fff' : '') + '">Level ' + (i + 1) + '<br><small>' + esc(l) + '</small></button>').join('') + '</div>' +
      '<p class="row"><button id="mgGo">▶ START</button>' + (g.learn ? '<button id="mgLearn">📖 Learn first</button>' : '') + '<button data-close>✖ Not now</button></p>');
    p.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { lvl = +b.dataset.lv; draw(); });
    $('mgGo').onclick = () => g.run(lvl);
    if ($('mgLearn')) $('mgLearn').onclick = () => g.learn(draw);
  };
  draw();
};

MG.result = function(id, lvl, score, max, extra){
  const info = INFO[id], s = EA.state;
  const ratio = max ? Math.max(0, Math.min(1, score / max)) : 0;
  const stars = ratio >= 0.85 ? 3 : ratio >= 0.55 ? 2 : 1;
  const plays = (s.stats['plays_' + id] = (s.stats['plays_' + id] || 0) + 1);
  const f = (plays <= 3 ? 1 : 0.5) * (1 + (lvl - 1) * 0.25);
  const xp = Math.round((8 + 24 * ratio) * f), coins = Math.round((4 + 14 * ratio) * f);
  const best = Math.round(ratio * 100);
  if (!s.stats[info.title] || best > s.stats[info.title]) s.stats[info.title] = best + '%';
  EA.beep('level');
  const p = ui.open('<h2>' + info.icon + ' ' + info.title + ' — Complete!</h2><div class="msg" style="text-align:center"><div style="font-size:2.4em">' + '⭐'.repeat(stars) + '☆'.repeat(3 - stars) + '</div><div class="big-word">' + (Math.round(score * 10) / 10) + ' / ' + max + '</div>' +
    '<p>' + (stars === 3 ? 'Excellent! You are a star! 🌟' : stars === 2 ? 'Great job! Keep practicing! 👏' : 'Good try! Play again to improve. 💪') + '</p><p><b>Rewards:</b> +' + xp + ' XP • +' + coins + ' 🪙</p>' + (extra ? '<p>' + extra + '</p>' : '') + '</div>' +
    '<p class="row"><button id="mgAgain">↻ Play again</button><button data-close>✔ Finish</button></p>');
  EA.addCoins(coins); EA.addXP(xp); EA.emit(info.ev);
  EA.save(true);
  $('mgAgain').onclick = () => MG.start(id);
};

/* ======================= BODY CHALLENGE ======================= */
const U = 13, OX = 29, OY = 12; // grid unit and offset of the figure in the canvas
const PARTS = {
  hair: [[3.5, 0, 7, 2.2]], head: [[4, 1.5, 6, 5.5]], ears: [[3.2, 3.2, 0.8, 1.6], [10, 3.2, 0.8, 1.6]],
  eyes: [[5, 3.4, 1.2, 1.2], [7.8, 3.4, 1.2, 1.2]], nose: [[6.6, 4.5, 0.8, 1]], mouth: [[6, 5.7, 2, 0.6]], neck: [[6, 7, 2, 1.2]],
  shoulders: [[2.4, 8.2, 1.8, 1.8], [9.8, 8.2, 1.8, 1.8]], arms: [[2.4, 10, 1.8, 4.2], [9.8, 10, 1.8, 4.2], [4, 8.2, 6, 6]],
  hands: [[2.4, 14.2, 1.8, 1.6], [9.8, 14.2, 1.8, 1.6]], fingers: [[2.4, 15.8, 1.8, 1.2], [9.8, 15.8, 1.8, 1.2]],
  legs: [[4.4, 14.2, 2.4, 3.6], [7.2, 14.2, 2.4, 3.6], [4.4, 19.2, 2.4, 2.2], [7.2, 19.2, 2.4, 2.2]],
  knees: [[4.4, 17.8, 2.4, 1.4], [7.2, 17.8, 2.4, 1.4]], feet: [[4, 21.4, 3, 1.4], [7, 21.4, 3, 1.4]], toes: [[4, 22.8, 3, 0.9], [7, 22.8, 3, 0.9]]
};
// the torso rect is listed under arms only as a fallback; real torso clicks are "wrong" -> handled below
PARTS.arms.pop();
const ORDER = ['toes', 'fingers', 'eyes', 'ears', 'nose', 'mouth', 'knees', 'hair', 'neck', 'shoulders', 'hands', 'feet', 'arms', 'legs', 'head'];
MG.bodyHit = function(gx, gy){
  for (const k of ORDER) for (const [x, y, w, h] of PARTS[k]) if (gx >= x && gx <= x + w && gy >= y && gy <= y + h) return k;
  return null;
};
function drawBody(c, W, H, hl, flash){
  c.clearRect(0, 0, W, H);
  const skin = EA.SKINS[EA.state.look.skin], dark = EA.shade(skin, -30), hair = EA.HAIRCOLORS[EA.state.look.hc];
  const o = EA.state.outfit, col = id => id ? EA.COLOR[EA.ITEMS[id].color] : null;
  const P = (x, y, w, h, color) => { c.fillStyle = color; c.fillRect(Math.round(OX + x * U), Math.round(OY + y * U), Math.ceil(w * U), Math.ceil(h * U)); };
  const topC = col(o.top) || '#d8d8e0', botC = col(o.bottom) || '#8aa0c8';
  // legs & feet
  P(4.4, 14.2, 2.4, 7.2, skin); P(7.2, 14.2, 2.4, 7.2, skin);
  P(4.4, 14.2, 2.4, 3.2, botC); P(7.2, 14.2, 2.4, 3.2, botC);
  if (o.bottom && !/shorts/.test(o.bottom)) { P(4.4, 14.2, 2.4, 7.2, botC); P(7.2, 14.2, 2.4, 7.2, botC); P(4.4, 17.8, 2.4, 1.4, EA.shade(botC, -20)); P(7.2, 17.8, 2.4, 1.4, EA.shade(botC, -20)); }
  else P(4.4, 17.8, 2.4, 1.4, dark), P(7.2, 17.8, 2.4, 1.4, dark);
  P(4, 21.4, 3, 1.4, '#6b4a2b'); P(7, 21.4, 3, 1.4, '#6b4a2b'); P(4, 22.8, 3, 0.9, skin); P(7, 22.8, 3, 0.9, skin);
  [4.5, 5.4, 6.3, 7.5, 8.4, 9.3].forEach(x => P(x, 22.8, 0.1, 0.9, dark));
  // torso, arms
  P(4, 8.2, 6, 6, topC); P(4, 13.2, 6, 1.2, EA.shade(topC, -25));
  P(2.4, 8.2, 1.8, 6, topC); P(9.8, 8.2, 1.8, 6, topC);
  P(2.4, 11, 1.8, 3.2, skin); P(9.8, 11, 1.8, 3.2, skin);
  P(2.4, 14.2, 1.8, 1.6, skin); P(9.8, 14.2, 1.8, 1.6, skin);
  P(2.4, 15.8, 1.8, 1.2, skin); P(9.8, 15.8, 1.8, 1.2, skin);
  [2.7, 3.15, 3.6].forEach(x => P(x, 15.8, 0.08, 1.2, dark)); [10.1, 10.55, 11].forEach(x => P(x, 15.8, 0.08, 1.2, dark));
  // neck, head
  P(6, 7, 2, 1.3, dark); P(4, 1.5, 6, 5.5, skin); P(3.2, 3.2, 0.8, 1.6, skin); P(10, 3.2, 0.8, 1.6, skin);
  P(3.5, 0, 7, 2.2, hair); P(3.6, 1.2, 0.8, 2, hair); P(9.6, 1.2, 0.8, 2, hair);
  P(5, 3.4, 1.2, 1.2, '#2b2340'); P(7.8, 3.4, 1.2, 1.2, '#2b2340'); P(6.6, 4.5, 0.8, 1, dark); P(6, 5.7, 2, 0.6, '#c0504d');
  if (o.hat) P(3.4, -0.3, 7.2, 1.8, col(o.hat));
  if (o.glasses) { P(4.7, 3.2, 1.8, 1.6, '#2b2340'); P(7.5, 3.2, 1.8, 1.6, '#2b2340'); P(4.9, 3.4, 1.4, 1.2, '#bfe6ff'); P(7.7, 3.4, 1.4, 1.2, '#bfe6ff'); }
  if (hl) for (const [x, y, w, h] of PARTS[hl]) { c.strokeStyle = flash || '#ff3b5c'; c.lineWidth = 3; c.strokeRect(OX + x * U - 2, OY + y * U - 2, w * U + 4, h * U + 4); }
}
const BODY_EASY = ['head', 'hair', 'eyes', 'ears', 'nose', 'mouth', 'hands', 'feet'];
const BODY_ALL = Object.keys(PARTS);
const BODY_HARD = [
  ['Click on the part you use to smell.', 'Clique na parte que você usa para sentir cheiro.', 'nose'],
  ['Click on the parts you use to see.', 'Clique nas partes que você usa para ver.', 'eyes'],
  ['Click on the parts you use to hear.', 'Clique nas partes que você usa para ouvir.', 'ears'],
  ['Click on the part you use to brush your teeth.', 'Clique na parte que você usa para escovar os dentes.', 'mouth'],
  ['Click on the part between your head and your shoulders.', 'Clique na parte entre a cabeça e os ombros.', 'neck'],
  ['Click on the part in the middle of your leg.', 'Clique na parte do meio da perna.', 'knees'],
  ['Click on the five small parts on each hand.', 'Clique nas cinco partes pequenas de cada mão.', 'fingers'],
  ['Click on the small parts at the end of your feet.', 'Clique nas partes pequenas na ponta dos pés.', 'toes'],
  ['Click on the part that grows on your head.', 'Clique na parte que cresce na sua cabeça.', 'hair'],
  ['Click on the parts you use to clap.', 'Clique nas partes que você usa para bater palmas.', 'hands'],
  ['Click on the part where you wear a hat.', 'Clique na parte onde você usa um chapéu.', 'head'],
  ['Click on the parts you use to walk and run.', 'Clique nas partes que você usa para andar e correr.', 'legs']
];
function bodyGame(learnOnly, lvl, back){
  const W = 240, H = 330;
  const rounds = learnOnly ? [] : EA.shuffle(lvl === 1 ? BODY_EASY.map(k => [null, null, k]) : lvl === 2 ? BODY_ALL.map(k => [null, null, k]) : BODY_HARD).slice(0, lvl === 1 ? 8 : 10);
  let i = 0, score = 0, tries = 0, done = false, hover = null;
  const p = ui.open('<h2>🧍 BODY CHALLENGE ' + (learnOnly ? '— Learn' : '— Level ' + lvl) + '</h2><div class="row between"><span id="bcInfo" class="msg" style="flex:1"></span><span class="msg">⭐ <b id="bcScore">0</b></span></div><div class="row" style="align-items:flex-start;justify-content:center"><canvas id="bc" class="pv" width="' + W + '" height="' + H + '" style="cursor:pointer;max-width:100%"></canvas><div style="flex:1;min-width:200px"><div id="bcPrompt" class="msg" style="font-size:1.2em"></div><div id="bcFb" class="msg"></div><div id="bcSay"></div></div></div><p class="row"><button id="bcBack">' + (learnOnly ? '↩ Back' : '✖ Quit') + '</button></p>');
  const cv = $('bc'), c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  const redraw = (hl, col) => drawBody(c, W, H, hl, col);
  const pos = e => { const r = cv.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return [((t.clientX - r.left) / r.width * W - OX) / U, ((t.clientY - r.top) / r.height * H - OY) / U]; };
  $('bcBack').onclick = () => { if (learnOnly && back) back(); else ui.close(); };
  if (learnOnly) {
    $('bcInfo').textContent = 'Learn mode: click a body part to see and hear its name.';
    $('bcPrompt').textContent = 'Click on the body!'; redraw();
    cv.onclick = e => { const [gx, gy] = pos(e); const k = MG.bodyHit(gx, gy); if (!k) { $('bcFb').textContent = 'Click on a body part.'; return; } const w = EA.WORD[k]; redraw(k, '#2ecc71'); EA.say(w.en); EA.learn(k, true); $('bcFb').innerHTML = '<span class="big-word">' + w.en + '</span> ' + (EA.settings.translate ? '— ' + w.pt : '') + ' <button class="listen" data-say="' + w.en + '">🔊 Listen</button>'; ui.bind($('bcFb')); };
    return;
  }
  const show = () => {
    const r = rounds[i];
    $('bcInfo').textContent = 'Question ' + (i + 1) + ' of ' + rounds.length;
    const w = EA.WORD[r[2]];
    const text = r[0] || (lvl === 2 && i % 2 ? 'Touch the ' + w.en.toLowerCase() + '!' : 'Click on the ' + w.en.toLowerCase() + '!');
    r.text = text;
    $('bcPrompt').innerHTML = '<b>' + esc(text) + '</b> <button class="listen" data-say="' + esc(text) + '">🔊 Listen</button>' + (EA.settings.translate && r[1] ? '<br><small>' + esc(r[1]) + '</small>' : '');
    ui.bind($('bcPrompt')); EA.say(text);
    $('bcFb').textContent = ''; tries = 0; redraw();
  };
  cv.onclick = e => {
    if (done) return;
    const r = rounds[i], [gx, gy] = pos(e), k = MG.bodyHit(gx, gy), fb = $('bcFb');
    if (k === r[2]) {
      const w = EA.WORD[k]; score += tries === 0 ? 1 : 0.5; $('bcScore').textContent = score; EA.beep('good'); EA.learn(k, true); EA.say(w.en);
      redraw(k, '#2ecc71'); fb.className = 'msg good'; fb.innerHTML = '<b>Excellent! You found the ' + w.en.toLowerCase() + '!</b>';
      done = true;
      setTimeout(() => { done = false; i++; if (i >= rounds.length) MG.result('body', lvl, score, rounds.length, 'You practiced ' + new Set(rounds.map(x => x[2])).size + ' body words!'); else show(); }, 1100);
    } else {
      tries++; EA.beep('bad'); redraw(k, '#e74c3c');
      fb.className = 'msg bad'; fb.innerHTML = '<b>Try again! Look carefully.</b>' + (k ? '<br><small>That is the ' + EA.WORD[k].en.toLowerCase() + '.</small>' : '');
      if (tries >= 3 && !done) { fb.innerHTML += '<br><small>Hint: look at the highlighted area.</small>'; redraw(r[2], '#f7c948'); }
    }
  };
  show();
}
MG.reg('body', {run: lvl => bodyGame(false, lvl), learn: back => bodyGame(true, 1, back)});

/* ======================= DRESS UP ======================= */
const SLOT_TABS = [['top', '👕 Tops'], ['bottom', '👖 Bottoms'], ['dress', '👗 Dresses'], ['shoes', '👟 Shoes'], ['jacket', '🧥 Jackets'], ['hat', '🎩 Hats'], ['glasses', '👓 Glasses'], ['acc', '🧣 Accessories']];
MG.reg('dress', {run: lvl => {
  const pool = Object.values(EA.ITEMS).filter(i => i.slot && !i.lock && i.id !== 'tshirt_white');
  const easyPool = pool.filter(i => ['top', 'bottom', 'shoes', 'hat'].includes(i.slot));
  const base = {top: 'tshirt_white', bottom: 'pants_blue', shoes: 'shoes_brown', hat: null, glasses: null, jacket: null, acc: null, dress: null};
  const targets = EA.shuffle(lvl === 1 ? easyPool : pool).filter(i => !Object.values(base).includes(i.id)).slice(0, 8);
  let i = 0, score = 0, tries = 0, outfit = Object.assign({}, base), slot = 'top';
  const verb = ['Put on', 'Wear'];
  const draw = (fb) => {
    const t = targets[i], lower = t.name.toLowerCase();
    const text = (i % 3 === 2 && ['hat', 'jacket', 'glasses'].includes(t.slot) ? verb[0] + ' a ' : verb[i % 2] + ' the ') + lower + '!';
    const items = pool.filter(it => it.slot === slot);
    const p = ui.open('<h2>👗 DRESS UP — Level ' + lvl + '</h2><div class="row between"><span class="msg">Question ' + (i + 1) + ' of ' + targets.length + '</span><span class="msg">⭐ <b>' + score + '</b></span></div>' +
      '<div class="msg" style="font-size:1.25em"><b>' + esc(text) + '</b> <button class="listen" data-say="' + esc(text) + '">🔊 Listen</button>' + (EA.settings.translate ? '<br><small>' + esc(t.pt) + '</small>' : '') + '</div>' +
      '<div class="row" style="align-items:flex-start"><canvas class="pv" id="pv" width="170" height="240"></canvas><div style="flex:1;min-width:230px"><div class="tabs">' + SLOT_TABS.map(([k, n]) => '<button data-slot="' + k + '" class="' + (k === slot ? 'on' : '') + '">' + n + '</button>').join('') + '</div><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(100px,1fr))">' +
      '<div class="card" data-id="none"><span class="ic">🚫</span><small>None</small></div>' +
      items.map(it => '<div class="card ' + (outfit[slot] === it.id ? 'sel' : '') + '" data-id="' + it.id + '"><span class="ic">' + it.icon + '</span><span class="sw" style="background:' + EA.COLOR[it.color] + '"></span>' + (lvl < 3 ? '<b>' + esc(it.name) + '</b>' : '') + '</div>').join('') + '</div></div></div>' +
      '<div id="dFb" class="msg ' + (fb ? fb.cls : '') + '">' + (fb ? fb.text : 'Choose the clothes, then press Check.') + '</div><p class="row"><button id="dCheck">✔ Check</button><button id="dReset">↺ Reset</button><button data-close>✖ Quit</button></p>');
    ui.drawPreview($('pv'), {look: EA.state.look, outfit}, 6);
    p.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { slot = b.dataset.slot; draw(); });
    p.querySelectorAll('[data-id]').forEach(c => c.onclick = () => { const id = c.dataset.id; if (id === 'none') outfit[slot] = null; else { outfit[slot] = id; if (slot === 'top' || slot === 'bottom') outfit.dress = null; if (slot === 'dress') { /* dress covers top & bottom visually */ } } draw(fb); });
    $('dReset').onclick = () => { outfit = Object.assign({}, base); draw(); };
    $('dCheck').onclick = () => {
      if (outfit[t.slot] === t.id) {
        score += tries === 0 ? 1 : 0.5; EA.beep('good'); if (t.word) EA.learn(t.word, true); EA.learn(EA.wordId(EA.COLOR && t.color ? t.color : 'red') || 'red', true);
        EA.say(t.name);
        ui.open('<h2>👗 DRESS UP</h2><div class="msg good" style="text-align:center"><canvas class="pv" id="pv2" width="170" height="240"></canvas><p class="big-word">Great job! ⭐</p><p>You put on the ' + esc(lower) + '.</p></div><p class="row"><button id="dNext">' + (i + 1 >= targets.length ? 'Finish ▶' : 'Next ▶') + '</button></p>');
        ui.drawPreview($('pv2'), {look: EA.state.look, outfit}, 6);
        $('dNext').onclick = () => { i++; tries = 0; outfit = Object.assign({}, base); slot = 'top'; if (i >= targets.length) MG.result('dress', lvl, score, targets.length, 'You learned colors and clothes!'); else draw(); };
      } else { tries++; EA.beep('bad'); draw({cls: 'bad', text: 'Try again! Read the instruction carefully.' + (tries >= 2 ? ' Hint: look in the ' + ({top: 'Tops', bottom: 'Bottoms', dress: 'Dresses', shoes: 'Shoes', jacket: 'Jackets', hat: 'Hats', glasses: 'Glasses', acc: 'Accessories'})[t.slot] + ' tab.' : '')}); }
    };
    ui.bind(p);
  };
  draw();
}});
})();
