/* ===== UI 2: wardrobe (DRESS UP), character creator, shops, MY PET ===== */
(function(){
const $ = EA.$, esc = EA.esc, ui = EA.ui;
const SLOTS = [['top', 'Tops', '👕'], ['bottom', 'Bottoms', '👖'], ['dress', 'Dresses', '👗'], ['shoes', 'Shoes', '👟'], ['jacket', 'Jackets', '🧥'], ['hat', 'Hats', '🎩'], ['glasses', 'Glasses', '👓'], ['acc', 'Accessories', '🧣']];
const swatch = c => '<span class="sw" style="background:' + c + '"></span>';

/* ---------- wardrobe at home (real outfit) ---------- */
ui.wardrobe = function(){
  let slot = 'top';
  const draw = () => {
    const owned = Object.keys(EA.ITEMS).filter(id => EA.has(id) && EA.ITEMS[id].slot === slot);
    const cur = EA.state.outfit[slot];
    const p = ui.open('<h2>👗 Wardrobe — Dress Up</h2><div class="row" style="align-items:flex-start"><canvas class="pv" id="pv" width="200" height="270"></canvas><div style="flex:1;min-width:230px"><div class="tabs">' +
      SLOTS.map(([k, n, ic]) => '<button data-slot="' + k + '" class="' + (k === slot ? 'on' : '') + '">' + ic + ' ' + n + '</button>').join('') + '</div><div class="grid">' +
      '<div class="card ' + (!cur ? 'sel' : '') + '" data-id="none"><span class="ic">🚫</span><b>None</b><small>Take off</small></div>' +
      owned.map(id => { const i = EA.ITEMS[id]; return '<div class="card ' + (cur === id ? 'sel' : '') + '" data-id="' + id + '"><span class="ic">' + i.icon + '</span><b>' + esc(i.name) + '</b>' + swatch(EA.COLOR[i.color]) + '<small>' + esc(EA.tr(i.pt)) + '</small></div>'; }).join('') +
      '</div><p><small>Tip: buy more clothes at the Clothes Shop. Click an item to put it on or take it off.</small></p></div></div><p class="row"><button data-close>✔ Done</button></p>');
    ui.drawPreview($('pv'), EA.charOf(), 7);
    p.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { slot = b.dataset.slot; draw(); });
    p.querySelectorAll('[data-id]').forEach(c => c.onclick = () => {
      const id = c.dataset.id;
      if (id === 'none') EA.unequip(slot); else { if (EA.state.outfit[slot] === id) EA.unequip(slot); else { EA.equip(id); EA.say(EA.ITEMS[id].name); if (EA.ITEMS[id].word) EA.learn(EA.ITEMS[id].word); } }
      draw();
    });
  };
  draw();
};

/* ---------- character creator ---------- */
const STARTERS = {
  top: ['tshirt_white', 'shirt_blue', 'tshirt_green', 'tshirt_yellow'],
  bottom: ['pants_blue', 'shorts_red', 'shorts_green'],
  shoes: ['shoes_brown', 'sneakers_white'],
  hat: [null, 'hat_blue', 'hat_red'],
  glasses: [null, 'glasses_black'],
  acc: [null, 'scarf_red']
};
ui.customize = function(isNew){
  const s = EA.state;
  const tmp = {name: isNew ? '' : s.name, look: Object.assign({}, s.look), outfit: Object.assign({}, s.outfit)};
  const who = () => ({look: tmp.look, outfit: tmp.outfit});
  const draw = (keepName) => {
    if (keepName && $('cName')) tmp.name = $('cName').value;
    const p = ui.open('<h2>' + (isNew ? '🧑 Create your character' : '🪞 Mirror') + '</h2><div class="row" style="align-items:flex-start"><div><canvas class="pv" id="pv" width="200" height="270"></canvas></div><div style="flex:1;min-width:240px">' +
      '<label><b>Name</b></label><input type="text" id="cName" maxlength="12" placeholder="Your name" value="' + esc(tmp.name) + '">' +
      '<h3>Skin</h3><div class="row">' + EA.SKINS.map((c, i) => '<button data-skin="' + i + '" style="padding:6px;' + (tmp.look.skin === i ? 'outline:4px solid #ff7a59' : '') + '">' + swatch(c) + '</button>').join('') + '</div>' +
      '<h3>Hair style</h3><div class="row">' + EA.HAIRSTYLES.map(h => '<button data-style="' + h + '" class="' + (tmp.look.style === h ? 'on' : '') + '" style="' + (tmp.look.style === h ? 'background:#ff7a59;color:#fff' : '') + '">' + h + '</button>').join('') + '</div>' +
      '<h3>Hair color</h3><div class="row">' + EA.HAIRCOLORS.map((c, i) => '<button data-hc="' + i + '" style="padding:6px;' + (tmp.look.hc === i ? 'outline:4px solid #ff7a59' : '') + '">' + swatch(c) + '</button>').join('') + '</div>' +
      (isNew ? Object.entries(STARTERS).map(([sl, ids]) => '<h3>' + {top: 'Top', bottom: 'Bottom', shoes: 'Shoes', hat: 'Hat (accessory)', glasses: 'Glasses (accessory)', acc: 'Scarf (accessory)'}[sl] + '</h3><div class="row">' + ids.map(id => { const it = id && EA.ITEMS[id]; return '<button data-st="' + sl + ':' + (id || '') + '" style="' + (tmp.outfit[sl] === id ? 'background:#ff7a59;color:#fff' : '') + '">' + (it ? it.icon + ' ' + esc(it.name) : '🚫 None') + '</button>'; }).join('') + '</div>').join('') : '<p><small>Use the wardrobe to change clothes.</small></p>') +
      '</div></div><p class="row"><button id="cOk">' + (isNew ? '▶ Start adventure!' : '✔ Done') + '</button>' + (isNew ? '<button data-close>↩ Back</button>' : '<button data-close>✖ Cancel</button>') + '</p><div id="cMsg" class="bad"></div>');
    ui.drawPreview($('pv'), who(), 7);
    p.querySelectorAll('[data-skin]').forEach(b => b.onclick = () => { tmp.look.skin = +b.dataset.skin; draw(true); });
    p.querySelectorAll('[data-style]').forEach(b => b.onclick = () => { tmp.look.style = b.dataset.style; draw(true); });
    p.querySelectorAll('[data-hc]').forEach(b => b.onclick = () => { tmp.look.hc = +b.dataset.hc; draw(true); });
    p.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { const [sl, id] = b.dataset.st.split(':'); tmp.outfit[sl] = id || null; if (sl === 'top' || sl === 'bottom') tmp.outfit.dress = null; draw(true); });
    $('cOk').onclick = () => {
      const name = ($('cName').value || '').trim();
      if (isNew && !name) { $('cMsg').textContent = 'Please write your name.'; $('cName').focus(); return; }
      s.name = (name || s.name || 'Player').slice(0, 12);
      s.look = tmp.look;
      if (isNew) {
        Object.values(tmp.outfit).forEach(id => { if (id && !EA.has(id)) EA.giveItem(id, 1); });
        s.outfit = tmp.outfit;
        ui.close(); EA.main.begin();
      } else { ui.close(); EA.toast('You look great, ' + s.name + '! ✨', 'good'); EA.learn('look'); }
    };
  };
  draw(false);
};

