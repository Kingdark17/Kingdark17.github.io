/* ===== WORLD: movement, collisions, NPCs, pet follow, camera, rendering, lighting, particles, interaction ===== */
(function(){
const T = EA.T;
const W = EA.world = {
  mapId: 'home', map: null, player: {x: 256, y: 288, dir: 'down', anim: 0, moving: false},
  npcs: [], npcCache: {}, pet: {x: 0, y: 0, dir: 'right', anim: 0, moving: false}, trail: [],
  huntItems: [], target: null, cam: {x: 0, y: 0, snap: true}, time: 0, transition: false, walkDist: 0,
  parts: [], dustT: 0, clock: 0.18, critters: null
};
const PW = 12, PH = 8;
const rectOf = (x, y) => ({x: x - PW / 2, y: y - PH, w: PW, h: PH});
const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const DAY_LEN = 420; // seconds for a full day

/* ---------- map handling ---------- */
W.setMap = function(id, x, y, dir){
  W.mapId = id; W.map = EA.MAPS[id];
  const p = W.player; p.x = x; p.y = y; if (dir) p.dir = dir; p.anim = 0;
  if (!W.npcCache[id]) {
    W.npcCache[id] = W.map.npcs.map(n => ({id: n.id, x: n.tx * T + 16, y: n.ty * T + 28, hx: n.tx * T + 16, hy: n.ty * T + 28, dir: 'down', anim: 0, wander: n.wander, t: EA.rand(0.5, 3), vx: 0, vy: 0, who: EA.npcWho(n.id), talking: false}));
  }
  W.npcs = W.npcCache[id];
  W.trail = []; W.pet.x = x - 20; W.pet.y = y; W.parts = [];
  W.huntItems = (W.hunt && W.hunt.mapId === id) ? W.hunt.items : [];
  W.walkDist = W.walkDist || 0;
  W.cam.snap = true;
};
function fade(cb){
  const f = EA.$('fade'); W.transition = true; f.classList.add('on');
  setTimeout(() => { cb(); setTimeout(() => { f.classList.remove('on'); W.transition = false; }, 120); }, 260);
}
W.enter = function(place){
  const m = EA.MAPS[place];
  fade(() => {
    W.setMap(place, m.W / 2, m.H - 2 * T + 8, 'up');
    EA.discover(place);
    EA.toast(m.name, '');
    EA.save(true);
  });
};
W.exit = function(){
  const place = W.map.exitTo, town = EA.MAPS.town, sp = town.spawnAt[place];
  fade(() => { W.setMap('town', sp.x, sp.y, 'down'); EA.save(true); });
};

/* ---------- collisions ---------- */
W.blocked = function(r, ignore){
  const m = W.map;
  if (r.x < 2 || r.y < 2 || r.x + r.w > m.W - 2 || r.y + r.h > m.H - 2) return true;
  for (const s of m.solids) if (hit(r, s)) return true;
  for (const n of W.npcs) { if (n === ignore) continue; if (hit(r, rectOf(n.x, n.y))) return true; }
  if (ignore && ignore !== W.player && hit(r, rectOf(W.player.x, W.player.y))) return true;
  return false;
};
W.free = (x, y) => !W.blocked(rectOf(x, y), W.player);

/* ---------- particles ---------- */
W.emit = function(x, y, kind, n){
  for (let i = 0; i < (n || 1); i++) {
    const a = Math.random() * Math.PI * 2, sp = kind === 'dust' ? EA.rand(6, 16) : EA.rand(20, 60);
    W.parts.push({x, y, kind, vx: Math.cos(a) * sp, vy: kind === 'dust' ? -EA.rand(4, 12) : Math.sin(a) * sp - 30, life: kind === 'dust' ? 0.45 : EA.rand(0.7, 1.1), age: 0,
      col: kind === 'sparkle' ? EA.pick(['#ffe066', '#fff6c8', '#ffd23a', '#ffffff']) : kind === 'heart' ? '#ff6b8b' : kind === 'confetti' ? EA.pick(['#ff6b8b', '#3ea6ff', '#ffd23a', '#2ecc71', '#b46bff']) : '#d9ccb0'});
  }
  if (W.parts.length > 260) W.parts.splice(0, W.parts.length - 260);
};
W.burst = function(kind){ const p = W.player; W.emit(p.x, p.y - 24, kind || 'sparkle', kind === 'confetti' ? 40 : 18); };

/* ---------- day & night ---------- */
W.night = function(){
  if (!EA.settings.dayNight || !W.map || W.map.interior) return 0;
  const p = W.clock % 1; // 0 = morning, .25 noon, .5 evening, .75 midnight
  const n = Math.max(0, -Math.cos((p - 0.25) * Math.PI * 2));
  return Math.min(1, n * 1.25);
};
W.timeLabel = function(){
  const p = W.clock % 1;
  if (p < 0.08 || p > 0.92) return '🌅 Morning';
  if (p < 0.40) return '☀️ Day';
  if (p < 0.55) return '🌇 Evening';
  return '🌙 Night';
};

/* ---------- ambient critters ---------- */
function initCritters(){
  const arr = [];
  const areas = [[4 * T, 34 * T, 56 * T, 10 * T], [2 * T, 1 * T, 25 * T, 8 * T], [36 * T, 1 * T, 25 * T, 8 * T]];
  for (let i = 0; i < 14; i++) {
    const a = areas[i % 3];
    arr.push({x: a[0] + Math.random() * a[2], y: a[1] + Math.random() * a[3], hx: 0, hy: 0, ph: Math.random() * 10, col: EA.pick(['#ffffff', '#ffd93d', '#ff8fc7', '#8fd3ff', '#ffb35a']), sp: EA.rand(0.6, 1.3)});
    arr[i].hx = arr[i].x; arr[i].hy = arr[i].y;
  }
  return arr;
}

/* ---------- update ---------- */
W.update = function(dt, frozen){
  W.time += dt * 1000;
  if (!frozen) W.clock += dt / DAY_LEN;
  const p = W.player;
  p.moving = false;
  if (!frozen && !W.transition) {
    EA.updateInput();
    let dx = EA.input.dx, dy = EA.input.dy;
    if (dx || dy) {
      const len = Math.hypot(dx, dy); dx /= len; dy /= len;
      const run = EA.keys.ShiftLeft || EA.keys.ShiftRight;
      const sp = (run ? 165 : 115) * dt;
      let nx = p.x + dx * sp, ny = p.y + dy * sp;
      if (!W.blocked(rectOf(nx, p.y), p)) p.x = nx;
      if (!W.blocked(rectOf(p.x, ny), p)) p.y = ny;
      if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 'right' : 'left'; else p.dir = dy > 0 ? 'down' : 'up';
      p.moving = true; p.anim += dt * (run ? 12 : 9);
      W.dustT -= dt; if (W.dustT <= 0) { W.dustT = run ? 0.1 : 0.2; W.emit(p.x + EA.rand(-4, 4), p.y - 1, 'dust', 1); }
      const last = W.trail[W.trail.length - 1];
      if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 7) { W.trail.push({x: p.x, y: p.y}); if (W.trail.length > 14) W.trail.shift(); if (W.map.id === 'town') W.walkDist += 7; }
    }
  }
  // NPC wandering
  W.npcs.forEach(n => {
    n.moving = false;
    if (n.talking || frozen || !n.wander) return;
    n.t -= dt;
    if (n.t <= 0) { n.t = EA.rand(1, 3.5); if (Math.random() < 0.55) { const a = Math.floor(Math.random() * 4); n.vx = [1, -1, 0, 0][a]; n.vy = [0, 0, 1, -1][a]; } else { n.vx = n.vy = 0; } }
    if (n.vx || n.vy) {
      const nx = n.x + n.vx * 28 * dt, ny = n.y + n.vy * 28 * dt;
      if (Math.abs(nx - n.hx) < 70 && Math.abs(ny - n.hy) < 50 && !W.blocked(rectOf(nx, ny), n)) { n.x = nx; n.y = ny; n.moving = true; n.anim += dt * 6; }
      else { n.vx = n.vy = 0; }
      n.dir = n.vx > 0 ? 'right' : n.vx < 0 ? 'left' : n.vy > 0 ? 'down' : 'up';
    }
  });
  // pet follows the player's trail
  const pet = EA.state.pet;
  if (pet) {
    const pt = W.pet;
    const tgt = W.trail.length > 5 ? W.trail[W.trail.length - 6] : {x: p.x - 22, y: p.y + 2};
    const dx = tgt.x - pt.x, dy = tgt.y - pt.y, d = Math.hypot(dx, dy);
    pt.moving = false;
    if (d > 20) { const sp = Math.min(150 * dt, d); pt.x += dx / d * sp; pt.y += dy / d * sp; pt.moving = true; pt.anim += dt * 11; if (Math.abs(dx) > 2) pt.dir = dx > 0 ? 'right' : 'left'; }
    if (d > 260) { pt.x = p.x - 20; pt.y = p.y; }
  }
  // particles
  for (const q of W.parts) { q.age += dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.kind !== 'dust') q.vy += 80 * dt; }
  W.parts = W.parts.filter(q => q.age < q.life);
  // critters
  if (W.map.id === 'town') {
    if (!W.critters) W.critters = initCritters();
    const t = W.time / 1000;
    W.critters.forEach(b => { b.x = b.hx + Math.sin(t * 0.5 * b.sp + b.ph) * 46 + Math.sin(t * 1.7 * b.sp + b.ph * 2) * 10; b.y = b.hy + Math.cos(t * 0.4 * b.sp + b.ph) * 26 + Math.sin(t * 2.1 + b.ph) * 6; });
  }
  // zones, quests, walks
  if (W.map.id === 'town') {
    for (const z of W.map.zones) if (p.x > z.x && p.x < z.x + z.w && p.y > z.y && p.y < z.y + z.h) {
      EA.discover(z.place);
      if (z.place === 'park' && pet) EA.emit('petpark');
    }
    if (EA.state.flags.walkGoal && W.walkDist > 700 && pet) {
      EA.state.flags.walkGoal = false; W.walkDist = 0;
      pet.fun = Math.min(100, pet.fun + 30); pet.love = Math.min(100, pet.love + 10);
      EA.toast('🐾 Great walk! ' + pet.name + ' is happy!', 'good'); EA.addXP(8); EA.learn('walk'); EA.emit('walk');
      W.emit(W.pet.x, W.pet.y - 20, 'heart', 6);
    }
  }
  // interaction candidate
  W.nearby = (frozen || W.transition) ? null : findNearby();
  const pr = EA.$('prompt');
  if (W.nearby) { pr.textContent = W.nearby.text; pr.classList.remove('hidden'); } else pr.classList.add('hidden');
  // clock label
  const tl = EA.$('hudTime');
  if (tl) { const lab = W.map.interior ? '' : (EA.settings.dayNight ? W.timeLabel() : ''); if (tl.textContent !== lab) tl.textContent = lab; }
};

