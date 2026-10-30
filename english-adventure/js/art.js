/* ===== ART: procedural pixel art — outlined sprites, characters, pets, tiles, objects, buildings ===== */
(function(){
const T = 32;
EA.T = T;
const COL = EA.COLOR;

function shade(hex, amt){
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = EA.clamp(r, 0, 255); g = EA.clamp(g, 0, 255); b = EA.clamp(b, 0, 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
EA.shade = shade;
const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
EA.R = R;
const mk = (w, h) => { const cv = document.createElement('canvas'); cv.width = Math.max(1, w); cv.height = Math.max(1, h); return cv; };
EA.mkCanvas = mk;

/* ---------- pixel helpers ---------- */
const OUT = [43, 33, 60];
// adds a 1px dark outline around every solid pixel of a sprite canvas
function outline(cv, col){
  col = col || OUT;
  const c = cv.getContext('2d'), w = cv.width, h = cv.height;
  let id; try { id = c.getImageData(0, 0, w, h); } catch (e) { return cv; }
  if (!id || !id.data) return cv;
  const d = id.data, a = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = d[i * 4 + 3] >= 170 ? 1 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (a[i]) continue;
    if ((x > 0 && a[i - 1]) || (x < w - 1 && a[i + 1]) || (y > 0 && a[i - w]) || (y < h - 1 && a[i + w])) {
      d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = 255;
    }
  }
  c.putImageData(id, 0, 0);
  return cv;
}
EA.outlineCanvas = outline;
// pixel-perfect filled circle / ellipse
function blob(c, cx, cy, r, col, ry){
  ry = ry || r; c.fillStyle = col;
  for (let dy = -ry; dy <= ry; dy++) {
    const k = dy / ry, hw = Math.floor(r * Math.sqrt(Math.max(0, 1 - k * k)) + 0.35);
    c.fillRect(Math.round(cx - hw), Math.round(cy + dy), hw * 2 + 1, 1);
  }
}
EA.blob = blob;
function tri(c, cx, top, h, wb, col, side){
  for (let r = 0; r < h; r++) {
    const hw = Math.max(1, Math.round((r + 1) / h * wb / 2));
    R(c, col, cx - hw, top + r, hw * 2, 1);
    if (side) R(c, side, cx + Math.round(hw * 0.35), top + r, Math.ceil(hw * 0.65), 1);
  }
}
function seeded(n){ let s = (n * 9301 + 49297) % 233280; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
EA.seeded = seeded;

/* ================= GROUND TILES ================= */
// 0 grass, 1 road, 2 sidewalk, 3 water, 4 park path, 5 wood floor, 6 tile floor, 7 carpet, 8 dark grass, 9 school floor, 10 shop floor
const tileCache = {};
function makeTile(type, v, f){
  const cv = mk(T, T), c = cv.getContext('2d'), rnd = seeded(type * 31 + v * 7 + 3);
  const speck = (col, n, s) => { for (let i = 0; i < n; i++) R(c, col, Math.floor(rnd() * (T - s)), Math.floor(rnd() * (T - s)), s, s); };
  const tuft = (col, x, y) => { R(c, col, x, y, 1, 3); R(c, col, x + 2, y - 1, 1, 4); R(c, col, x + 4, y, 1, 3); };
  switch (type) {
    case 0:
      R(c, '#7bc95a', 0, 0, T, T); speck('#6fbd4f', 14, 2); speck('#88d468', 10, 2); speck('#94dc72', 5, 1);
      tuft('#5aa83d', 5 + v * 3, 10); tuft('#5aa83d', 20 - v * 2, 24);
      if (v === 3) { R(c, '#ffffff', 24, 8, 2, 2); R(c, '#ffe066', 25, 8, 1, 1); }
      if (v === 1) { R(c, '#ffd1e1', 9, 26, 2, 2); }
      break;
    case 8:
      R(c, '#64b648', 0, 0, T, T); speck('#58a83d', 14, 2); speck('#76c45a', 8, 2); tuft('#4a9634', 8 + v * 4, 18); tuft('#4a9634', 22 - v, 8);
      break;
    case 1:
      R(c, '#575b6a', 0, 0, T, T); speck('#62667a', 16, 2); speck('#4b4f5d', 12, 2); speck('#6d7285', 6, 1);
      if (v === 2) { R(c, '#4a4e5b', 6, 14, 5, 1); R(c, '#4a4e5b', 10, 15, 4, 1); }
      break;
    case 2: {
      R(c, '#dcd4c2', 0, 0, T, T);
      for (let row = 0; row < 2; row++) {
        const off = row ? 8 : 0;
        for (let x = -16 + off; x < T; x += 16) { R(c, '#ebe5d6', x + 1, row * 16 + 1, 14, 1); R(c, '#cdc4b0', x + 1, row * 16 + 14, 14, 1); }
        R(c, '#bdb39d', 0, row * 16 + 15, T, 1);
        for (let x = off; x < T; x += 16) R(c, '#bdb39d', x, row * 16, 1, 15);
      }
      speck('#d2c9b6', 5, 1);
      break; }
    case 3:
      R(c, '#3d9be0', 0, 0, T, T); speck('#3590d6', 8, 2);
      for (let i = 0; i < 3; i++) { const y = (i * 11 + f * 3 + v * 5) % T, x = (i * 13 + f * 5 + v * 7) % (T - 8); R(c, '#69bdf2', x, y, 7, 1); R(c, '#69bdf2', x + 2, y + 1, 4, 1); }
      if ((f + v) % 2 === 0) R(c, '#d7f2ff', (v * 9 + f * 4) % 28 + 2, (v * 13 + f * 7) % 28 + 2, 2, 1);
      break;
    case 4:
      R(c, '#e5c891', 0, 0, T, T); speck('#d4b47c', 12, 2); speck('#f2deb0', 8, 2); speck('#bfa06a', 4, 1);
      if (v === 0) { R(c, '#c8ab76', 18, 9, 3, 2); R(c, '#efe0bd', 18, 9, 1, 1); }
      break;
    case 5:
      R(c, '#c98d55', 0, 0, T, T);
      for (let r = 0; r < 4; r++) {
        const y = r * 8, tone = (r + v) % 3 === 0 ? '#c08450' : (r + v) % 3 === 1 ? '#cf9460' : '#c98d55';
        R(c, tone, 0, y, T, 7); R(c, '#a8703f', 0, y + 7, T, 1); R(c, '#d9a06c', 0, y, T, 1);
        const sx = ((r * 13 + v * 7) % 24) + 4; R(c, '#a8703f', sx, y, 1, 7); R(c, '#8f5f33', sx + 3, y + 3, 1, 1);
      }
      break;
    case 6:
      R(c, '#eaf0f4', 0, 0, T, T); R(c, '#dbe5ec', 16, 0, 16, 16); R(c, '#dbe5ec', 0, 16, 16, 16);
      R(c, '#c8d4dc', 0, 0, T, 1); R(c, '#c8d4dc', 0, 0, 1, T); R(c, '#c8d4dc', 16, 0, 1, T); R(c, '#c8d4dc', 0, 16, T, 1);
      R(c, '#ffffff', 2, 2, 3, 1); R(c, '#ffffff', 18, 18, 3, 1);
      break;
    case 7: R(c, '#d8606f', 0, 0, T, T); R(c, '#c64f5e', 0, 0, T, 2); R(c, '#e47a88', 4, 4, 2, 2); R(c, '#e47a88', 20, 20, 2, 2); break;
    case 9:
      R(c, '#eddcab', 0, 0, T, T); R(c, '#e3d097', 16, 0, 16, 16); R(c, '#e3d097', 0, 16, 16, 16);
      R(c, '#d6c287', 0, 0, T, 1); R(c, '#d6c287', 0, 0, 1, T); R(c, '#d6c287', 16, 0, 1, T); R(c, '#d6c287', 0, 16, T, 1);
      break;
    case 10:
      R(c, '#f6e8cc', 0, 0, T, T); R(c, '#efdcb8', 8, 8, 16, 16); R(c, '#e6d0a8', 0, 0, T, 1); R(c, '#e6d0a8', 0, 0, 1, T);
      R(c, '#f8d5df', 15, 15, 2, 2);
      break;
  }
  return cv;
}
EA.tile = function(type, tx, ty, t){
  const v = (tx * 7 + ty * 13) & 3;
  const f = type === 3 ? Math.floor((t || 0) / 380 + tx * 0.6 + ty * 0.3) % 4 : 0;
  const k = type + ':' + v + ':' + f;
  return tileCache[k] || (tileCache[k] = makeTile(type, v, f));
};

/* ================= CHARACTERS ================= */
// 16x24 grid, 2 extra rows on top for hats; drawn at 1px per cell then scaled.
const CW = 16, PX = 1, PY = 3, SPR_W = CW + 2, SPR_H = 24 + PY + 1;
const charCache = new Map();
const kindOfTop = id => !id ? null : /^tshirt/.test(id) ? 'tshirt' : /^shirt/.test(id) ? 'shirt' : 'tshirt';

function buildChar(who, dirIn, step, blink){
  const cv = mk(SPR_W, SPR_H), c = cv.getContext('2d');
  const d = dirIn === 'left' ? 'right' : dirIn;
  const P = (x, y, w, h, col) => { if (!col || w <= 0 || h <= 0) return; c.fillStyle = col; c.fillRect(x + PX, y + PY, w, h); };
  const look = who.look, o = who.outfit;
  const ic = id => id && EA.ITEMS[id] ? COL[EA.ITEMS[id].color] : null;
  const skin = EA.SKINS[look.skin] || EA.SKINS[1], skS = shade(skin, -28), skH = shade(skin, 14);
  const hair = EA.HAIRCOLORS[look.hc] || '#2b1d12', hS = shade(hair, -30), hH = shade(hair, 42);
  const style = look.style || 'short';
  const dress = o.dress ? ic(o.dress) : null;
  const topC = dress || ic(o.top) || '#e8e8f0';
  const tk = dress ? 'dress' : kindOfTop(o.top);
  const botC = dress ? null : (ic(o.bottom) || '#7d8fb3');
  const shorts = !dress && o.bottom && /shorts/.test(o.bottom);
  const shoeC = ic(o.shoes) || '#6b4a2b', sneak = o.shoes && /sneakers/.test(o.shoes);
  const jac = ic(o.jacket);
  const longSleeve = !!jac || tk === 'shirt';
  const armC = jac || topC;
  const by = step ? 1 : 0;
  const EYE = '#2b2340', MOUTH = '#b9474a', CHEEK = '#f3a3a3';

  /* ---- legs & shoes ---- */
  const legCol = (dress || shorts) ? skin : botC;
  const drawLeg = (x, top, bottom, shadeIt) => {
    const lc = shadeIt ? shade(legCol, -18) : legCol;
    P(x, top, 3, bottom - top, lc);
    if (shorts) P(x, top, 3, 2, shadeIt ? shade(botC, -18) : botC);
  };
  const drawShoe = (x, y, w) => { P(x, y, w, 2, shoeC); P(x, y + 1, w, 1, sneak ? '#f4f4f4' : shade(shoeC, -28)); P(x, y, 1, 1, shade(shoeC, 35)); };
  if (d === 'right') {
    if (step === 0) { drawLeg(6, 17 + by, 21, false); drawShoe(6, 21, 4); }
    else {
      const back = step === 1 ? 4 : 8, front = step === 1 ? 8 : 4;
      drawLeg(back, 17 + by, 21, true); drawShoe(back, 21, 4);
      drawLeg(front, 17 + by, 21, false); drawShoe(front, 21, 4);
    }
  } else {
    const liftL = step === 1 ? 1 : 0, liftR = step === 2 ? 1 : 0;
    drawLeg(5, 17 + by, 21 - liftL, false); drawLeg(8, 17 + by, 21 - liftR, false);
    if (!dress && !shorts) { P(7, 17 + by, 1, 4 - liftL, shade(botC, -22)); }
    drawShoe(4, 21 - liftL, 4); drawShoe(8, 21 - liftR, 4);
  }

  /* ---- torso ---- */
  const tx = d === 'right' ? 5 : 4, tw = d === 'right' ? 6 : 8;
  if (dress) { // skirt
    const sx = d === 'right' ? 4 : 3, sw = d === 'right' ? 8 : 10;
    P(sx, 15 + by, sw, 3, dress); P(sx, 17 + by, sw, 1, shade(dress, -26)); P(sx, 15 + by, 1, 3, shade(dress, 18));
  }
  P(tx, 11 + by, tw, 6, topC);
  P(tx, 11 + by, 1, 6, shade(topC, 20));
  P(tx + tw - 1, 11 + by, 1, 6, shade(topC, -24));
  if (!dress) P(tx, 16 + by, tw, 1, botC ? shade(botC, -10) : shade(topC, -30)); // waist
  if (d === 'down') {
    if (tk === 'shirt') { P(6, 11 + by, 1, 1, '#ffffff'); P(9, 11 + by, 1, 1, '#ffffff'); P(7, 11 + by, 2, 1, skin); P(7, 13 + by, 1, 1, shade(topC, -40)); P(7, 15 + by, 1, 1, shade(topC, -40)); }
    else { P(7, 11 + by, 2, 1, skin); }
    if (dress) P(5, 15 + by, 6, 1, shade(dress, -14));
  }
  if (jac) {
    if (d === 'down') { P(4, 11 + by, 3, 6, jac); P(9, 11 + by, 3, 6, jac); P(6, 11 + by, 1, 6, shade(jac, -30)); P(9, 11 + by, 1, 6, shade(jac, -30)); P(4, 11 + by, 1, 6, shade(jac, 18)); P(11, 11 + by, 1, 6, shade(jac, -22)); }
    else if (d === 'up') { P(4, 11 + by, 8, 6, jac); P(4, 11 + by, 1, 6, shade(jac, 18)); P(11, 11 + by, 1, 6, shade(jac, -22)); P(7, 13 + by, 2, 3, shade(jac, -14)); }
    else { P(5, 11 + by, 5, 6, jac); P(10, 11 + by, 1, 6, shade(jac, -30)); }
  }
  /* ---- arms ---- */
  const drawArm = (x, y, w) => {
    if (longSleeve) P(x, y, w, 5, armC); else { P(x, y, w, 2, armC); P(x, y + 2, w, 3, skin); }
    P(x, y + 5, w, 1, skin); P(x + w - 1, y + 2, 1, 4, longSleeve ? shade(armC, -22) : skS);
  };
  if (d === 'right') {
    const ax = step === 1 ? 8 : step === 2 ? 6 : 7;
    drawArm(ax, 11 + by, 2);
  } else {
    drawArm(2, 11 + by + (step === 1 ? 1 : 0), 2);
    drawArm(12, 11 + by + (step === 2 ? 1 : 0), 2);
  }
  /* ---- head ---- */
  const hy = by;
  if (d === 'right') {
    P(5, 2 + hy, 6, 1, skin); P(4, 3 + hy, 8, 7, skin); P(5, 10 + hy, 6, 1, skin);
    P(12, 6 + hy, 1, 2, skin); // nose
    P(4, 9 + hy, 8, 1, skS); P(5, 10 + hy, 6, 1, skS);
  } else {
    P(4, 2 + hy, 8, 1, skin); P(3, 3 + hy, 10, 7, skin); P(4, 10 + hy, 8, 1, skin);
    P(12, 4 + hy, 1, 6, skS); P(4, 10 + hy, 8, 1, skS); P(3, 4 + hy, 1, 4, skH);
    P(2, 6 + hy, 1, 2, skin); P(13, 6 + hy, 1, 2, skS); // ears
  }
  /* ---- face ---- */
  if (d === 'down') {
    if (blink) { P(5, 7 + hy, 2, 1, EYE); P(9, 7 + hy, 2, 1, EYE); }
    else { P(5, 6 + hy, 2, 2, EYE); P(9, 6 + hy, 2, 2, EYE); P(5, 6 + hy, 1, 1, '#ffffff'); P(9, 6 + hy, 1, 1, '#ffffff'); }
    P(7, 9 + hy, 2, 1, MOUTH); P(4, 8 + hy, 1, 1, CHEEK); P(11, 8 + hy, 1, 1, CHEEK);
  } else if (d === 'right') {
    if (blink) P(9, 7 + hy, 2, 1, EYE); else { P(9, 6 + hy, 2, 2, EYE); P(10, 6 + hy, 1, 1, '#ffffff'); }
    P(10, 9 + hy, 2, 1, MOUTH); P(8, 8 + hy, 1, 1, CHEEK);
  }
  /* ---- hair ---- */
  if (d === 'down') {
    if (style === 'buzz') { P(4, 1 + hy, 8, 1, hair); P(3, 2 + hy, 10, 2, hair); P(5, 2 + hy, 3, 1, hH); }
    else {
      if (style === 'curly') { P(2, 1 + hy, 12, 4, hair); P(3, 0 + hy, 2, 1, hair); P(6, 0 + hy, 2, 1, hair); P(9, 0 + hy, 2, 1, hair); P(12, 0 + hy, 1, 1, hair); P(2, 5 + hy, 1, 4, hair); P(13, 5 + hy, 1, 4, hair); P(3, 5 + hy, 1, 1, hair); P(12, 5 + hy, 1, 1, hair); }
      else { P(4, 0 + hy, 8, 1, hair); P(3, 1 + hy, 10, 3, hair); P(3, 4 + hy, 3, 1, hair); P(8, 4 + hy, 5, 1, hair); P(3, 5 + hy, 1, 2, hair); P(12, 5 + hy, 1, 2, hair); }
      if (style === 'long') { P(2, 4 + hy, 2, 9, hair); P(12, 4 + hy, 2, 9, hair); P(2, 12 + hy, 2, 1, hS); P(12, 12 + hy, 2, 1, hS); }
      if (style === 'ponytail') { P(13, 2 + hy, 2, 4, hair); P(14, 6 + hy, 1, 3, hair); P(13, 2 + hy, 1, 1, '#e74c3c'); }
      if (style === 'spiky') { P(4, -1 + hy, 1, 1, hair); P(7, -2 + hy, 2, 2, hair); P(11, -1 + hy, 1, 1, hair); P(5, -1 + hy, 1, 1, hair); P(10, -1 + hy, 1, 1, hair); }
      P(5, 1 + hy, 3, 1, hH); P(3, 3 + hy, 10, 0, hS);
    }
  } else if (d === 'up') {
    P(2, 6 + hy, 1, 2, skin); P(13, 6 + hy, 1, 2, skS);
    if (style === 'buzz') { P(4, 1 + hy, 8, 1, hair); P(3, 2 + hy, 10, 6, hair); }
    else if (style === 'curly') { P(2, 1 + hy, 12, 8, hair); P(3, 0 + hy, 2, 1, hair); P(6, 0 + hy, 2, 1, hair); P(9, 0 + hy, 2, 1, hair); }
    else { P(4, 0 + hy, 8, 1, hair); P(3, 1 + hy, 10, 8, hair); P(4, 9 + hy, 8, 1, hair); }
    if (style === 'long') { P(2, 3 + hy, 12, 10, hair); P(2, 12 + hy, 12, 1, hS); }
    if (style === 'ponytail') { P(7, 9 + hy, 2, 5, hair); P(7, 9 + hy, 2, 1, '#e74c3c'); P(7, 13 + hy, 2, 1, hS); }
    if (style === 'spiky') { P(4, -1 + hy, 1, 1, hair); P(7, -2 + hy, 2, 2, hair); P(11, -1 + hy, 1, 1, hair); }
    P(5, 1 + hy, 4, 1, hH);
  } else { // right
    if (style === 'buzz') { P(5, 1 + hy, 6, 1, hair); P(4, 2 + hy, 8, 2, hair); P(4, 4 + hy, 2, 2, hair); }
    else {
      if (style === 'curly') { P(3, 0 + hy, 9, 4, hair); P(2, 3 + hy, 4, 6, hair); P(4, -1 + hy, 2, 1, hair); P(8, -1 + hy, 2, 1, hair); }
      else { P(5, 0 + hy, 6, 1, hair); P(4, 1 + hy, 8, 3, hair); P(3, 3 + hy, 4, 5, hair); P(10, 4 + hy, 2, 1, hair); }
      if (style === 'long') P(3, 3 + hy, 3, 10, hair);
      if (style === 'ponytail') { P(1, 3 + hy, 3, 2, hair); P(1, 5 + hy, 2, 4, hair); P(3, 3 + hy, 1, 2, '#e74c3c'); }
      if (style === 'spiky') { P(5, -1 + hy, 1, 1, hair); P(8, -2 + hy, 1, 2, hair); P(10, -1 + hy, 1, 1, hair); }
      P(6, 1 + hy, 3, 1, hH);
    }
    if (style !== 'long' && style !== 'curly') P(7, 6 + hy, 1, 2, skS); // ear
  }
  /* ---- glasses ---- */
  if (o.glasses && d !== 'up') {
    const sun = o.glasses === 'sunglasses', gc = sun ? '#1c1c26' : ic(o.glasses);
    if (d === 'down') {
      if (sun) { P(4, 6 + hy, 3, 2, gc); P(9, 6 + hy, 3, 2, gc); P(7, 6 + hy, 2, 1, gc); P(4, 6 + hy, 1, 1, '#6b7bb0'); P(9, 6 + hy, 1, 1, '#6b7bb0'); }
      else { P(4, 5 + hy, 3, 1, gc); P(9, 5 + hy, 3, 1, gc); P(4, 6 + hy, 1, 2, gc); P(11, 6 + hy, 1, 2, gc); P(7, 6 + hy, 2, 1, gc); }
    } else {
      if (sun) { P(8, 6 + hy, 4, 2, gc); P(6, 6 + hy, 2, 1, gc); }
      else { P(8, 5 + hy, 4, 1, gc); P(8, 6 + hy, 1, 2, gc); P(11, 6 + hy, 1, 2, gc); P(6, 6 + hy, 2, 1, gc); }
    }
  }
  /* ---- scarf / medal ---- */
  if (o.acc) {
    const ac = ic(o.acc);
    if (/scarf/.test(o.acc)) {
      if (d === 'right') { P(5, 11 + by, 6, 2, ac); P(4, 13 + by, 2, 3, shade(ac, -20)); }
      else { P(4, 11 + by, 8, 2, ac); P(4, 12 + by, 8, 1, shade(ac, -18)); if (d === 'down') P(9, 13 + by, 2, 3, shade(ac, -12)); }
    } else if (d !== 'up') { const mx = d === 'right' ? 8 : 7; P(mx, 12 + by, 2, 2, '#c0392b'); P(mx, 14 + by, 2, 2, '#f7c948'); P(mx, 14 + by, 1, 1, '#fff3b0'); }
  }
  /* ---- hats ---- */
  if (o.hat) {
    const hc = ic(o.hat), hy2 = hy;
    const side = d === 'right';
    if (o.hat === 'hat_crown') {
      const x0 = side ? 5 : 4, w = side ? 6 : 8;
      P(x0, 0 + hy2, w, 2, '#f7c948'); P(x0, -1 + hy2, 1, 1, '#f7c948'); P(x0 + w - 1, -1 + hy2, 1, 1, '#f7c948'); P(x0 + (w >> 1) - 1, -2 + hy2, 2, 2, '#f7c948');
      P(x0, 1 + hy2, w, 1, '#d9a520'); if (!side || true) P(x0 + (w >> 1) - 1, 0 + hy2, 2, 1, '#e74c3c');
    } else if (o.hat === 'hat_blue') { // cap
      if (side) { P(4, -1 + hy2, 7, 1, hc); P(4, 0 + hy2, 8, 3, hc); P(10, 3 + hy2, 4, 1, shade(hc, -30)); P(5, 0 + hy2, 3, 1, shade(hc, 30)); }
      else { P(4, -1 + hy2, 8, 1, hc); P(3, 0 + hy2, 10, 3, hc); P(5, 0 + hy2, 3, 1, shade(hc, 30)); P(7, -1 + hy2, 2, 1, '#ffffff');
        if (d === 'down') P(2, 3 + hy2, 12, 1, shade(hc, -30)); else P(6, 3 + hy2, 4, 1, shade(hc, -30)); }
    } else if (o.hat === 'hat_yellow') { // straw sun hat
      const band = '#e74c3c';
      if (side) { P(5, -1 + hy2, 6, 3, hc); P(5, 1 + hy2, 6, 1, band); P(2, 2 + hy2, 12, 1, shade(hc, -22)); }
      else { P(4, -1 + hy2, 8, 3, hc); P(4, 1 + hy2, 8, 1, band); P(1, 2 + hy2, 14, 1, shade(hc, -22)); P(5, -1 + hy2, 2, 1, shade(hc, 30)); }
    } else { // top hat
      const band = o.hat === 'hat_black' ? '#c0392b' : '#2b2340';
      if (side) { P(5, -2 + hy2, 6, 4, hc); P(5, 1 + hy2, 6, 1, band); P(3, 2 + hy2, 10, 1, shade(hc, -26)); }
      else { P(4, -2 + hy2, 8, 4, hc); P(4, 1 + hy2, 8, 1, band); P(2, 2 + hy2, 12, 1, shade(hc, -26)); P(5, -2 + hy2, 1, 3, shade(hc, 30)); }
    }
  }
  return outline(cv);
}

function charKey(who, d, step, blink){
  const l = who.look, o = who.outfit;
  return [l.skin, l.hc, l.style, o.top, o.bottom, o.dress, o.shoes, o.hat, o.glasses, o.jacket, o.acc, d, step, blink ? 1 : 0].join('|');
}
EA.charSprite = function(who, dir, step, blink){
  const d = dir === 'left' ? 'right' : dir;
  const k = charKey(who, d, step, blink);
  let s = charCache.get(k);
  if (!s) { if (charCache.size > 700) charCache.clear(); s = buildChar(who, d, step, blink); charCache.set(k, s); }
  return s;
};
function drawCharacter(c, x, y, who, dir, frame, u){
  u = Math.max(1, Math.round(u || 2));
  const step = frame > 0 ? [1, 0, 2, 0][Math.floor(frame) % 4] : 0;
  const blink = ((performance.now() + (who.seed || 0) * 977) % 4300) < 150;
  const spr = EA.charSprite(who, dir, step, blink);
  c.save();
  c.fillStyle = 'rgba(20,10,40,.25)'; c.beginPath(); c.ellipse(x, y - u * 0.5, 5.5 * u, 1.8 * u, 0, 0, Math.PI * 2); c.fill();
  c.imageSmoothingEnabled = false;
  const w = SPR_W * u, h = SPR_H * u, dx = Math.round(x - (PX + 8) * u), dy = Math.round(y - (PY + 23) * u);
  if (dir === 'left') { c.translate(dx + w, dy); c.scale(-1, 1); c.drawImage(spr, 0, 0, w, h); }
  else c.drawImage(spr, dx, dy, w, h);
  c.restore();
}
EA.drawCharacter = drawCharacter;
EA.CHAR_TOP = (PY + 23 + 2) ; // grid rows above the feet (for tags), multiply by scale
EA.charOf = () => ({look: EA.state.look, outfit: EA.state.outfit, seed: 3});
EA.npcWho = n => {
  const d = EA.NPCS[n];
  let seed = 0; for (const ch of n) seed = (seed * 31 + ch.charCodeAt(0)) % 997;
  return {seed, look: {skin: d.skin, hc: d.hc, style: d.style}, outfit: Object.assign({top: null, bottom: null, dress: null, shoes: null, hat: null, glasses: null, jacket: null, acc: null}, d.outfit)};
};

/* ================= PETS ================= */
const PET_W = 22, PET_H = 15;
const petCache = new Map();
function buildPet(type, step, wag, blink, acc, happy){
  const cv = mk(PET_W, PET_H), c = cv.getContext('2d');
  const P = (x, y, w, h, col) => { if (!col || w <= 0 || h <= 0) return; c.fillStyle = col; c.fillRect(x + 1, y + 1, w, h); };
  const EYE = '#2b2340';
  const legs = (xs, base, dk, top, bottom) => xs.forEach(([x, far], i) => {
    const lifted = step && ((step === 1) === (i % 2 === 0));
    P(x, top, 2, bottom - top - (lifted ? 1 : 0), far ? dk : base);
    P(x, bottom - 1 - (lifted ? 1 : 0), 2, 1, shade(far ? dk : base, -14));
  });
  if (type === 'dog') {
    const b = '#c98a45', dk = '#9c6230', lt = '#efc48c';
    // tail
    if (wag) { P(1, 2, 2, 1, dk); P(2, 3, 2, 2, dk); } else { P(0, 4, 2, 1, dk); P(1, 3, 2, 2, dk); }
    legs([[4, 1], [6, 0], [10, 1], [12, 0]], b, dk, 9, 12);
    P(4, 4, 9, 1, b); P(3, 5, 11, 4, b); P(5, 8, 7, 1, lt); P(4, 4, 6, 1, shade(b, 22)); P(3, 5, 1, 3, shade(b, 12));
    // head
    P(13, 1, 5, 6, b); P(12, 2, 1, 4, b); P(14, 0, 3, 1, b);
    P(17, 4, 3, 3, lt); P(19, 4, 1, 1, EYE); P(18, 6, 2, 1, shade(lt, -30));
    P(12, 1, 2, 5, dk); P(12, 6, 2, 1, shade(dk, -10)); // floppy ear
    if (blink) P(16, 3, 1, 1, shade(b, -40)); else { P(16, 2, 1, 2, EYE); }
    P(14, 1, 2, 1, shade(b, 22));
    if (happy) P(18, 7, 1, 2, '#ff7a8a');
  } else {
    const b = '#9aa0ad', dk = '#6f7584', lt = '#dfe2e8', pk = '#f7a9b8';
    // tail curling up
    const tx = wag ? 1 : 0;
    P(1 + tx, 0, 1, 2, dk); P(0 + tx, 1, 2, 4, b); P(1 + tx, 5, 2, 1, b); P(0 + tx, 1, 1, 3, shade(b, 15));
    legs([[4, 1], [6, 0], [10, 1], [12, 0]], b, dk, 8, 12);
    P(4, 4, 8, 1, b); P(3, 5, 10, 3, b); P(5, 7, 6, 1, lt); P(6, 4, 1, 2, dk); P(9, 4, 1, 2, dk); P(11, 4, 1, 1, dk);
    // head
    P(12, 2, 6, 5, b); P(12, 0, 2, 2, b); P(16, 0, 2, 2, b); P(13, 1, 1, 1, pk); P(16, 1, 1, 1, pk);
    P(16, 5, 3, 1, lt); P(17, 4, 1, 1, pk); P(18, 5, 2, 1, lt);
    if (blink) P(15, 4, 1, 1, dk); else { P(15, 3, 1, 2, '#3a7d44'); P(15, 3, 1, 1, '#a6f0a6'); }
    P(12, 2, 1, 3, shade(b, 15));
    if (happy) P(17, 6, 1, 1, pk);
  }
  if (acc) {
    if (/collar/.test(acc)) { const cc = acc === 'collar_red' ? '#e74c3c' : '#3b82f6'; P(13, 6, 4, 1, cc); P(15, 7, 1, 1, '#f7c948'); }
    else if (acc === 'pet_bow') { P(13, -1 + 1, 1, 2, '#ff8fc7'); P(15, 0, 1, 2, '#ff8fc7'); P(14, 0, 1, 1, '#d6609e'); }
  }
  return outline(cv);
}
function drawPet(c, x, y, type, dir, frame, accId, mood, u){
  u = Math.max(1, Math.round(u || 2));
  const now = performance.now();
  const step = frame > 0 ? [1, 0, 2, 0][Math.floor(frame) % 4] : 0;
  const wag = Math.floor(now / (mood === 'happy' ? 140 : 320)) % 2;
  const blink = ((now + (type === 'dog' ? 400 : 1700)) % 3900) < 140;
  const k = [type, step, wag, blink ? 1 : 0, accId || '', mood === 'happy' ? 1 : 0].join('|');
  let spr = petCache.get(k);
  if (!spr) { if (petCache.size > 300) petCache.clear(); spr = buildPet(type, step, wag, blink, accId, mood === 'happy'); petCache.set(k, spr); }
  c.save();
  c.fillStyle = 'rgba(20,10,40,.22)'; c.beginPath(); c.ellipse(x, y - u * 0.5, 7.5 * u, 1.8 * u, 0, 0, Math.PI * 2); c.fill();
  c.imageSmoothingEnabled = false;
  const w = PET_W * u, h = PET_H * u, dx = Math.round(x - (PET_W / 2) * u), dy = Math.round(y - 13 * u);
  if (dir === 'left') { c.translate(dx + w, dy); c.scale(-1, 1); c.drawImage(spr, 0, 0, w, h); }
  else c.drawImage(spr, dx, dy, w, h);
  c.restore();
}
EA.drawPet = drawPet;

/* ================= OBJECTS ================= */
const D = EA.draw = {};
const shadowEl = (c, cx, cy, rx, ry, a) => { c.fillStyle = 'rgba(20,10,40,' + (a || 0.18) + ')'; c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.fill(); };

D.tree = (c, o) => {
  const b = o.box, cx = Math.round(b.x + b.w / 2), by = Math.round(b.y + b.h);
  shadowEl(c, cx + 3, by - 3, 20, 6);
  R(c, '#7a4e2a', cx - 4, by - 26, 8, 24); R(c, '#5e3a1e', cx + 1, by - 26, 3, 24); R(c, '#95623a', cx - 3, by - 24, 1, 20);
  R(c, '#7a4e2a', cx - 7, by - 4, 4, 3); R(c, '#7a4e2a', cx + 3, by - 4, 4, 3);
  const g = o.tone ? ['#2b7a3a', '#3c9647', '#57b55c', '#8ad57e'] : ['#2d8445', '#41a557', '#62c46b', '#9be38f'];
  blob(c, cx - 11, by - 38, 12, g[0]); blob(c, cx + 11, by - 38, 12, g[0]); blob(c, cx, by - 51, 15, g[0]); blob(c, cx, by - 33, 12, g[0]);
  blob(c, cx - 10, by - 42, 10, g[1]); blob(c, cx + 8, by - 43, 10, g[1]); blob(c, cx - 1, by - 53, 12, g[1]);
  blob(c, cx - 6, by - 56, 7, g[2]); blob(c, cx - 13, by - 44, 5, g[2]); blob(c, cx + 5, by - 47, 5, g[2]);
  R(c, g[3], cx - 9, by - 61, 3, 2); R(c, g[3], cx - 16, by - 47, 2, 2); R(c, g[3], cx + 3, by - 50, 2, 2);
  R(c, g[0], cx + 6, by - 32, 2, 2); R(c, g[0], cx - 4, by - 40, 2, 1);
  if (o.fruit) [[-9, -36], [7, -44], [1, -30], [-3, -50], [12, -35]].forEach(([dx, dy]) => { R(c, '#e8433a', cx + dx, by + dy, 3, 3); R(c, '#ffb3a6', cx + dx, by + dy, 1, 1); });
};
D.pine = (c, o) => {
  const b = o.box, cx = Math.round(b.x + b.w / 2), by = Math.round(b.y + b.h);
  shadowEl(c, cx + 3, by - 3, 16, 5);
  R(c, '#6b4524', cx - 3, by - 16, 6, 15); R(c, '#4f321a', cx + 1, by - 16, 2, 15);
  const g = o.tone ? ['#26704a', '#2f8456', '#3d9b66'] : ['#2a7a4f', '#35925e', '#46ad70'];
  tri(c, cx, by - 42, 28, 40, g[0], shade(g[0], -18));
  tri(c, cx, by - 58, 24, 32, g[1], shade(g[1], -18));
  tri(c, cx, by - 71, 19, 24, g[2], shade(g[2], -18));
  R(c, '#7ccf93', cx - 4, by - 62, 2, 2); R(c, '#7ccf93', cx - 8, by - 44, 2, 2); R(c, '#7ccf93', cx - 2, by - 70, 1, 2);
};
D.bush = (c, o) => {
  const b = o.box, cx = b.x + b.w / 2, cy = b.y + b.h - 10;
  shadowEl(c, cx + 2, b.y + b.h - 3, 15, 4);
  blob(c, cx - 6, cy, 8, '#2f8a40'); blob(c, cx + 6, cy, 8, '#2f8a40'); blob(c, cx, cy - 5, 9, '#3f9f4d');
  blob(c, cx - 3, cy - 7, 5, '#5dbd66'); R(c, '#8fdd88', cx - 5, cy - 10, 2, 2);
  if (o.berry) { R(c, '#e74c3c', cx - 7, cy - 1, 2, 2); R(c, '#e74c3c', cx + 5, cy - 4, 2, 2); R(c, '#e74c3c', cx + 1, cy + 2, 2, 2); }
};
D.flowers = (c, o) => {
  const b = o.box, cols = o.cols || ['#ff6b8b', '#ffd93d', '#ffffff', '#b46bff'];
  const r = seeded(Math.round(b.x * 3 + b.y));
  for (let i = 0; i < (o.n || 6); i++) {
    const fx = Math.round(b.x + 4 + r() * (b.w - 10)), fy = Math.round(b.y + 6 + r() * (b.h - 10)), cc = cols[Math.floor(r() * cols.length)];
    R(c, '#3a8f3a', fx + 1, fy + 3, 1, 5); R(c, '#4fae4a', fx + 2, fy + 5, 2, 1);
    R(c, shade(cc, -40), fx - 1, fy + 1, 5, 2); R(c, cc, fx - 1, fy, 5, 2); R(c, cc, fx, fy - 1, 3, 4); R(c, '#ffd23a', fx + 1, fy, 1, 1);
  }
};
D.bench = (c, o) => {
  const b = o.box; shadowEl(c, b.x + b.w / 2, b.y + b.h, b.w / 2 + 2, 4);
  R(c, '#5e3c1c', b.x + 3, b.y + 14, 4, 10); R(c, '#5e3c1c', b.x + b.w - 7, b.y + 14, 4, 10);
  R(c, '#8b5a2b', b.x, b.y + 6, b.w, 9); R(c, '#a8733a', b.x, b.y + 6, b.w, 3); R(c, '#704521', b.x, b.y + 13, b.w, 2);
  R(c, '#8b5a2b', b.x + 1, b.y - 5, b.w - 2, 5); R(c, '#a8733a', b.x + 1, b.y - 5, b.w - 2, 2); R(c, '#5e3c1c', b.x + 4, b.y, 3, 6); R(c, '#5e3c1c', b.x + b.w - 7, b.y, 3, 6);
};
D.lamp = (c, o) => {
  const b = o.box, cx = Math.round(b.x + b.w / 2);
  shadowEl(c, cx + 2, b.y + b.h, 7, 2.5);
  R(c, '#3a3d4a', cx - 6, b.y + 3, 12, 5); R(c, '#4a4e5e', cx - 2, b.y - 34, 4, 38); R(c, '#626780', cx - 2, b.y - 34, 1, 36);
  R(c, '#3a3d4a', cx - 7, b.y - 36, 14, 3); R(c, '#ffe27a', cx - 5, b.y - 45, 10, 9); R(c, '#fff6c8', cx - 3, b.y - 43, 4, 5); R(c, '#3a3d4a', cx - 6, b.y - 48, 12, 3); R(c, '#3a3d4a', cx - 1, b.y - 51, 2, 3);
};
D.fountain = (c, o, t) => {
  const b = o.box, cx = Math.round(b.x + b.w / 2);
  shadowEl(c, cx, b.y + b.h - 2, b.w / 2 + 2, 8, 0.15);
  blob(c, cx, b.y + b.h / 2 + 6, b.w / 2, '#2b2140', b.h / 2 - 8);
  blob(c, cx, b.y + b.h / 2 + 5, b.w / 2 - 1, '#a9a9b8', b.h / 2 - 9);
  blob(c, cx, b.y + b.h / 2 + 3, b.w / 2 - 6, '#cfcfdc', b.h / 2 - 14);
  blob(c, cx, b.y + b.h / 2 + 4, b.w / 2 - 10, '#3fa6ea', b.h / 2 - 18);
  const ph = (t / 90) % 20;
  for (let i = 0; i < 3; i++) { const rr = ((ph + i * 7) % 20) + 4; c.strokeStyle = 'rgba(220,245,255,' + (0.6 - rr / 40) + ')'; c.lineWidth = 1; c.beginPath(); c.ellipse(cx, b.y + b.h / 2 + 4, rr * 1.4, rr * 0.7, 0, 0, Math.PI * 2); c.stroke(); }
  R(c, '#2b2140', cx - 6, b.y - 15, 12, 30); R(c, '#b9b9c8', cx - 5, b.y - 14, 10, 28); R(c, '#dcdce8', cx - 5, b.y - 14, 3, 28);
  R(c, '#2b2140', cx - 12, b.y - 20, 24, 7); R(c, '#cfcfdc', cx - 11, b.y - 19, 22, 5); R(c, '#4fb8f0', cx - 9, b.y - 18, 18, 2);
  const s = (t / 70) % 12;
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, rr = 4 + ((s + i * 2) % 12); R(c, 'rgba(200,240,255,.9)', cx + Math.cos(a) * rr * 1.3, b.y - 20 - Math.sin((s + i * 2) % 12 / 12 * Math.PI) * 10 + rr * 0.6, 2, 2); }
  R(c, '#d7f3ff', cx - 1, b.y - 30 + (s % 4), 2, 10);
};
D.sign = (c, o) => { const b = o.box, cx = Math.round(b.x + b.w / 2); R(c, '#6e4520', cx - 2, b.y - 6, 4, 18); R(c, '#8b5a2b', cx - 19, b.y - 27, 38, 22); R(c, '#f5deb3', cx - 17, b.y - 25, 34, 18); R(c, '#fff0cf', cx - 17, b.y - 25, 34, 2); };
D.signText = (c, o) => { const b = o.box, cx = b.x + b.w / 2; c.fillStyle = '#3a2a1a'; c.font = '700 9px Fredoka, "Trebuchet MS", sans-serif'; c.textAlign = 'center'; c.fillText(o.text || '', cx, b.y - 13); };
D.fence = (c, o) => { const b = o.box; R(c, '#d9c9a0', b.x, b.y + 4, b.w, 3); R(c, '#d9c9a0', b.x, b.y + 10, b.w, 3); for (let x = b.x; x < b.x + b.w; x += 10) { R(c, '#efe3c4', x, b.y - 2, 6, b.h + 2); R(c, '#c9b88f', x + 4, b.y - 2, 2, b.h + 2); R(c, '#efe3c4', x + 1, b.y - 4, 4, 2); } };
D.rock = (c, o) => { const b = o.box, cx = b.x + b.w / 2, cy = b.y + b.h / 2; shadowEl(c, cx + 2, b.y + b.h - 2, b.w / 2, 4); blob(c, cx, cy, b.w / 2 - 1, '#878a96', b.h / 2 - 1); blob(c, cx - 2, cy - 2, b.w / 2 - 5, '#a5a8b4', b.h / 2 - 4); R(c, '#c7cad4', cx - 6, cy - 5, 3, 2); };
D.mailbox = (c, o) => { const b = o.box; R(c, '#6e4520', b.x + 10, b.y, 4, 16); R(c, '#2f6fd6', b.x + 2, b.y - 11, 20, 12); R(c, '#4f8ef0', b.x + 2, b.y - 11, 20, 3); R(c, '#e74c3c', b.x + 19, b.y - 16, 2, 8); R(c, '#e74c3c', b.x + 19, b.y - 16, 5, 3); R(c, '#1c4fa8', b.x + 5, b.y - 6, 10, 2); };
D.sandbox = (c, o) => { const b = o.box; R(c, '#8b5a2b', b.x, b.y, b.w, b.h); R(c, '#a67338', b.x, b.y, b.w, 3); R(c, '#f0d58a', b.x + 4, b.y + 4, b.w - 8, b.h - 8); R(c, '#e3c473', b.x + 10, b.y + 12, 8, 4); R(c, '#e74c3c', b.x + b.w - 20, b.y + 10, 6, 5); R(c, '#3b82f6', b.x + b.w - 14, b.y + 18, 4, 6); };
D.hydrant = (c, o) => { const b = o.box; shadowEl(c, b.x + 9, b.y + b.h, 8, 3); R(c, '#e74c3c', b.x + 4, b.y, 10, 16); R(c, '#ff7b6b', b.x + 5, b.y, 2, 16); R(c, '#c0392b', b.x + 1, b.y + 5, 16, 4); R(c, '#c0392b', b.x + 5, b.y - 3, 8, 3); };
D.rug = (c, o) => { const b = o.box, col = o.color || '#5aa9e6'; R(c, shade(col, -30), b.x, b.y, b.w, b.h); R(c, col, b.x + 2, b.y + 2, b.w - 4, b.h - 4); R(c, 'rgba(255,255,255,.35)', b.x + 6, b.y + 6, b.w - 12, b.h - 12); R(c, col, b.x + 9, b.y + 9, b.w - 18, b.h - 18); for (let x = b.x + 4; x < b.x + b.w - 4; x += 6) { R(c, '#fff8e7', x, b.y - 2, 2, 2); R(c, '#fff8e7', x, b.y + b.h, 2, 2); } };
D.crosswalk = (c, o) => { const b = o.box; for (let i = 0; i < b.w; i += 8) R(c, '#eaeaea', b.x + i, b.y, 5, b.h); };
D.roadline = (c, o) => { const b = o.box; for (let i = 0; i < b.w; i += 24) R(c, '#f2d65a', b.x + i, b.y, 14, 3); };
D.roadlineV = (c, o) => { const b = o.box; for (let i = 0; i < b.h; i += 24) R(c, '#f2d65a', b.x, b.y + i, 3, 14); };

/* --- furniture --- */
D.bed = (c, o) => { const b = o.box; R(c, '#7a4e2a', b.x, b.y, b.w, b.h); R(c, '#9b6a3a', b.x, b.y, b.w, 4); R(c, '#ffffff', b.x + 4, b.y + 5, b.w - 8, 15); R(c, '#e6eef5', b.x + 4, b.y + 16, b.w - 8, 4); R(c, '#5aa9e6', b.x + 3, b.y + 22, b.w - 6, b.h - 26); R(c, '#8cc4f2', b.x + 3, b.y + 22, b.w - 6, 4); for (let y = b.y + 32; y < b.y + b.h - 6; y += 12) R(c, '#4a92cc', b.x + 3, y, b.w - 6, 2); };
D.wardrobe = (c, o) => { const b = o.box; R(c, '#6e4520', b.x, b.y - 26, b.w, b.h + 26); R(c, '#9b6a3a', b.x + 3, b.y - 22, b.w / 2 - 4, b.h + 19); R(c, '#9b6a3a', b.x + b.w / 2 + 1, b.y - 22, b.w / 2 - 4, b.h + 19); R(c, '#b07c48', b.x + 5, b.y - 20, b.w / 2 - 8, 3); R(c, '#b07c48', b.x + b.w / 2 + 3, b.y - 20, b.w / 2 - 8, 3); R(c, '#f7d44c', b.x + b.w / 2 - 5, b.y + 2, 3, 6); R(c, '#f7d44c', b.x + b.w / 2 + 2, b.y + 2, 3, 6); };
D.mirror = (c, o) => { const b = o.box; R(c, '#7a4e2a', b.x + 2, b.y - 32, b.w - 4, b.h + 32); R(c, '#bfe9ff', b.x + 6, b.y - 28, b.w - 12, b.h + 22); R(c, '#e8f7ff', b.x + 9, b.y - 24, 4, 16); R(c, '#e8f7ff', b.x + 14, b.y - 24, 2, 8); R(c, '#9fd6f5', b.x + 6, b.y - 8, b.w - 12, 4); };
D.table = (c, o) => { const b = o.box; shadowEl(c, b.x + b.w / 2 + 2, b.y + b.h, b.w / 2, 4); R(c, '#7a4e2a', b.x + 3, b.y + 10, 5, b.h - 8); R(c, '#7a4e2a', b.x + b.w - 8, b.y + 10, 5, b.h - 8); R(c, '#b57a44', b.x, b.y, b.w, 14); R(c, '#c98d55', b.x, b.y, b.w, 4); R(c, '#93602f', b.x, b.y + 12, b.w, 2); if (o.cloth) { R(c, o.cloth, b.x + 2, b.y + 1, b.w - 4, 10); R(c, shade(o.cloth, -25), b.x + 2, b.y + 9, b.w - 4, 2); R(c, '#ffffff', b.x + b.w / 2 - 3, b.y + 2, 6, 4); } };
D.chair = (c, o) => { const b = o.box; R(c, '#6e4520', b.x + 2, b.y, 3, b.h); R(c, '#6e4520', b.x + b.w - 5, b.y, 3, b.h); R(c, '#a67338', b.x, b.y + 8, b.w, 7); R(c, '#8b5a2b', b.x + 2, b.y - 8, b.w - 4, 9); R(c, '#a67338', b.x + 2, b.y - 8, b.w - 4, 2); };
D.sofa = (c, o) => { const b = o.box; R(c, '#a0301f', b.x, b.y - 8, b.w, b.h + 2); R(c, '#e0584a', b.x + 10, b.y + 4, b.w - 20, b.h - 10); R(c, '#c8443a', b.x + 10, b.y - 4, b.w - 20, 8); R(c, '#f07b6e', b.x + 10, b.y - 4, b.w - 20, 2); R(c, '#b83a2c', b.x + b.w / 2 - 1, b.y + 4, 2, b.h - 10); R(c, '#ffd23a', b.x + 14, b.y - 2, 10, 8); };
D.shelf = (c, o) => { const b = o.box; R(c, '#6e4520', b.x, b.y - 30, b.w, b.h + 30); R(c, '#4f321a', b.x + 3, b.y - 27, b.w - 6, b.h + 24); const cols = ['#e74c3c', '#3b82f6', '#2ecc71', '#f7d44c', '#9b59b6', '#ff9d3a']; for (let r = 0; r < 3; r++) { R(c, '#8b5a2b', b.x + 2, b.y - 28 + r * 16 + 13, b.w - 4, 3); for (let i = 0; i < Math.floor((b.w - 8) / 5); i++) { const hh = 11 - (i % 3); R(c, cols[(i + r * 2) % 6], b.x + 4 + i * 5, b.y - 28 + r * 16 + 13 - hh, 4, hh); R(c, 'rgba(255,255,255,.35)', b.x + 4 + i * 5, b.y - 28 + r * 16 + 13 - hh, 1, hh); } } };
D.counter = (c, o) => { const b = o.box; R(c, '#6e4520', b.x, b.y, b.w, b.h); R(c, o.top || '#d9c9a0', b.x - 2, b.y - 6, b.w + 4, 12); R(c, shade(o.top || '#d9c9a0', 25), b.x - 2, b.y - 6, b.w + 4, 3); R(c, '#5e3a1e', b.x, b.y + 10, b.w, b.h - 10); for (let x = b.x + 8; x < b.x + b.w - 8; x += 24) R(c, '#7a4e2a', x, b.y + 13, 18, b.h - 16); R(c, '#2b2340', b.x + b.w - 28, b.y - 14, 18, 9); R(c, '#7ee0a0', b.x + b.w - 26, b.y - 12, 14, 4); };
D.desk = (c, o) => { const b = o.box; R(c, '#9b6a3a', b.x, b.y, b.w, b.h - 6); R(c, '#b57a44', b.x, b.y, b.w, 6); R(c, '#c98d55', b.x, b.y, b.w, 2); R(c, '#6e4520', b.x + 2, b.y + b.h - 8, 4, 8); R(c, '#6e4520', b.x + b.w - 6, b.y + b.h - 8, 4, 8); if (!o.bare) { R(c, '#ffffff', b.x + 6, b.y - 3, 10, 6); R(c, '#cfd9e0', b.x + 7, b.y - 1, 8, 1); R(c, '#3b82f6', b.x + b.w - 16, b.y - 4, 5, 7); R(c, '#f7d44c', b.x + b.w - 10, b.y - 5, 2, 8); } };
D.board = (c, o) => { const b = o.box; R(c, '#7a4e2a', b.x, b.y - 36, b.w, 40); R(c, '#2f5d46', b.x + 4, b.y - 32, b.w - 8, 32); R(c, '#3a6e54', b.x + 4, b.y - 32, b.w - 8, 3); R(c, '#9b6a3a', b.x + 2, b.y - 2, b.w - 4, 4); R(c, '#ffffff', b.x + 10, b.y - 3, 8, 2); R(c, '#ff8fc7', b.x + 22, b.y - 3, 6, 2); };
D.boardText = (c, o) => { const b = o.box; c.fillStyle = '#ffffff'; c.font = '700 11px Fredoka, "Trebuchet MS", sans-serif'; c.textAlign = 'center'; c.fillText(o.text || 'ABC', b.x + b.w / 2, b.y - 13); };
D.rack = (c, o) => { const b = o.box; R(c, '#6e4520', b.x, b.y - 20, b.w, 3); R(c, '#6e4520', b.x + 2, b.y - 20, 3, b.h + 20); R(c, '#6e4520', b.x + b.w - 5, b.y - 20, 3, b.h + 20); const cs = ['#e74c3c', '#3b82f6', '#f7d44c', '#2ecc71', '#ff8fc7', '#9b59b6']; for (let i = 0; i < Math.floor((b.w - 10) / 9); i++) { const col = cs[(i + (o.seed || 0)) % 6]; R(c, '#c9c9d6', b.x + 9 + i * 9, b.y - 19, 1, 3); R(c, col, b.x + 6 + i * 9, b.y - 16, 7, 18); R(c, shade(col, 25), b.x + 6 + i * 9, b.y - 16, 2, 18); R(c, shade(col, -30), b.x + 6 + i * 9, b.y + 1, 7, 1); } };
D.cage = (c, o) => { const b = o.box; R(c, '#9aa3b0', b.x, b.y - 16, b.w, b.h + 16); R(c, '#f2ecd8', b.x + 3, b.y - 13, b.w - 6, b.h + 10); R(c, '#e3d7b5', b.x + 3, b.y + b.h - 8, b.w - 6, 5); if (o.pet) drawPet(c, b.x + b.w / 2, b.y + b.h - 3, o.pet, 'right', 0, null, 'happy', 2); for (let i = 0; i <= b.w; i += 6) R(c, '#6b7686', b.x + i, b.y - 16, 1, b.h + 16); R(c, '#6b7686', b.x, b.y - 16, b.w, 2); R(c, '#6b7686', b.x, b.y + b.h - 2, b.w, 2); };
D.petbed = (c, o) => { const b = o.box; blob(c, b.x + b.w / 2, b.y + b.h / 2 + 2, b.w / 2 - 1, '#a0301f', b.h / 2 - 2); blob(c, b.x + b.w / 2, b.y + b.h / 2 + 3, b.w / 2 - 6, '#f07b6e', b.h / 2 - 6); R(c, '#ffffff', b.x + b.w / 2 - 6, b.y + b.h / 2 + 1, 3, 3); R(c, '#ffffff', b.x + b.w / 2 + 3, b.y + b.h / 2 - 1, 3, 3); };
D.bowl = (c, o) => { const b = o.box; R(c, '#c0392b', b.x, b.y + 5, b.w, b.h - 6); R(c, '#e8584a', b.x, b.y + 5, b.w, 2); R(c, '#8b5a2b', b.x + 3, b.y + 3, b.w - 6, 3); R(c, '#a6703c', b.x + 5, b.y + 2, 4, 2); };
D.fridge = (c, o) => { const b = o.box; R(c, '#dfe6ec', b.x, b.y - 32, b.w, b.h + 32); R(c, '#f4f8fb', b.x + 2, b.y - 30, 3, b.h + 28); R(c, '#b9c4cc', b.x, b.y - 12, b.w, 2); R(c, '#8a97a2', b.x + b.w - 8, b.y - 26, 3, 10); R(c, '#8a97a2', b.x + b.w - 8, b.y - 8, 3, 10); R(c, '#ff6b8b', b.x + 8, b.y - 24, 4, 4); R(c, '#3b82f6', b.x + 14, b.y - 22, 4, 4); };
D.plant = (c, o) => { const b = o.box, cx = b.x + b.w / 2; R(c, '#b5651d', b.x + 5, b.y + 8, b.w - 10, b.h - 8); R(c, '#d4823a', b.x + 4, b.y + 8, b.w - 8, 3); blob(c, cx - 5, b.y + 2, 6, '#2f8a40'); blob(c, cx + 5, b.y + 2, 6, '#2f8a40'); blob(c, cx, b.y - 6, 8, '#45a554'); R(c, '#8fdd88', cx - 3, b.y - 10, 2, 2); };
D.window = (c, o) => { const b = o.box; R(c, '#ffffff', b.x, b.y, b.w, b.h); R(c, '#9fd8ff', b.x + 3, b.y + 3, b.w - 6, b.h - 6); R(c, '#c6eaff', b.x + 3, b.y + 3, b.w - 6, 6); R(c, '#ffffff', b.x + b.w / 2 - 1, b.y, 2, b.h); R(c, '#ffffff', b.x, b.y + b.h / 2 - 1, b.w, 2); R(c, '#f2a7c0', b.x + 3, b.y + 3, 5, b.h - 6); R(c, '#f2a7c0', b.x + b.w - 8, b.y + 3, 5, b.h - 6); R(c, '#d9d2c3', b.x - 2, b.y + b.h, b.w + 4, 3); };
D.goods = (c, o) => {
  const b = o.box; R(c, '#c3ccd5', b.x, b.y - 36, b.w, b.h + 36); R(c, '#e1e7ec', b.x + 2, b.y - 34, b.w - 4, b.h + 32); R(c, '#9aa6b2', b.x, b.y - 36, b.w, 3);
  const pal = o.pal || ['#e74c3c', '#f7d44c', '#2ecc71', '#3b82f6'];
  for (let r = 0; r < 3; r++) { R(c, '#8a97a2', b.x + 2, b.y - 31 + r * 14 + 11, b.w - 4, 3); for (let i = 0; i < Math.floor((b.w - 6) / 7); i++) { const col = pal[(i + r) % pal.length], hh = 9 - (i % 2) * 2; R(c, col, b.x + 4 + i * 7, b.y - 31 + r * 14 + 11 - hh, 5, hh); R(c, 'rgba(255,255,255,.45)', b.x + 5 + i * 7, b.y - 30 + r * 14 + 11 - hh, 1, hh - 2); } }
};
D.cart = (c, o) => { const b = o.box; R(c, '#6b7686', b.x, b.y - 4, b.w, 3); R(c, '#9aa3b0', b.x + 2, b.y - 1, b.w - 4, 13); for (let x = b.x + 4; x < b.x + b.w - 4; x += 4) R(c, '#c9d0d8', x, b.y, 1, 11); R(c, '#e74c3c', b.x - 2, b.y - 6, 5, 3); R(c, '#2b2340', b.x + 4, b.y + 15, 5, 5); R(c, '#2b2340', b.x + b.w - 9, b.y + 15, 5, 5); };
D.stove = (c, o) => { const b = o.box; R(c, '#555a66', b.x, b.y - 16, b.w, b.h + 16); R(c, '#6c7280', b.x, b.y - 16, b.w, 3); R(c, '#2b2d35', b.x + 3, b.y - 11, b.w - 6, 8); R(c, '#ff9d3a', b.x + 6, b.y - 9, 6, 4); R(c, '#ff5a3a', b.x + b.w - 12, b.y - 9, 6, 4); R(c, '#9aa3b0', b.x + 4, b.y + 2, b.w - 8, 8); };
D.pic = (c, o) => { const b = o.box; R(c, '#7a4e2a', b.x, b.y, b.w, b.h); R(c, o.color || '#9fd8ff', b.x + 3, b.y + 3, b.w - 6, b.h - 6); R(c, '#6bbd4c', b.x + 3, b.y + b.h - 9, b.w - 6, 6); R(c, '#ffd23a', b.x + b.w - 11, b.y + 5, 4, 4); };
D.clock = (c, o) => { const b = o.box, cx = b.x + b.w / 2, cy = b.y + b.h / 2; blob(c, cx, cy, b.w / 2, '#7a4e2a'); blob(c, cx, cy, b.w / 2 - 2, '#ffffff'); R(c, '#2b2340', cx - 1, b.y + 4, 2, b.h / 2 - 3); R(c, '#2b2340', cx, cy - 1, b.w / 3, 2); };
D.hunt = (c, o, t) => {
  const b = o.box, bob = Math.sin(t / 250 + b.x) * 3;
  shadowEl(c, b.x + b.w / 2, b.y + b.h - 1, 8 - bob / 2, 2.5, 0.22);
  const g = 0.35 + 0.25 * Math.sin(t / 200 + b.y);
  c.fillStyle = 'rgba(255,240,150,' + g + ')'; c.beginPath(); c.arc(b.x + b.w / 2, b.y + b.h - 12 + bob, 13, 0, Math.PI * 2); c.fill();
  c.font = '20px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#000';
  c.fillText(o.emoji, b.x + b.w / 2, b.y + b.h - 4 + bob);
  const sp = (t / 120 + b.x) % 8; R(c, '#ffffff', b.x + b.w - 3, b.y - 6 + bob + sp, 2, 2);
};

/* ================= BUILDINGS ================= */
function buildingGeom(o){
  const b = o.box, roofH = Math.round(b.h * 0.38);
  const s = o.style; let sign = null;
  if (s.signText) { const sw = Math.min(b.w - 20, 16 + s.signText.length * 9); sign = {x: Math.round(b.x + b.w / 2 - sw / 2), y: b.y + roofH, w: sw, h: 18}; }
  return {roofH, sign};
}
D.building = (c, o) => {
  const b = o.box, s = o.style; const x = Math.round(b.x), y = Math.round(b.y), w = Math.round(b.w), h = Math.round(b.h);
  const {roofH, sign} = buildingGeom(o);
  shadowEl(c, x + w / 2 + 6, y + h - 2, w / 2 + 6, 9, 0.2);
  // wall
  const wallTop = y + roofH - 8;
  R(c, s.wall, x, wallTop, w, h - roofH + 8);
  for (let yy = wallTop + 10; yy < y + h - 12; yy += 8) R(c, shade(s.wall, -9), x, yy, w, 1);
  R(c, shade(s.wall, 18), x + 3, wallTop, 2, h - roofH + 8); R(c, shade(s.wall, -26), x + w - 4, wallTop, 4, h - roofH + 8);
  R(c, shade(s.wall, -34), x, y + h - 10, w, 10); R(c, shade(s.wall, -20), x, y + h - 10, w, 2);
  // roof
  const rc = s.roof;
  R(c, rc, x - 6, y, w + 12, roofH);
  for (let r = 0, yy = y + 4; yy < y + roofH - 6; yy += 6, r++) {
    R(c, shade(rc, -20), x - 6, yy + 5, w + 12, 1);
    for (let xx = x - 6 + (r % 2 ? 6 : 0); xx < x + w + 6; xx += 12) R(c, shade(rc, -14), xx, yy, 1, 5);
    R(c, shade(rc, 10), x - 6, yy, w + 12, 1);
  }
  R(c, shade(rc, 30), x - 6, y, w + 12, 4); R(c, shade(rc, -36), x - 6, y + roofH - 5, w + 12, 5);
  R(c, 'rgba(20,10,40,.18)', x, y + roofH, w, 5);
  if (s.kind === 'house') { R(c, '#8a5a44', x + w - 34, y - 16, 12, 20); R(c, '#a8735a', x + w - 34, y - 16, 3, 20); R(c, '#6e4535', x + w - 36, y - 19, 16, 4); }
  // windows
  const winY = y + roofH + 14, nWin = Math.max(2, Math.floor(w / 70));
  const doorX = Math.round(o.doorX || x + w / 2);
  o._wins = [];
  for (let i = 0; i < nWin * 2 + 1; i++) {
    const wx = Math.round(x + 14 + i * ((w - 28 - 34) / (nWin * 2)));
    if (Math.abs(wx + 17 - doorX) < 48 || wx + 34 > x + w - 8) continue;
    if (sign && wx + 36 > sign.x && wx - 2 < sign.x + sign.w && winY < sign.y + sign.h + 2) continue;
    R(c, '#ffffff', wx - 3, winY - 3, 40, 34); R(c, s.glass || '#a9ddff', wx, winY, 34, 28); R(c, shade(s.glass || '#a9ddff', 25), wx, winY, 34, 8);
    R(c, '#ffffff', wx + 16, winY, 2, 28); R(c, '#ffffff', wx, winY + 13, 34, 2);
    R(c, 'rgba(255,255,255,.7)', wx + 3, winY + 3, 6, 2); R(c, 'rgba(255,255,255,.7)', wx + 3, winY + 5, 2, 5);
    R(c, s.kind === 'house' ? '#f2a7c0' : '#ffe9b0', wx, winY, 4, 28); R(c, s.kind === 'house' ? '#f2a7c0' : '#ffe9b0', wx + 30, winY, 4, 28);
    R(c, shade(s.wall, -40), wx - 4, winY + 31, 42, 3);
    if (s.awning) for (let k = 0; k < 8; k++) R(c, k % 2 ? '#ffffff' : s.awning, wx - 4 + k * 5.25, winY - 11, 6, 8);
    if (s.kind === 'house') { R(c, '#7a4e2a', wx - 2, winY + 34, 38, 5); for (let k = 0; k < 5; k++) R(c, ['#ff6b8b', '#ffd93d', '#ffffff', '#b46bff', '#ff9d3a'][k], wx + 1 + k * 7, winY + 30, 4, 4); }
    o._wins.push({x: wx, y: winY, w: 34, h: 28});
  }
  // door
  R(c, '#ffffff', doorX - 21, y + h - 56, 42, 56);
  R(c, '#6e4520', doorX - 17, y + h - 52, 34, 52); R(c, '#8b5a2b', doorX - 15, y + h - 50, 30, 50);
  R(c, '#9b6a3a', doorX - 12, y + h - 46, 10, 18); R(c, '#9b6a3a', doorX + 2, y + h - 46, 10, 18); R(c, '#9b6a3a', doorX - 12, y + h - 24, 10, 16); R(c, '#9b6a3a', doorX + 2, y + h - 24, 10, 16);
  R(c, '#6e4520', doorX - 1, y + h - 50, 2, 50); R(c, '#f7d44c', doorX + 5, y + h - 27, 3, 4);
  R(c, '#b9b2a2', doorX - 26, y + h - 4, 52, 4); R(c, '#d9d2c3', doorX - 26, y + h - 4, 52, 1);
  if (s.kind !== 'house') { R(c, '#b5651d', doorX - 34, y + h - 14, 10, 12); blob(c, doorX - 29, y + h - 18, 6, '#3f9f4d'); R(c, '#b5651d', doorX + 24, y + h - 14, 10, 12); blob(c, doorX + 29, y + h - 18, 6, '#3f9f4d'); }
  if (o.locked) R(c, 'rgba(20,10,40,.55)', doorX - 17, y + h - 52, 34, 52);
  // sign board
  if (sign) { R(c, '#5e3a1e', sign.x - 3, sign.y - 3, sign.w + 6, sign.h + 6); R(c, s.sign || '#fff6d6', sign.x, sign.y, sign.w, sign.h); R(c, '#ffffff', sign.x, sign.y, sign.w, 2); }
  if (s.flowerbox || s.kind === 'house') { R(c, '#7a4e2a', x + 8, y + h - 18, 30, 6); for (let i = 0; i < 4; i++) R(c, ['#ff6b8b', '#ffd93d', '#fff', '#b46bff'][i], x + 10 + i * 7, y + h - 23, 4, 5); }
};
D.buildingText = (c, o) => {
  const b = o.box, s = o.style, {roofH, sign} = buildingGeom(o);
  if (sign) { c.fillStyle = s.signInk || '#3a2a1a'; c.font = '700 12px Fredoka, "Trebuchet MS", sans-serif'; c.textAlign = 'center'; c.fillText(s.signText, b.x + b.w / 2, sign.y + 13); }
  if (s.icon) { c.font = '16px sans-serif'; c.textAlign = 'center'; c.fillText(s.icon, b.x + 20, b.y + roofH + 34); c.fillText(s.icon, b.x + b.w - 20, b.y + roofH + 34); }
  if (o.locked) { const dx = o.doorX || b.x + b.w / 2; c.font = '16px sans-serif'; c.textAlign = 'center'; c.fillText('🔒', dx, b.y + b.h - 22); }
};

/* ---------- cached, outlined object sprites ---------- */
const DIRECT = {flowers: 1, rug: 1, crosswalk: 1, roadline: 1, roadlineV: 1, sandbox: 1, fountain: 1, hunt: 1};
const ML = 34, MR = 34, MT = 100, MB = 14;
function objSprite(o){
  const b = o.box, x0 = Math.floor(b.x) - ML, y0 = Math.floor(b.y) - MT;
  const cv = mk(Math.ceil(b.w) + ML + MR + 2, Math.ceil(b.h) + MT + MB + 2), c = cv.getContext('2d');
  c.translate(-x0, -y0);
  D[o.k](c, o, 0);
  c.setTransform(1, 0, 0, 1, 0, 0);
  outline(cv);
  return {cv, x: x0, y: y0};
}
EA.drawObject = function(c, o, t){
  const f = D[o.k]; if (!f) return;
  if (DIRECT[o.k] || o.flat) { f(c, o, t); return; }
  const key = o.k === 'building' ? (o.locked ? 'L' : 'U') : '-';
  if (!o._spr || o._sprKey !== key) { o._spr = objSprite(o); o._sprKey = key; }
  c.drawImage(o._spr.cv, o._spr.x, o._spr.y);
  const tf = D[o.k + 'Text']; if (tf) tf(c, o, t);
};
})();