/* ---------- shops ---------- */
const MARKET = {fruit: ['apple', 'banana'], veg: ['carrot', 'tomato'], drinks: ['milk', 'juice'], hygiene: ['soap', 'toothpaste'], bakery: ['bread', 'cheese'], petfood: ['dogfood', 'catfood']};
ui.shop = function(kind, cat){
  if (kind === 'clothes') return clothesShop();
  const ids = kind === 'pet' ? ['dogfood', 'catfood', 'mouse_toy', 'rope_toy', 'collar_red', 'collar_blue', 'pet_bow']
    : (cat ? MARKET[cat] : [].concat(...Object.values(MARKET)));
  let sel = ids[0];
  const draw = () => {
    const it = EA.ITEMS[sel];
    const p = ui.open('<h2>' + (kind === 'pet' ? '🐶 Pet Shop' : '🛒 Supermarket') + '</h2><div class="row between"><span class="msg">🪙 <b>' + EA.state.coins + '</b> coins</span></div>' +
      '<div class="msg"><span style="font-size:2em">' + it.icon + '</span> <b class="big-word" style="font-size:1.2em">' + esc(it.name) + '</b> <button class="listen" data-say="' + esc(it.name) + '">🔊 Listen</button><br>' + (EA.settings.translate ? '🇧🇷 ' + esc(it.pt) + ' • ' : '') + esc(it.desc) + '<br>Price: 🪙 ' + it.price + ' • You have: ' + EA.count(sel) +
      '<div class="row" style="margin-top:6px"><button id="shBuy">🪙 Buy (' + it.price + ')</button></div></div><div class="grid">' +
      ids.map(id => { const i = EA.ITEMS[id]; return '<div class="card ' + (id === sel ? 'sel' : '') + '" data-id="' + id + '"><span class="ic">' + i.icon + '</span><b>' + esc(i.name) + '</b><small>🪙 ' + i.price + ' • have ' + EA.count(id) + '</small></div>'; }).join('') + '</div><p class="row"><button data-close>✖ Close</button></p>');
    p.querySelectorAll('[data-id]').forEach(c => c.onclick = () => { sel = c.dataset.id; EA.say(EA.ITEMS[sel].name); if (EA.ITEMS[sel].word) EA.learn(EA.ITEMS[sel].word); draw(); });
    $('shBuy').onclick = () => {
      if (EA.state.coins < it.price) { EA.beep('bad'); EA.toast('Not enough coins! Play minigames to earn more. 🪙', 'bad'); return; }
      EA.addCoins(-it.price); EA.giveItem(sel, 1); EA.learn('buy'); EA.beep('good'); EA.toast('You bought: ' + it.name + ' ' + it.icon, 'good'); EA.addXP(2, true); draw();
    };
  };
  draw();
};
function clothesShop(){
  let slot = 'top', sel = null;
  const tryOn = Object.assign({}, EA.state.outfit);
  const draw = () => {
    const ids = Object.keys(EA.ITEMS).filter(id => { const i = EA.ITEMS[id]; return i.slot === slot && !i.start; });
    const it = sel && EA.ITEMS[sel];
    let detail = '<div class="msg">Click a piece of clothing to <b>try it on</b>. Then buy it!</div>';
    if (it) {
      const own = EA.has(sel), locked = it.lock && !own;
      detail = '<div class="msg"><span style="font-size:2em">' + it.icon + '</span> <b class="big-word" style="font-size:1.2em">' + esc(it.name) + '</b> <button class="listen" data-say="' + esc(it.name) + '">🔊 Listen</button><br>' + (EA.settings.translate ? '🇧🇷 ' + esc(it.pt) + '<br>' : '') +
        (locked ? '🔒 Unlock this reward at Level ' + it.lock + '.' : own ? '✔ You own this. ' : 'Price: 🪙 ' + it.price) +
        '<div class="row" style="margin-top:6px">' + (own ? '<button id="csWear">👕 Wear it now</button>' : (!locked ? '<button id="csBuy">🪙 Buy (' + it.price + ')</button>' : '')) + '<button id="csReset">↺ My outfit</button></div></div>';
    }
    const p = ui.open('<h2>👗 Clothes Shop</h2><div class="row" style="align-items:flex-start"><div><canvas class="pv" id="pv" width="190" height="260"></canvas><div class="msg">🪙 <b>' + EA.state.coins + '</b> coins</div></div><div style="flex:1;min-width:240px"><div class="tabs">' +
      SLOTS.map(([k, n, ic]) => '<button data-slot="' + k + '" class="' + (k === slot ? 'on' : '') + '">' + ic + ' ' + n + '</button>').join('') + '</div>' + detail + '<div class="grid">' +
      ids.map(id => { const i = EA.ITEMS[id]; const own = EA.has(id); return '<div class="card ' + (sel === id ? 'sel' : '') + (i.lock && !own ? ' locked' : '') + '" data-id="' + id + '"><span class="ic">' + i.icon + '</span><b>' + esc(i.name) + '</b>' + swatch(EA.COLOR[i.color]) + '<small>' + (own ? '✔ owned' : i.lock ? '🔒 Level ' + i.lock : '🪙 ' + i.price) + '</small></div>'; }).join('') +
      '</div></div></div><p class="row"><button data-close>✖ Close</button></p>');
    ui.drawPreview($('pv'), {look: EA.state.look, outfit: tryOn}, 6.5);
    p.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { slot = b.dataset.slot; sel = null; draw(); });
    p.querySelectorAll('[data-id]').forEach(c => c.onclick = () => {
      sel = c.dataset.id; const i = EA.ITEMS[sel];
      tryOn[i.slot] = sel; if (i.slot === 'top' || i.slot === 'bottom') tryOn.dress = null;
      EA.say(i.name); if (i.word) EA.learn(i.word); draw();
    });
    if ($('csBuy')) $('csBuy').onclick = () => {
      if (EA.state.coins < it.price) { EA.beep('bad'); EA.toast('Not enough coins! Play minigames to earn more. 🪙', 'bad'); return; }
      EA.addCoins(-it.price); EA.giveItem(sel, 1); EA.learn('buy'); EA.beep('good'); EA.toast('You bought: ' + it.name + ' ' + it.icon, 'good'); EA.addXP(3, true); draw();
    };
    if ($('csWear')) $('csWear').onclick = () => { EA.equip(sel); Object.assign(tryOn, EA.state.outfit); EA.toast('You are wearing: ' + it.name, 'good'); draw(); };
    if ($('csReset')) $('csReset').onclick = () => { Object.assign(tryOn, EA.state.outfit); draw(); };
  };
  draw();
}