function findNearby(){
  const p = W.player, m = W.map; let best = null, bd = 1e9;
  const consider = (d, o) => { if (d < bd) { bd = d; best = o; } };
  W.npcs.forEach(n => { const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < 46) consider(d, {type: 'npc', npc: n, text: 'PRESS E TO TALK', ax: n.x, ay: n.y - 62}); });
  m.doors.forEach(dr => {
    const cx = dr.x + dr.w / 2, cy = dr.y + dr.h / 2;
    if (Math.abs(p.x - cx) < dr.w / 2 + 6 && Math.abs(p.y - cy) < dr.h / 2 + 18) consider(Math.hypot(p.x - cx, p.y - cy) + 4, {type: 'door', door: dr, text: 'PRESS E TO ENTER', ax: cx, ay: dr.y - 56});
  });
  if (m.exit) { const e = m.exit; if (p.x > e.x - 10 && p.x < e.x + e.w + 10 && p.y > e.y - 10) consider(10, {type: 'exit', text: 'PRESS E TO EXIT', ax: e.x + e.w / 2, ay: m.H - 22}); }
  m.objs.forEach(o => {
    if (!o.act) return;
    const b = o.box; const px = EA.clamp(p.x, b.x, b.x + b.w), py = EA.clamp(p.y, b.y, b.y + b.h);
    const d = Math.hypot(p.x - px, p.y - py);
    const tall = {wardrobe: 30, mirror: 36, shelf: 34, fridge: 36, goods: 40, board: 40, rack: 24, cage: 22, bed: 4, sign: 30, fountain: 24}[o.k] || 8;
    if (d < 20) consider(d + 2, {type: 'act', obj: o, text: 'PRESS E TO INTERACT' + (o.act.label ? ' (' + o.act.label + ')' : ''), ax: b.x + b.w / 2, ay: b.y - tall});
  });
  W.huntItems.forEach(h => { const d = Math.hypot(h.box.x + h.box.w / 2 - p.x, h.box.y + h.box.h - p.y); if (d < 30 && !h.taken) consider(d, {type: 'hunt', item: h, text: 'PRESS E TO INTERACT', ax: h.box.x + h.box.w / 2, ay: h.box.y - 10}); });
  return best;
}

