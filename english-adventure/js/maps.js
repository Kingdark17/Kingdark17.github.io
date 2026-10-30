/* ===== MAPS: ENGLISH TOWN and all interiors (pure data builders) ===== */
(function(){
const T = 32;
EA.MAPS = {};

function newMap(id, w, h, opts){
  const m = Object.assign({id, w, h, W: w * T, H: h * T, ground: [], objs: [], solids: [], doors: [], npcs: [], zones: [], interior: false}, opts || {});
  for (let y = 0; y < h; y++) m.ground.push(new Array(w).fill(m.base || 0));
  m.fill = (type, x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m.ground[y] && m.ground[y][x] !== undefined) m.ground[y][x] = type; };
  m.solid = (x, y, w2, h2) => { m.solids.push({x, y, w: w2, h: h2}); };
  // generic object. tile coords; opts may override box (px)
  m.obj = (k, tx, ty, tw, th, o) => {
    o = o || {};
    const box = o.box || {x: tx * T, y: ty * T, w: tw * T, h: th * T};
    const ob = Object.assign({k, box}, o);
    ob.box = box;
    if (ob.solid === undefined) ob.solid = true;
    if (ob.solid) m.solid(box.x, box.y, box.w, box.h);
    m.objs.push(ob);
    return ob;
  };
  m.tree = (tx, ty, o) => { const cx = tx * T + 16, by = ty * T + 32; return m.obj((o && o.pine) ? 'pine' : 'tree', 0, 0, 0, 0, Object.assign({box: {x: cx - 9, y: by - 10, w: 18, h: 10}}, o)); };
  m.flowers = (tx, ty, tw, th, o) => m.obj('flowers', tx, ty, tw, th, Object.assign({solid: false, flat: true}, o));
  m.door = d => { m.doors.push(d); return d; };
  m.npc = (id, tx, ty, wander) => m.npcs.push({id, tx, ty, wander: !!wander});
  return m;
}
const rng = (seed) => { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; };

/* ================= TOWN ================= */
function buildTown(){
  const m = newMap('town', 64, 46, {name: 'English Town', base: 0});
  const r = rng(7);
  // patches of dark grass
  for (let i = 0; i < 40; i++) { const x = Math.floor(r() * 62), y = Math.floor(r() * 44); m.fill(8, x, y, x + 1 + Math.floor(r() * 2), y + Math.floor(r() * 2)); }
  // sidewalks then roads
  m.fill(2, 0, 18, 63, 18); m.fill(2, 0, 22, 63, 22); m.fill(2, 0, 30, 63, 30); m.fill(2, 0, 33, 63, 33);
  m.fill(2, 29, 0, 29, 33); m.fill(2, 33, 0, 33, 33);
  m.fill(1, 0, 19, 63, 21); m.fill(1, 0, 31, 63, 32); m.fill(1, 30, 0, 32, 33);
  // road lines (flat)
  const hl = (y) => { m.obj('roadline', 0, 0, 0, 0, {box: {x: 0, y, w: 30 * T, h: 3}, solid: false, flat: true}); m.obj('roadline', 0, 0, 0, 0, {box: {x: 33 * T, y, w: 31 * T, h: 3}, solid: false, flat: true}); };
  hl(20 * T + 14); hl(32 * T - 2);
  m.obj('roadlineV', 0, 0, 0, 0, {box: {x: 31 * T + 14, y: 0, w: 3, h: 19 * T}, solid: false, flat: true});
  m.obj('roadlineV', 0, 0, 0, 0, {box: {x: 31 * T + 14, y: 22 * T, w: 3, h: 9 * T}, solid: false, flat: true});

  // ----- buildings (north row, rows 12-17) -----
  const bh = 6 * T;
  const home = m.obj('building', 6, 12, 8, 6, {style: {wall: '#ffd9a8', roof: '#d9553f', kind: 'house', signText: 'HOME', sign: '#fff6d6', glass: '#bfe6ff'}, place: 'home'});
  const school = m.obj('building', 15, 10, 13, 8, {style: {wall: '#f2e2a0', roof: '#3b6fb8', signText: 'SCHOOL', icon: '📚', sign: '#fff6d6'}, place: 'school'});
  const market = m.obj('building', 36, 12, 10, 6, {style: {wall: '#bde8c0', roof: '#2e9d57', signText: 'SUPERMARKET', icon: '🛒', awning: '#e74c3c', sign: '#fff6d6'}, place: 'supermarket'});
  const resto = m.obj('building', 48, 11, 11, 7, {style: {wall: '#ffc9c9', roof: '#b3342f', signText: 'RESTAURANT', icon: '🍽️', awning: '#fff', sign: '#fff6d6'}, place: 'restaurant'});
  // south row (rows 24-29)
  const clothes = m.obj('building', 4, 24, 9, 6, {style: {wall: '#d9c5f2', roof: '#7a4bb8', signText: 'CLOTHES SHOP', icon: '👗', awning: '#ff8fc7', sign: '#fff6d6'}, place: 'clothes'});
  const pets = m.obj('building', 16, 24, 11, 6, {style: {wall: '#cfeaff', roof: '#e08a2b', signText: 'PET SHOP', icon: '🐾', awning: '#f7d44c', sign: '#fff6d6'}, place: 'petshop'});
  // decorative cottages
  m.obj('building', 1, 13, 4, 5, {style: {wall: '#bfe0ff', roof: '#c0392b', kind: 'house', glass: '#ffe9a8'}, place: null});
  m.obj('building', 36, 24, 8, 6, {style: {wall: '#ffe4a8', roof: '#8e5a3a', kind: 'house', signText: 'HOUSE', glass: '#bfe6ff'}, place: null});
  m.obj('building', 47, 24, 9, 6, {style: {wall: '#c9f0d9', roof: '#3a8f6a', kind: 'house', signText: 'HOUSE', glass: '#bfe6ff'}, place: null});
  [[home, 'home', 'home', 8.5, 11 * T + 16], [school, 'school', 'school', 13, 0], [market, 'supermarket', 'supermarket', 10, 0], [resto, 'restaurant', 'restaurant', 11, 0],
   [clothes, 'clothes', 'clothes', 9, 0], [pets, 'petshop', 'petshop', 11, 0]].forEach(([b, place]) => {
    const bx = b.box.x + b.box.w / 2, by = b.box.y + b.box.h;
    b.doorX = bx;
    m.door({x: bx - 28, y: by - 6, w: 56, h: 28, place, to: place, label: EA.PLACES[place].name});
    m.zones.push({place, x: bx - 100, y: by - 4, w: 200, h: 70});
  });
  [8].forEach(() => {});
  m.objs.filter(o => o.k === 'building').forEach(o => { if (!o.doorX) o.doorX = o.box.x + o.box.w / 2; });
  // ----- street details -----
  [3, 14, 28, 34, 46, 59].forEach(x => m.obj('lamp', 0, 0, 0, 0, {box: {x: x * T + 10, y: 18 * T + 22, w: 12, h: 8}}));
  [3, 12, 20, 28, 34, 42, 52, 60].forEach(x => m.obj('lamp', 0, 0, 0, 0, {box: {x: x * T + 10, y: 22 * T + 22, w: 12, h: 8}}));
  m.obj('mailbox', 0, 0, 0, 0, {box: {x: 13 * T + 4, y: 18 * T + 6, w: 24, h: 16}});
  m.obj('hydrant', 0, 0, 0, 0, {box: {x: 25 * T + 6, y: 30 * T + 8, w: 18, h: 16}});
  m.obj('sign', 0, 0, 0, 0, {box: {x: 28 * T + 8, y: 11 * T, w: 16, h: 12}, text: 'TOWN', solid: true});
  // trees around the buildings (small gardens)
  [[5, 11], [14, 11], [29, 10], [34, 11], [46, 11], [60, 11], [3, 23], [14, 23], [28, 24], [34, 23], [45, 23], [58, 23], [61, 24], [2, 29]].forEach(([x, y]) => m.tree(x, y, {fruit: x % 2 === 0}));
  [[6, 18], [13, 12], [26, 29], [35, 29], [46, 29], [57, 29], [45, 17]].forEach(([x, y]) => m.obj('bush', x, y, 1, 1, {box: {x: x * T + 2, y: y * T + 6, w: 28, h: 24}, berry: x % 2 === 1}));
  m.flowers(6, 17, 1, 1, {n: 4}); m.flowers(13, 17, 1, 1, {n: 4}); m.flowers(35, 17, 1, 1, {n: 4}); m.flowers(46, 17, 1, 1, {n: 4}); m.flowers(35, 29, 1, 1, {n: 4}); m.flowers(46, 29, 1, 1, {n: 4});
  // ----- northern meadow & border forest -----
  const rr = rng(21);
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rr() * 62), y = Math.floor(rr() * 9) + 1;
    if (x >= 27 && x <= 35) continue;
    if (x >= 14 && x <= 29 && y >= 8) continue;
    if (m.objs.some(o => o.k === 'tree' && Math.abs(o.box.x - (x * T + 7)) < 40 && Math.abs(o.box.y - (y * T + 22)) < 28)) continue;
    m.tree(x, y, {pine: rr() > 0.5, tone: rr() > 0.5});
  }
  for (let i = 0; i < 22; i++) { const x = Math.floor(rr() * 60) + 1, y = Math.floor(rr() * 8) + 2; if (x >= 27 && x <= 35) continue; m.flowers(x, y, 1, 1, {n: 3 + Math.floor(rr() * 3), cols: [['#ff6b8b','#fff'], ['#ffd93d','#fff'], ['#b46bff','#ff6b8b']][i % 3]}); }
  m.obj('rock', 0, 0, 0, 0, {box: {x: 10 * T, y: 6 * T, w: 28, h: 20}}); m.obj('rock', 0, 0, 0, 0, {box: {x: 48 * T, y: 7 * T, w: 28, h: 20}});
  for (let y = 11; y <= 44; y += 3) { if (y > 17 && y < 24) continue; m.tree(0, y, {pine: true}); m.tree(63, y, {pine: true}); }
  for (let x = 2; x <= 61; x += 3) if (x < 28 || x > 34) m.tree(x, 44, {pine: x % 2 === 0});
  // ----- PARK (rows 34-45) -----
  m.fill(4, 30, 34, 32, 37); m.fill(4, 28, 37, 34, 42); m.fill(4, 6, 39, 56, 40); m.fill(4, 18, 35, 19, 44); m.fill(4, 44, 35, 45, 44);
  m.zones.push({place: 'park', x: 2 * T, y: 34 * T, w: 60 * T, h: 11 * T});
  m.obj('fountain', 0, 0, 0, 0, {box: {x: 29 * T + 16, y: 38 * T + 8, w: 96, h: 96}, act: {type: 'info', title: 'Fountain', words: ['fountain', 'water'], label: 'the fountain'}});
  // pond
  m.fill(3, 52, 36, 58, 38); m.solid(52 * T, 36 * T, 7 * T, 3 * T);
  m.obj('rock', 0, 0, 0, 0, {box: {x: 51 * T, y: 38 * T, w: 28, h: 20}}); m.flowers(51, 36, 1, 1, {n: 4}); m.flowers(59, 36, 1, 1, {n: 4});
  // dog play area (fenced)
  const fx = 4 * T, fy = 35 * T;
  m.obj('fence', 0, 0, 0, 0, {box: {x: fx, y: fy, w: 8 * T, h: 14}}); m.obj('fence', 0, 0, 0, 0, {box: {x: fx, y: fy + 7 * T, w: 8 * T, h: 14}});
  m.obj('fence', 0, 0, 0, 0, {box: {x: fx, y: fy + 14, w: 10, h: 6 * T}});
  m.obj('sandbox', 0, 0, 0, 0, {box: {x: 8 * T, y: 38 * T, w: 64, h: 40}, solid: false, flat: true});
  m.obj('sign', 0, 0, 0, 0, {box: {x: 7 * T, y: 41 * T + 20, w: 16, h: 10}, text: 'PETS', solid: true, act: {type: 'petplay', label: 'play with your pet'}});
  // benches, trees, flowers in park
  [[25, 38], [36, 38], [25, 41], [36, 41], [14, 36], [14, 42], [40, 36], [48, 42]].forEach(([x, y]) => m.obj('bench', 0, 0, 0, 0, {box: {x: x * T, y: y * T + 6, w: 40, h: 18}, act: {type: 'bench', label: 'sit on the bench'}}));
  [[21, 36], [22, 42], [40, 43], [16, 39], [47, 38], [43, 40], [10, 43], [27, 35], [35, 35], [51, 41], [56, 42]].forEach(([x, y], i) => m.tree(x, y, {fruit: i % 3 === 0}));
  [[22, 38], [38, 40], [17, 41], [43, 37], [29, 43], [33, 36], [12, 44], [55, 40], [46, 43], [24, 36]].forEach(([x, y], i) => m.flowers(x, y, 2, 1, {n: 7, cols: [['#ff6b8b', '#ffd93d', '#fff'], ['#b46bff', '#fff', '#ff9d3a'], ['#ff6b8b', '#fff', '#5ac8fa']][i % 3]}));
  m.obj('lamp', 0, 0, 0, 0, {box: {x: 28 * T + 8, y: 37 * T + 20, w: 12, h: 8}}); m.obj('lamp', 0, 0, 0, 0, {box: {x: 34 * T + 12, y: 37 * T + 20, w: 12, h: 8}});
  // NPCs
  m.npc('lily', 5, 19, true); m.npc('tom', 22, 39, true); m.npc('sam', 25.6, 40, false); m.npc('ben', 22, 31, true); m.npc('walker', 38, 19, true);
  m.hunt = [[10,18],[20,18],[26,22],[40,22],[55,19],[8,22],[22,30],[39,30],[54,30],[3,32],[16,38],[26,36],[41,38],[50,41],[8,43],[36,44],[22,8],[42,9],[61,22],[12,9],[24,22],[60,32]];
  m.spawn = {home: {x: 10 * T, y: 18 * T + 20}};
  return m;
}