/* ---------- adopt ---------- */
ui.adoptMenu = function(){
  const s = EA.state;
  if (s.pet) {
    ui.open('<h2>🐾 Pet Shop</h2><div class="msg">You already have <b>' + esc(s.pet.name) + '</b> the ' + s.pet.type + '! Take good care of your pet.</div><p class="row"><button id="aPet">🐾 Open My Pet</button><button data-close>✖ Close</button></p>');
    $('aPet').onclick = () => ui.petMenu(); return;
  }
  let choice = null;
  const draw = () => {
    const p = ui.open('<h2>🐾 Adopt a pet</h2><p>Choose your new friend. A pet needs <b>food</b>, <b>water</b> and <b>love</b>!</p><div class="row">' +
      [['dog', 'Dog', 'cachorro', 'Loves to play and run!'], ['cat', 'Cat', 'gato', 'Soft, calm and curious.']].map(([t, n, pt, d]) => '<div class="card ' + (choice === t ? 'sel' : '') + '" data-t="' + t + '" style="flex:1;min-width:150px"><canvas id="pc_' + t + '" width="150" height="130"></canvas><br><b>' + n + '</b> ' + (EA.settings.translate ? '(' + pt + ')' : '') + '<small>' + d + '</small></div>').join('') + '</div>' +
      (choice ? '<div class="msg"><b>Name your ' + choice + ':</b><input type="text" id="pName" maxlength="12" value="' + (choice === 'dog' ? 'Buddy' : 'Misty') + '"><div class="row" style="margin-top:6px"><button id="aOk">❤ Adopt!</button></div></div>' : '<p class="msg">Click an animal to choose it.</p>') +
      '<p class="row"><button data-close>✖ Close</button></p>');
    ['dog', 'cat'].forEach(t => ui.petPreview($('pc_' + t), t, null, 5));
    p.querySelectorAll('[data-t]').forEach(c => c.onclick = () => { choice = c.dataset.t; EA.say(choice === 'dog' ? 'Dog' : 'Cat'); EA.learn(choice); draw(); });
    if ($('aOk')) $('aOk').onclick = () => {
      const name = ($('pName').value || '').trim() || (choice === 'dog' ? 'Buddy' : 'Misty');
      s.pet = {type: choice, name: name.slice(0, 12), hunger: 75, thirst: 75, fun: 75, love: 70, acc: null};
      EA.world.pet.x = EA.world.player.x - 20; EA.world.pet.y = EA.world.player.y;
      EA.learn('pet'); EA.emit('adopt'); EA.addXP(10, true); EA.beep('good'); EA.save(true);
      ui.close(); EA.toast('🎉 You adopted ' + s.pet.name + '! It will follow you.', 'good');
    };
  };
  draw();
};