W.interact = function(){
  const n = W.nearby; if (!n || W.transition) return;
  if (n.type === 'npc') {
    const p = W.player, dx = p.x - n.npc.x, dy = p.y - n.npc.y;
    n.npc.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    EA.ui.talk(n.npc);
  } else if (n.type === 'door') {
    const req = EA.PLACES[n.door.to].reqLevel, lv = EA.LEVELS.find(l => l.lv === req);
    if (EA.state.level < req) { EA.beep('bad'); EA.toast('🔒 Locked! Reach Level ' + req + ' (' + lv.name + ') to enter.', 'bad'); return; }
    W.enter(n.door.to);
  } else if (n.type === 'exit') W.exit();
  else if (n.type === 'act') EA.ui.act(n.obj.act, n.obj);
  else if (n.type === 'hunt') { W.emit(n.item.box.x + 12, n.item.box.y + 6, 'sparkle', 12); EA.minigames.huntPick(n.item); }
};

/* ---------- rendering ---------- */
W.render = function(ctx, cw, ch){
  const m = W.map, p = W.player, t = W.time;
  const s = Math.max(1, Math.floor(Math.min(cw / (20 * T), ch / (11 * T))));
  const vw = cw / s, vh = ch / s;
  let tx = p.x - vw / 2, ty = p.y - vh / 2 - 16;
  tx = m.W <= vw ? (m.W - vw) / 2 : EA.clamp(tx, 0, m.W - vw);
  ty = m.H <= vh ? (m.H - vh) / 2 : EA.clamp(ty, 0, m.H - vh);
  const cam = W.cam;
  if (cam.snap) { cam.x = tx; cam.y = ty; cam.snap = false; }
  else { cam.x += (tx - cam.x) * 0.14; cam.y += (ty - cam.y) * 0.14; }
  const cx = Math.round(cam.x * s) / s, cy = Math.round(cam.y * s) / s;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#14122a'; ctx.fillRect(0, 0, cw, ch);
  ctx.setTransform(s, 0, 0, s, -cx * s, -cy * s);
  ctx.imageSmoothingEnabled = false;
  drawWorld(ctx, m, cx, cy, vw, vh, t, true);
  // lighting & screen effects
  const n = W.night();
  if (!m.interior) drawCloudShadows(ctx, cx, cy, vw, vh, t, n);
  if (n > 0.01) drawNight(ctx, m, cx, cy, vw, vh, n, t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.35, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,5,30,' + (m.interior ? 0.32 : 0.22) + ')');
  ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
};