/* ================= INTERIOR HELPERS ================= */
function interior(id, name, w, h, floor, wallCol, opts){
  const m = newMap(id, w, h, Object.assign({name, interior: true, base: floor, wallColor: wallCol, wallRows: 3}, opts || {}));
  m.solid(0, 0, w * T, 3 * T); // back wall
  m.exit = {x: (w / 2 - 1) * T, y: (h - 1) * T, w: 2 * T, h: T};
  return m;
}
const exitTo = (m, place) => { m.exitTo = place; };

function buildHome(){
  const m = interior('home', 'Home', 16, 12, 5, '#f5d6a6');
  m.window = [[2.5, 1], [11, 1]];
  m.obj('bed', 1, 3, 2, 3, {act: {type: 'bed', label: 'rest in your bed'}, box: {x: 1 * T, y: 3 * T, w: 56, h: 88}});
  m.obj('wardrobe', 4, 3, 2, 1, {box: {x: 4 * T, y: 3 * T, w: 64, h: 20}, act: {type: 'wardrobe', label: 'open the wardrobe'}});
  m.obj('mirror', 7, 3, 1, 1, {box: {x: 7 * T, y: 3 * T, w: 40, h: 14}, act: {type: 'mirror', label: 'look in the mirror'}});
  m.obj('shelf', 9, 3, 2, 1, {box: {x: 9 * T, y: 3 * T, w: 64, h: 16}, act: {type: 'wordbook', label: 'open your word book'}});
  m.obj('desk', 12, 3, 2, 1, {box: {x: 12 * T, y: 3 * T + 6, w: 64, h: 40}, act: {type: 'progress', label: 'check your progress'}});
  m.obj('fridge', 14, 3, 1, 1, {box: {x: 14 * T + 16, y: 3 * T, w: 32, h: 20}, act: {type: 'fridge', label: 'open the fridge'}});
  m.obj('rug', 5, 6, 6, 4, {solid: false, flat: true, color: '#5aa9e6'});
  m.obj('table', 7, 7, 2, 1, {box: {x: 7 * T, y: 7 * T, w: 64, h: 40}, cloth: '#fff'});
  m.obj('chair', 6, 7, 1, 1, {box: {x: 6 * T + 4, y: 7 * T + 8, w: 24, h: 20}}); m.obj('chair', 9, 7, 1, 1, {box: {x: 9 * T + 4, y: 7 * T + 8, w: 24, h: 20}});
  m.obj('sofa', 11, 8, 4, 2, {box: {x: 11 * T, y: 9 * T, w: 112, h: 44}});
  m.obj('petbed', 1, 9, 2, 1, {box: {x: 1 * T, y: 9 * T, w: 64, h: 28}, solid: false, act: {type: 'pet', label: 'care for your pet'}});
  m.obj('bowl', 4, 9, 1, 1, {box: {x: 4 * T + 4, y: 9 * T + 8, w: 24, h: 18}, solid: false, act: {type: 'pet', label: 'care for your pet'}});
  m.obj('plant', 0, 0, 0, 0, {box: {x: 0.3 * T, y: 7 * T, w: 28, h: 26}}); m.obj('plant', 0, 0, 0, 0, {box: {x: 14.4 * T, y: 6 * T, w: 28, h: 26}});
  m.obj('pic', 0, 0, 0, 0, {box: {x: 4.4 * T, y: 1.3 * T, w: 28, h: 22}, solid: false, color: '#ffd9a8'});
  m.obj('clock', 0, 0, 0, 0, {box: {x: 8.2 * T, y: 1 * T, w: 22, h: 22}, solid: false});
  m.npc('rose', 9, 10, false);
  exitTo(m, 'home');
  m.hunt = [];
  return m;
}
function buildSchool(){
  const m = interior('school', 'School', 20, 14, 9, '#f2e2a0');
  m.window = [[4, 1], [15, 1]];
  m.obj('board', 8, 3, 4, 1, {box: {x: 8 * T, y: 3 * T, w: 128, h: 8}, text: 'ABC  123', act: {type: 'words', label: 'learn new words'}});
  m.obj('shelf', 1, 3, 2, 1, {box: {x: 1 * T, y: 3 * T, w: 64, h: 16}, act: {type: 'wordbook', label: 'open the word book'}});
  m.obj('pic', 0, 0, 0, 0, {box: {x: 15.2 * T, y: 1.6 * T, w: 40, h: 40}, solid: false, color: '#ffd9a8', act: {type: 'info', title: 'Body Parts', cat: 'BODY PARTS', label: 'read the body poster'}});
  m.obj('pic', 0, 0, 0, 0, {box: {x: 17.4 * T, y: 1.6 * T, w: 36, h: 40}, solid: false, color: '#c9f0d9', act: {type: 'info', title: 'Colors', cat: 'COLORS', label: 'read the colors poster'}});
  m.obj('desk', 8, 4, 4, 1, {box: {x: 8 * T, y: 4 * T + 8, w: 128, h: 34}, bare: true});
  [[3, 7], [7, 7], [12, 7], [16, 7], [3, 10], [7, 10], [12, 10], [16, 10]].forEach(([x, y], i) => { m.obj('desk', x, y, 2, 1, {box: {x: x * T, y: y * T, w: 56, h: 30}}); m.obj('chair', x, y, 1, 1, {box: {x: x * T + 14, y: y * T + 32, w: 22, h: 18}, solid: false}); });
  m.obj('plant', 0, 0, 0, 0, {box: {x: 0.3 * T, y: 11 * T, w: 28, h: 26}}); m.obj('plant', 0, 0, 0, 0, {box: {x: 18.6 * T, y: 11 * T, w: 28, h: 26}});
  m.obj('clock', 0, 0, 0, 0, {box: {x: 6.4 * T, y: 1 * T, w: 24, h: 24}, solid: false});
  m.npc('greenms', 11, 5.2, false); m.npc('anna', 17, 5, false);
  exitTo(m, 'school');
  return m;
}
function buildClothes(){
  const m = interior('clothes', 'Clothes Shop', 16, 12, 10, '#e5d3f7');
  const act = {type: 'shop', shop: 'clothes', label: 'look at the clothes'};
  [[1, 3], [5, 3], [9, 3]].forEach(([x, y], i) => m.obj('rack', x, y, 3, 1, {box: {x: x * T, y: y * T + 8, w: 96, h: 16}, seed: i * 2, act}));
  m.obj('mirror', 13, 3, 1, 1, {box: {x: 13 * T, y: 3 * T, w: 40, h: 14}, act: {type: 'shop', shop: 'clothes', label: 'try on clothes'}});
  m.obj('rack', 1, 6, 3, 1, {box: {x: 1 * T, y: 7 * T, w: 96, h: 16}, seed: 3, act}); m.obj('rack', 5, 7, 3, 1, {box: {x: 5 * T + 16, y: 8 * T, w: 96, h: 16}, seed: 5, act});
  m.obj('rug', 6, 4, 4, 2, {solid: false, flat: true, color: '#ff8fc7'});
  m.obj('counter', 11, 6, 4, 1, {box: {x: 11 * T, y: 6 * T + 6, w: 128, h: 28}, top: '#f5deb3'});
  m.obj('plant', 0, 0, 0, 0, {box: {x: 0.3 * T, y: 9.5 * T, w: 28, h: 26}}); m.obj('plant', 0, 0, 0, 0, {box: {x: 14.5 * T, y: 9.5 * T, w: 28, h: 26}});
  m.npc('clara', 13, 5, false);
  exitTo(m, 'clothes');
  return m;
}
function buildPetShop(){
  const m = interior('petshop', 'Pet Shop', 16, 12, 6, '#cfeaff');
  const adopt = {type: 'adopt', label: 'meet the animals'};
  m.obj('cage', 1, 3, 2, 1, {box: {x: 1 * T, y: 3 * T + 8, w: 64, h: 28}, pet: 'dog', act: adopt});
  m.obj('cage', 4, 3, 2, 1, {box: {x: 4 * T, y: 3 * T + 8, w: 64, h: 28}, pet: 'cat', act: adopt});
  m.obj('cage', 7, 3, 2, 1, {box: {x: 7 * T, y: 3 * T + 8, w: 64, h: 28}, pet: 'dog', act: adopt});
  m.obj('goods', 10, 3, 3, 1, {box: {x: 10 * T, y: 3 * T + 12, w: 96, h: 16}, pal: ['#c8873f', '#e74c3c', '#4fb8f0', '#f7d44c'], act: {type: 'shop', shop: 'pet', label: 'see food and toys'}});
  m.obj('goods', 3, 7, 3, 1, {box: {x: 3 * T, y: 7 * T + 16, w: 96, h: 16}, pal: ['#ff8fc7', '#3b82f6', '#2ecc71'], act: {type: 'shop', shop: 'pet', label: 'see toys'}});
  m.obj('rug', 6, 5, 4, 3, {solid: false, flat: true, color: '#f7d44c'});
  m.obj('counter', 11, 7, 4, 1, {box: {x: 11 * T, y: 7 * T + 6, w: 128, h: 28}, top: '#d9c9a0'});
  m.obj('petbed', 0, 0, 0, 0, {box: {x: 13.2 * T, y: 9.5 * T, w: 64, h: 28}, solid: false});
  m.obj('plant', 0, 0, 0, 0, {box: {x: 0.3 * T, y: 9.5 * T, w: 28, h: 26}});
  m.obj('pic', 0, 0, 0, 0, {box: {x: 13.3 * T, y: 1.8 * T, w: 40, h: 34}, solid: false, color: '#ffd9a8', act: {type: 'info', title: 'Animals', cat: 'ANIMALS', label: 'read the animal poster'}});
  m.npc('paws', 12.5, 6, false);
  exitTo(m, 'petshop');
  return m;
}
function buildRestaurant(){
  const m = interior('restaurant', 'Restaurant: Tasty Corner', 18, 12, 5, '#ffd0c9');
  m.window = [[1.5, 1], [14.5, 1]];
  m.obj('board', 3, 3, 3, 1, {box: {x: 3 * T, y: 3 * T, w: 96, h: 8}, text: 'MENU', act: {type: 'info', title: 'Menu', cat: 'FOOD', label: 'read the menu'}});
  m.obj('counter', 10, 4, 6, 1, {box: {x: 10 * T, y: 4 * T + 4, w: 192, h: 28}, top: '#e8d9b5'});
  m.obj('stove', 16, 3, 1, 1, {box: {x: 16 * T + 4, y: 3 * T + 12, w: 28, h: 18}});
  [[2, 5], [6, 5], [2, 8], [6, 8], [12, 7], [15, 8]].forEach(([x, y], i) => {
    m.obj('table', x, y, 2, 1, {box: {x: x * T, y: y * T + 4, w: 56, h: 36}, cloth: i % 2 ? '#e74c3c' : '#fff'});
    m.obj('chair', x, y, 1, 1, {box: {x: x * T - 14, y: y * T + 8, w: 22, h: 20}, solid: false}); m.obj('chair', x, y, 1, 1, {box: {x: x * T + 52, y: y * T + 8, w: 22, h: 20}, solid: false});
  });
  m.obj('plant', 0, 0, 0, 0, {box: {x: 0.3 * T, y: 3.4 * T, w: 28, h: 26}}); m.obj('plant', 0, 0, 0, 0, {box: {x: 16.6 * T, y: 9.5 * T, w: 28, h: 26}});
  m.npc('rosa', 9, 7, false); m.npc('leo', 13, 3, false);
  exitTo(m, 'restaurant');
  return m;
}
function buildMarket(){
  const m = interior('supermarket', 'Supermarket', 20, 13, 6, '#c7ecd0');
  const mk = (cat, title, words) => ({type: 'market', cat, title, words, label: 'look at the ' + title.toLowerCase()});
  m.obj('goods', 2, 3, 5, 1, {box: {x: 2 * T, y: 3 * T + 12, w: 160, h: 18}, pal: ['#e74c3c', '#f7d44c', '#e74c3c', '#f39c12'], act: mk('fruit', 'Fruits', ['apple', 'banana'])});
  m.obj('goods', 8, 3, 5, 1, {box: {x: 8 * T, y: 3 * T + 12, w: 160, h: 18}, pal: ['#2ecc71', '#e67e22', '#e74c3c'], act: mk('veg', 'Vegetables', ['carrot', 'tomato'])});
  m.obj('goods', 14, 3, 5, 1, {box: {x: 14 * T, y: 3 * T + 12, w: 160, h: 18}, pal: ['#3b82f6', '#fff', '#f39c12', '#4fb8f0'], act: mk('drinks', 'Drinks', ['milk', 'juice', 'water'])});
  m.obj('goods', 2, 6, 5, 1, {box: {x: 2 * T, y: 6 * T + 12, w: 160, h: 18}, pal: ['#ff8fc7', '#4fb8f0', '#fff'], act: mk('hygiene', 'Hygiene products', ['soap', 'toothpaste'])});
  m.obj('goods', 8, 6, 5, 1, {box: {x: 8 * T, y: 6 * T + 12, w: 160, h: 18}, pal: ['#c8873f', '#e8d9b5', '#f7d44c'], act: mk('bakery', 'Bakery and dairy', ['bread', 'cheese', 'egg'])});
  m.obj('goods', 14, 6, 5, 1, {box: {x: 14 * T, y: 6 * T + 12, w: 160, h: 18}, pal: ['#c8873f', '#8a8f9c', '#e74c3c'], act: mk('petfood', 'Pet food', ['bone', 'fish'])});
  m.obj('counter', 14, 10, 4, 1, {box: {x: 14 * T, y: 10 * T + 6, w: 128, h: 28}, top: '#d9c9a0'});
  m.obj('cart', 0, 0, 0, 0, {box: {x: 3 * T, y: 9.5 * T, w: 32, h: 22}}); m.obj('cart', 0, 0, 0, 0, {box: {x: 5 * T, y: 9.5 * T, w: 32, h: 22}});
  m.obj('plant', 0, 0, 0, 0, {box: {x: 0.3 * T, y: 10.2 * T, w: 28, h: 26}});
  m.npc('fresh', 15.5, 9.3, false);
  exitTo(m, 'supermarket');
  m.hunt = [[3,5],[6,5],[9,5],[12,5],[16,5],[18,5],[3,8],[6,8],[9,8],[12,8],[16,8],[18,8],[11,10],[2,11],[18,11]];
  return m;
}

EA.buildMaps = function(){
  EA.MAPS.town = buildTown();
  EA.MAPS.home = buildHome();
  EA.MAPS.school = buildSchool();
  EA.MAPS.clothes = buildClothes();
  EA.MAPS.petshop = buildPetShop();
  EA.MAPS.restaurant = buildRestaurant();
  EA.MAPS.supermarket = buildMarket();
  // exits: interior -> town spawn in front of its building door
  const town = EA.MAPS.town;
  town.objs.filter(o => o.k === 'building' && o.place).forEach(b => {
    town.spawnAt = town.spawnAt || {};
    town.spawnAt[b.place] = {x: b.doorX, y: b.box.y + b.box.h + 26};
  });
};
EA.buildMaps();
})();