/* ---------- MY PET ---------- */
ui.feedPet = function(itemId){
  const pet = EA.state.pet, it = EA.ITEMS[itemId];
  if (!pet) { EA.toast('You need a pet first! Visit the Pet Shop 🐶', 'bad'); return false; }
  if (it.pet !== pet.type) { EA.toast('This food is for ' + (it.pet === 'dog' ? 'dogs' : 'cats') + '!', 'bad'); return false; }
  if (pet.hunger >= 92) { EA.toast(pet.name + ' is not hungry now!', ''); return false; }
  EA.takeItem(itemId);
  pet.hunger = Math.min(100, pet.hunger + 38); pet.love = Math.min(100, pet.love + 3);
  EA.learn('eat'); if (it.word) EA.learn(it.word); EA.addXP(3, true); EA.emit('feed');
  EA.toast('😋 ' + pet.name + ' eats the ' + it.name.toLowerCase() + '. Yummy!', 'good');
  return true;
};
ui.playPet = function(toyId){
  const pet = EA.state.pet;
  if (!pet) { EA.toast('You need a pet first! Visit the Pet Shop 🐶', 'bad'); return false; }
  pet.fun = Math.min(100, pet.fun + 28); pet.love = Math.min(100, pet.love + 5);
  EA.learn('play'); EA.learn('toy'); EA.addXP(2, true);
  EA.toast('🎾 You play with ' + pet.name + '!', 'good'); return true;
};
ui.petMenu = function(){
  const s = EA.state, pet = s.pet;
  if (!pet) { ui.open('<h2>🐾 My Pet</h2><div class="msg">You do not have a pet yet. Visit the <b>Pet Shop</b> and adopt a dog or a cat! 🐶🐱</div><p class="row"><button data-close>✖ Close</button></p>'); return; }
  let react = null, showAcc = false, raf = 0;
  const bar = (label, v, color) => '<div class="row"><span style="width:90px">' + label + '</span><div class="bar"><div style="width:' + v + '%;background:' + color + '"></div></div><span>' + Math.round(v) + '</span></div>';
  const food = pet.type === 'dog' ? 'dogfood' : 'catfood';
  const toy = ['rope_toy', 'mouse_toy', 'ball'].find(id => EA.has(id)) || 'ball';
  const draw = () => {
    const accIds = Object.keys(EA.ITEMS).filter(id => EA.ITEMS[id].cat === 'petacc' && EA.has(id));
    const p = ui.open('<h2>🐾 My Pet: ' + esc(pet.name) + ' <small>the ' + pet.type + (EA.settings.translate ? ' (' + (pet.type === 'dog' ? 'cachorro' : 'gato') + ')' : '') + '</small></h2><div class="row" style="align-items:flex-start"><canvas class="pv" id="pc" width="260" height="220"></canvas><div style="flex:1;min-width:230px">' +
      '<div class="msg"><b>Happiness: ' + EA.petMood() + ' ' + EA.petHappiness() + '%</b></div>' + bar('Food', pet.hunger, '#f39c12') + bar('Water', pet.thirst, '#3ea6ff') + bar('Fun', pet.fun, '#2ecc71') + bar('Love', pet.love, '#ff6b8b') +
      '<div class="grid" style="margin-top:8px;grid-template-columns:repeat(auto-fill,minmax(105px,1fr))">' +
      '<button id="pFeed">🍖 Feed<br><small>' + EA.ITEMS[food].name + ' x' + EA.count(food) + '</small></button>' +
      '<button id="pWater">💧 Water</button><button id="pPlay">🎾 Play</button><button id="pPet">✋ Pet it</button><button id="pWalk">🚶 Walk</button><button id="pAcc">🎀 Style</button></div></div></div>' +
      (showAcc ? '<div class="msg"><b>Pet style</b><div class="row">' + (accIds.map(id => '<button data-acc="' + id + '">' + EA.ITEMS[id].icon + ' ' + EA.ITEMS[id].name + '</button>').join('') || 'Buy collars and bows at the Pet Shop!') + (pet.acc ? '<button data-acc="">🚫 Remove</button>' : '') + '</div></div>' : '') +
      '<p class="row"><button data-close>✔ Close</button></p>', () => cancelAnimationFrame(raf));
    const cv = $('pc'), c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    cancelAnimationFrame(raf);
    const loop = () => {
      if (!document.body.contains(cv)) return;
      const t = performance.now(); c.clearRect(0, 0, cv.width, cv.height);
      let off = 0; if (react && t - react.t0 < 1200) off = -Math.abs(Math.sin((t - react.t0) / 130)) * 10; else react = null;
      EA.drawPet(c, cv.width / 2, cv.height - 30 + off, pet.type, 'right', 0, pet.acc, EA.petHappiness() > 55 ? 'happy' : '', 7);
      if (react) {
        c.font = '26px sans-serif'; c.textAlign = 'center';
        const k = (t - react.t0) / 1200; c.globalAlpha = 1 - k; c.fillText(react.e, cv.width / 2 + 20, 70 - k * 40); c.globalAlpha = 1;
        c.font = 'bold 15px sans-serif'; c.fillStyle = '#2b2340'; c.fillText(react.say, cv.width / 2 - 40, 50);
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    const fx = (e) => { react = {e, t0: performance.now(), say: pet.type === 'dog' ? 'Woof!' : 'Meow!'}; EA.updateHUD(); setTimeout(() => { if ($('pc')) draw(); }, 80); };
    $('pFeed').onclick = () => { if (ui.feedPet(food)) fx('🍖'); };
    $('pWater').onclick = () => { if (pet.thirst >= 92) { EA.toast(pet.name + ' is not thirsty now!', ''); return; } pet.thirst = Math.min(100, pet.thirst + 40); EA.learn('water'); EA.learn('drink'); EA.addXP(2, true); EA.toast('💧 ' + pet.name + ' drinks the water.', 'good'); fx('💧'); };
    $('pPlay').onclick = () => { if (ui.playPet(toy)) fx('🎾'); };
    $('pPet').onclick = () => { pet.love = Math.min(100, pet.love + 15); EA.toast('❤ ' + pet.name + ' loves you!', 'good'); fx('❤'); };
    $('pWalk').onclick = () => { s.flags.walkGoal = true; EA.world.walkDist = 0; EA.learn('walk'); ui.close(); EA.toast('🚶 Walk around town with ' + pet.name + '!', 'good'); };
    $('pAcc').onclick = () => { showAcc = !showAcc; draw(); };
    p.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => { pet.acc = b.dataset.acc || null; draw(); });
  };
  draw();
};
})();