function drawWorld(ctx, m, cx, cy, vw, vh, t, withEntities){
  const x0 = Math.max(0, Math.floor(cx / T)), y0 = Math.max(0, Math.floor(cy / T));
  const x1 = Math.min(m.w - 1, Math.floor((cx + vw) / T)), y1 = Math.min(m.h - 1, Math.floor((cy + vh) / T));
  const R = EA.R, G = m.ground;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (m.interior && y < 3) continue;
    ctx.drawImage(EA.tile(G[y][x], x, y, t), x * T, y * T);
  }
  // soft edges between ground types (grass lips, curbs)
  if (!m.interior) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const g = G[y][x], gr = g === 0 || g === 8;
    const below = y + 1 < m.h ? G[y + 1][x] : g, above = y > 0 ? G[y - 1][x] : g;
    if (gr && below !== 0 && below !== 8) { R(ctx, '#4f9a37', x * T, y * T + 30, T, 2); R(ctx, '#5aa83d', x * T, y * T + 29, T, 1); }
    if (gr && above !== 0 && above !== 8) R(ctx, 'rgba(255,255,255,.12)', x * T, y * T, T, 1);
    if (g === 1 && above === 2) { R(ctx, '#9e968a', x * T, y * T, T, 3); R(ctx, '#47494f', x * T, y * T + 3, T, 2); }
    if (g === 1 && below === 2) { R(ctx, '#b8b0a2', x * T, y * T + 30, T, 2); }
    if (g === 3 && above !== 3) { R(ctx, '#8a8f9c', x * T, y * T, T, 3); R(ctx, '#2f7fbf', x * T, y * T + 3, T, 3); }
  }
  if (m.interior) drawInteriorShell(ctx, m);
  m.objs.forEach(o => { if (o.flat && vis(o.box, cx, cy, vw, vh)) EA.drawObject(ctx, o, t); });
  const lockOf = o => { if (o.k === 'building') o.locked = o.place ? EA.state.level < EA.PLACES[o.place].reqLevel : false; };
  if (!withEntities) { m.objs.forEach(o => { if (!o.flat && vis(o.box, cx, cy, vw, vh, 80)) { lockOf(o); EA.drawObject(ctx, o, t); } }); return; }
  const list = [];
  m.objs.forEach(o => { if (!o.flat && vis(o.box, cx, cy, vw, vh, 80)) list.push({y: o.box.y + o.box.h, f: () => { lockOf(o); EA.drawObject(ctx, o, t); }}); });
  // dust under feet
  W.parts.forEach(q => { if (q.kind === 'dust') { const a = 1 - q.age / q.life; ctx.fillStyle = 'rgba(217,204,176,' + (0.7 * a) + ')'; const s = 2 + (q.age / q.life) * 3; ctx.fillRect(Math.round(q.x - s / 2), Math.round(q.y - s / 2), Math.round(s), Math.round(s)); } });
  W.npcs.forEach(n => list.push({y: n.y, f: () => {
    EA.drawCharacter(ctx, n.x, n.y, n.who, n.dir, n.moving ? n.anim + 1 : 0, 2);
    const d = Math.hypot(n.x - W.player.x, n.y - W.player.y);
    if (!EA.state.flags['talked_' + n.id]) bubble(ctx, n.x + 14, n.y - 60 + Math.sin(t / 220) * 2, '!');
    else if (d < 80 && !n.talking) bubble(ctx, n.x + 14, n.y - 60, '…');
    if (n.talking && EA.speakingWho === n.id) soundWaves(ctx, n.x, n.y - 40, t);
    if (d < 90) nameTag(ctx, EA.NPCS[n.id].name, n.x, n.y - 56);
  }}));
  W.huntItems.forEach(h => { if (!h.taken) list.push({y: h.box.y + h.box.h, f: () => EA.drawObject(ctx, h, t)}); });
  const st = EA.state;
  if (st.pet) list.push({y: W.pet.y, f: () => EA.drawPet(ctx, W.pet.x, W.pet.y, st.pet.type, W.pet.dir, W.pet.moving ? W.pet.anim + 1 : 0, st.pet.acc, EA.petHappiness() > 60 ? 'happy' : '', 2)});
  list.push({y: W.player.y, f: () => { EA.drawCharacter(ctx, W.player.x, W.player.y, EA.charOf(), W.player.dir, W.player.moving ? W.player.anim + 1 : 0, 2); nameTag(ctx, st.name, W.player.x, W.player.y - 56, true); }});
  list.sort((a, b) => a.y - b.y).forEach(i => i.f());
  // butterflies (day)
  if (m.id === 'town' && W.critters && W.night() < 0.5) W.critters.forEach(b => {
    if (!vis({x: b.x, y: b.y, w: 4, h: 4}, cx, cy, vw, vh)) return;
    const flap = Math.floor(t / 110 + b.ph * 10) % 2;
    ctx.fillStyle = b.col; ctx.fillRect(Math.round(b.x) - (flap ? 3 : 2), Math.round(b.y), flap ? 3 : 2, 3); ctx.fillRect(Math.round(b.x) + 1, Math.round(b.y), flap ? 3 : 2, 3);
    ctx.fillStyle = '#2b2340'; ctx.fillRect(Math.round(b.x), Math.round(b.y), 1, 3);
  });
  // other particles
  W.parts.forEach(q => {
    if (q.kind === 'dust') return;
    const a = 1 - q.age / q.life; ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = q.col;
    if (q.kind === 'heart') { const x = Math.round(q.x), y = Math.round(q.y); ctx.fillRect(x - 2, y - 1, 2, 2); ctx.fillRect(x + 1, y - 1, 2, 2); ctx.fillRect(x - 2, y, 5, 2); ctx.fillRect(x - 1, y + 2, 3, 1); ctx.fillRect(x, y + 3, 1, 1); }
    else if (q.kind === 'sparkle') { const x = Math.round(q.x), y = Math.round(q.y); ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5); }
    else ctx.fillRect(Math.round(q.x), Math.round(q.y), 3, 2);
    ctx.globalAlpha = 1;
  });
  // door arrows in town
  if (m.id === 'town') m.doors.forEach(d => arrow(ctx, d.x + d.w / 2, d.y + 44 + Math.sin(t / 220) * 2, true, '#ffd23a'));
  // interaction indicator
  if (W.nearby && W.nearby.ax !== undefined && W.nearby.type !== 'door') arrow(ctx, W.nearby.ax, W.nearby.ay + Math.sin(t / 160) * 3, false, '#ffffff');
}
function arrow(ctx, x, y, up, col){
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = '#2b2340';
  for (let r = 0; r < 6; r++) { const w = up ? r * 2 + 3 : 13 - r * 2; ctx.fillRect(x - Math.floor(w / 2) - 1, y + r - 1, w + 2, 3); }
  ctx.fillStyle = col;
  for (let r = 0; r < 5; r++) { const w = up ? r * 2 + 1 : 11 - r * 2 - 2; ctx.fillRect(x - Math.floor(w / 2), y + r, Math.max(1, w), 1); }
}
function bubble(ctx, x, y, ch){
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = '#2b2340'; ctx.fillRect(x - 7, y - 9, 14, 13); ctx.fillRect(x - 6, y + 3, 4, 3);
  ctx.fillStyle = ch === '!' ? '#ffd23a' : '#ffffff'; ctx.fillRect(x - 6, y - 8, 12, 11); ctx.fillRect(x - 5, y + 3, 2, 2);
  ctx.fillStyle = '#2b2340'; ctx.font = '700 10px Fredoka, "Trebuchet MS", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(ch, x, y + 1);
}
function soundWaves(ctx, x, y, t){
  const k = Math.floor(t / 140) % 3;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i <= k; i++) { const r = 4 + i * 4, xx = Math.round(x + 12 + i * 3); ctx.fillRect(xx, Math.round(y - r / 2), 2, r); }
  for (let i = 0; i <= k; i++) { const r = 4 + i * 4, xx = Math.round(x - 14 - i * 3); ctx.fillRect(xx, Math.round(y - r / 2), 2, r); }
}
function nameTag(ctx, text, x, y, me){
  ctx.font = '600 9px Fredoka, "Trebuchet MS", sans-serif'; ctx.textAlign = 'center';
  const w = Math.round(ctx.measureText(text).width + 10);
  const lx = Math.round(x - w / 2), ly = Math.round(y - 10);
  ctx.fillStyle = 'rgba(30,22,52,.82)'; ctx.fillRect(lx + 1, ly, w - 2, 13); ctx.fillRect(lx, ly + 1, w, 11);
  ctx.fillStyle = me ? '#9fe3ff' : '#ffffff'; ctx.fillText(text, x, y);
}
function vis(b, cx, cy, vw, vh, pad){ pad = pad || 0; return b.x + b.w > cx - pad && b.x < cx + vw + pad && b.y + b.h > cy - pad - 40 && b.y < cy + vh + pad + 40; }

function drawCloudShadows(ctx, cx, cy, vw, vh, t, n){
  const a = 0.07 * (1 - n);
  if (a <= 0.005) return;
  ctx.fillStyle = 'rgba(20,20,60,' + a + ')';
  const span = 2600;
  for (let i = 0; i < 4; i++) {
    const x = ((t / 1000) * 9 + i * 650) % span - 300, y = 160 + i * 340;
    if (x + 300 < cx || x - 300 > cx + vw || y + 120 < cy || y - 120 > cy + vh) continue;
    ctx.beginPath(); ctx.ellipse(x, y, 170, 60, 0, 0, Math.PI * 2); ctx.ellipse(x + 110, y - 30, 120, 50, 0, 0, Math.PI * 2); ctx.ellipse(x - 120, y + 20, 110, 45, 0, 0, Math.PI * 2); ctx.fill();
  }
}
function drawNight(ctx, m, cx, cy, vw, vh, n, t){
  const warm = Math.max(0, 1 - Math.abs(n - 0.35) * 3.2); // orange at dusk
  ctx.fillStyle = 'rgba(255,130,60,' + (0.16 * warm) + ')'; ctx.fillRect(cx, cy, vw, vh);
  ctx.fillStyle = 'rgba(18,24,78,' + (0.5 * n) + ')'; ctx.fillRect(cx, cy, vw, vh);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const glow = (x, y, r, col, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + col + ',' + a + ')'); g.addColorStop(1, 'rgba(' + col + ',0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
  m.objs.forEach(o => {
    if (!vis(o.box, cx, cy, vw, vh, 120)) return;
    if (o.k === 'lamp') { const lx = o.box.x + o.box.w / 2, ly = o.box.y - 40; glow(lx, ly + 40, 70, '255,200,110', 0.32 * n); glow(lx, ly, 18, '255,240,180', 0.75 * n); }
    if (o.k === 'building' && o._wins) o._wins.forEach(w => { ctx.fillStyle = 'rgba(255,200,90,' + (0.42 * n) + ')'; ctx.fillRect(w.x, w.y, w.w, w.h); glow(w.x + w.w / 2, w.y + w.h, 34, '255,190,90', 0.14 * n); });
  });
  glow(W.player.x, W.player.y - 18, 60, '255,230,170', 0.12 * n);
  if (W.critters && n > 0.5) W.critters.forEach((b, i) => { const fx = b.x + Math.sin(t / 700 + i) * 20, fy = b.y + Math.cos(t / 900 + i) * 12, a = (0.5 + 0.5 * Math.sin(t / 300 + i * 2)) * (n - 0.5) * 2; glow(fx, fy, 8, '200,255,120', 0.8 * a); ctx.fillStyle = 'rgba(240,255,170,' + a + ')'; ctx.fillRect(Math.round(fx), Math.round(fy), 2, 2); });
  ctx.restore();
}

function drawInteriorShell(ctx, m){
  const R = EA.R, wc = m.wallColor || '#f5d6a6';
  R(ctx, wc, 0, 0, m.W, 3 * T);
  for (let x = 0; x < m.W; x += 16) R(ctx, EA.shade(wc, x % 32 ? -6 : -12), x, 0, x % 32 ? 1 : 2, 3 * T - 10);
  for (let x = 8; x < m.W; x += 32) for (let y = 12; y < 3 * T - 20; y += 22) R(ctx, EA.shade(wc, 12), x, y, 3, 3);
  R(ctx, EA.shade(wc, -40), 0, 3 * T - 12, m.W, 12); R(ctx, EA.shade(wc, -22), 0, 3 * T - 12, m.W, 3); R(ctx, EA.shade(wc, 18), 0, 3 * T - 14, m.W, 2);
  R(ctx, 'rgba(20,10,40,.12)', 0, 3 * T, m.W, 8);
  R(ctx, '#3a2a1a', 0, 0, m.W, 4);
  R(ctx, '#3a2a1a', 0, 3 * T, 4, m.H - 3 * T); R(ctx, '#3a2a1a', m.W - 4, 3 * T, 4, m.H - 3 * T); R(ctx, '#3a2a1a', 0, m.H - 4, m.W, 4);
  (m.window || []).forEach(([x, y]) => EA.draw.window(ctx, {box: {x: x * T, y: y * T - 4, w: 52, h: 44}}));
  const e = m.exit; R(ctx, '#2b2140', e.x + 2, m.H - 14, e.w - 4, 14); R(ctx, '#5e3a1e', e.x + 4, m.H - 12, e.w - 8, 12); R(ctx, '#d65a5a', e.x + 8, m.H - 10, e.w - 16, 6); R(ctx, '#f7d44c', e.x + 10, m.H - 8, e.w - 20, 2);
  ctx.font = '700 8px Fredoka, "Trebuchet MS", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.fillText('EXIT', e.x + e.w / 2, m.H - 16);
}

/* ---------- title screen backdrop ---------- */
W.renderBackdrop = function(ctx, cw, ch, camX, camY, s){
  const m = EA.MAPS.town, t = performance.now();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#7bc95a'; ctx.fillRect(0, 0, cw, ch);
  ctx.setTransform(s, 0, 0, s, -camX * s, -camY * s); ctx.imageSmoothingEnabled = false;
  drawWorld(ctx, m, camX, camY, cw / s, ch / s, t, false);
  // drifting pixel clouds
  ctx.setTransform(s, 0, 0, s, 0, 0);
  const vw = cw / s;
  for (let i = 0; i < 5; i++) {
    const x = ((t / 1000) * (6 + i * 2) + i * 260) % (vw + 200) - 100, y = 30 + i * 70 % 260;
    ctx.fillStyle = 'rgba(20,20,60,.08)'; cloud(ctx, x + 18, y + 60);
    ctx.fillStyle = 'rgba(255,255,255,.92)'; cloud(ctx, x, y);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
};
function cloud(ctx, x, y){ x = Math.round(x); y = Math.round(y); ctx.fillRect(x, y + 8, 64, 12); ctx.fillRect(x + 8, y + 2, 26, 8); ctx.fillRect(x + 28, y - 4, 22, 12); ctx.fillRect(x + 4, y + 18, 54, 4); }

W.drawMini = function(ctx, who, x, y, dir, u){ EA.drawCharacter(ctx, x, y, who, dir || 'down', 0, u || 2); };

/* ---------- hunt helpers (used by minigames) ---------- */
W.setHuntItems = function(mapId, items){ W.hunt = items ? {mapId, items} : null; W.huntItems = (items && W.mapId === mapId) ? items : []; };
})();
