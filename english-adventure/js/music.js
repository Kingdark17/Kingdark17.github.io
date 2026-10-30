/* ===== MUSIC: original chiptune background tracks played with the Web Audio API ===== */
(function(){
const M = EA.music = {ctx: null, track: null, want: null};
let master = null, musicBus = null, fxBus = null, echo = null, pulseWave = null, noiseBuf = null;
let timer = 0, nextTime = 0, step = 0, song = null, duck = 1;

/* ---------- volumes ---------- */
EA.vol = function(kind){
  const S = EA.settings, m = S.volMaster == null ? 0.8 : S.volMaster;
  if (kind === 'music') return S.music === false ? 0 : m * (S.volMusic == null ? 0.5 : S.volMusic);
  if (kind === 'voice') return m * (S.volVoice == null ? 1 : S.volVoice);
  if (kind === 'fx') return m * (S.volFx == null ? 0.7 : S.volFx);
  return m;
};

/* ---------- songs (original compositions) ---------- */
// tokens are 8th notes: a note name starts a note, '-' holds it, '.' is a rest
const SONGS = {
  town: {bpm: 112, lead: 'pulse', drums: 'full', echo: 0.18,
    chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F G', 'C'],
    melody: [
      'E5 - G5 - A5 G5 E5 -', 'C5 - E5 - D5 C5 A4 -', 'F4 A4 C5 - D5 C5 A4 -', 'G4 B4 D5 - G5 - - .',
      'E5 - G5 - C6 B5 A5 G5', 'A5 - E5 - C5 D5 E5 -', 'F5 E5 D5 C5 D5 - B4 -', 'C5 - - - . . . .',
      'G5 - E5 - G5 A5 G5 -', 'E5 - C5 - D5 E5 C5 -', 'A4 - C5 - F5 - E5 D5', 'B4 - D5 - G5 - F5 -',
      'E5 - G5 - C6 - G5 -', 'A5 G5 E5 - C5 - E5 -', 'F5 - A5 - G5 F5 D5 B4', 'C5 - E5 - C5 - . .'
    ]},
  cozy: {bpm: 84, lead: 'tri', drums: 'soft', echo: 0.28,
    chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Bb C', 'F'],
    melody: [
      'A4 - C5 - F5 - E5 -', 'D5 - - - A4 - - .', 'Bb4 - D5 - F5 - G5 -', 'E5 - - - C5 - - .',
      'A4 - C5 - F5 - A5 -', 'G5 - F5 - D5 - - .', 'D5 - F5 - E5 - C5 -', 'F5 - - - - - . .'
    ]},
  night: {bpm: 76, lead: 'bell', drums: 'none', echo: 0.35,
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E'],
    melody: [
      'E5 . A5 . C6 . B5 .', 'A5 - - . F5 . E5 .', 'E5 . G5 . C6 . D6 .', 'B5 - - . G5 . . .',
      'E5 . A5 . C6 . E6 .', 'D6 - C6 . A5 . F5 .', 'G5 . B5 . D6 . B5 .', 'G#5 - - - - . . .'
    ]}
};
const CHORD = {C: ['C', 'E', 'G'], Am: ['A', 'C', 'E'], F: ['F', 'A', 'C'], G: ['G', 'B', 'D'], Dm: ['D', 'F', 'A'], Bb: ['Bb', 'D', 'F'], E: ['E', 'G#', 'B'], Em: ['E', 'G', 'B']};
const SEMI = {C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11};
const freq = (name, oct) => { const m = /^([A-G][#b]?)(\d)?$/.exec(name); const o = oct != null ? oct : +m[2]; return 440 * Math.pow(2, (SEMI[m[1]] + (o + 1) * 12 - 69) / 12); };

function compile(s){
  const ev = [], bars = s.melody.length, total = bars * 8;
  s.melody.forEach((bar, b) => {
    const t = bar.trim().split(/\s+/);
    t.forEach((tok, i) => {
      if (tok === '-' || tok === '.') return;
      let len = 1; while (t[i + len] === '-') len++;
      ev.push({s: b * 8 + i, inst: 'lead', f: freq(tok), len});
    });
  });
  for (let b = 0; b < bars; b++) {
    const names = s.chords[b % s.chords.length].split(' ');
    for (let i = 0; i < 8; i++) {
      const ch = CHORD[names[i < 4 || names.length === 1 ? 0 : 1]], st = b * 8 + i;
      // bass: root / fifth
      if (i % 2 === 0) ev.push({s: st, inst: 'bass', f: freq(i % 4 === 0 ? ch[0] : ch[2], i % 4 === 0 ? 2 : 2), len: 2});
      // soft arpeggio
      ev.push({s: st, inst: 'arp', f: freq(ch[i % 3], s.lead === 'bell' ? 4 : 4) * (i >= 6 ? 2 : 1), len: 1});
      if (s.drums === 'full') { if (i === 0 || i === 4) ev.push({s: st, inst: 'kick'}); if (i === 2 || i === 6) ev.push({s: st, inst: 'snare'}); ev.push({s: st, inst: 'hat'}); }
      else if (s.drums === 'soft' && (i === 0 || i === 4)) ev.push({s: st, inst: 'hat'});
    }
  }
  const byStep = Array.from({length: total}, () => []);
  ev.forEach(e => byStep[e.s].push(e));
  return {byStep, total, spb: 60 / s.bpm / 2, def: s};
}
const COMPILED = {};
Object.keys(SONGS).forEach(k => COMPILED[k] = compile(SONGS[k]));

/* ---------- audio graph ---------- */
M.audioCtx = function(){
  if (M.ctx) return M.ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  const c = M.ctx = new AC();
  master = c.createGain(); master.connect(c.destination);
  musicBus = c.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
  fxBus = c.createGain(); fxBus.gain.value = 1; fxBus.connect(master);
  echo = c.createDelay(1); echo.delayTime.value = 0.32;
  const fb = c.createGain(); fb.gain.value = 0.28; const wet = c.createGain(); wet.gain.value = 0.22;
  echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(musicBus);
  M.echoIn = c.createGain(); M.echoIn.connect(echo);
  // 25% pulse wave for the chiptune lead
  const n = 32, re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
  pulseWave = c.createPeriodicWave(re, im);
  noiseBuf = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return c;
};
M.fxBus = () => { M.audioCtx(); return fxBus; };
M.output = () => { M.audioCtx(); return master; };
M.unlock = function(){
  const c = M.audioCtx(); if (!c) return;
  if (c.state === 'suspended') c.resume();
  if (!timer) timer = setInterval(schedule, 25);
};

function note(inst, f, t, dur){
  const c = M.ctx, g = c.createGain(); let o;
  if (inst === 'lead') {
    const kind = song.def.lead;
    o = c.createOscillator();
    if (kind === 'pulse') o.setPeriodicWave(pulseWave); else o.type = kind === 'bell' ? 'sine' : 'triangle';
    o.frequency.value = f;
    const peak = kind === 'pulse' ? 0.075 : kind === 'bell' ? 0.16 : 0.14;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.012);
    if (kind === 'bell') g.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.6, dur * 1.6));
    else { g.gain.setValueAtTime(peak * 0.8, t + Math.max(0.03, dur - 0.05)); g.gain.linearRampToValueAtTime(0, t + dur); }
    if (kind === 'pulse') { const v = c.createOscillator(), vg = c.createGain(); v.frequency.value = 5.5; vg.gain.value = f * 0.006; v.connect(vg); vg.connect(o.frequency); v.start(t + 0.12); v.stop(t + dur + 0.6); }
    o.connect(g); g.connect(musicBus); if (song.def.echo) { const s = c.createGain(); s.gain.value = song.def.echo * 2.5; g.connect(s); s.connect(M.echoIn); }
    o.start(t); o.stop(t + Math.max(dur, 0.7) + 0.05);
  } else if (inst === 'bass') {
    o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.02, t + dur);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.02);
  } else if (inst === 'arp') {
    o = c.createOscillator(); o.type = song.def.lead === 'bell' ? 'sine' : 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.035, t + 0.01); g.gain.exponentialRampToValueAtTime(0.002, t + dur * 0.95);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur);
  } else if (inst === 'kick') {
    o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.18);
  } else {
    const src = c.createBufferSource(); src.buffer = noiseBuf;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = inst === 'hat' ? 7000 : 1800;
    const peak = inst === 'hat' ? (song.def.drums === 'soft' ? 0.02 : 0.035) : 0.09, len = inst === 'hat' ? 0.04 : 0.12;
    g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(hp); hp.connect(g); g.connect(musicBus); src.start(t); src.stop(t + len + 0.02);
  }
}

function schedule(){
  const c = M.ctx; if (!c || c.state !== 'running') return;
  // volume, ducking under voices, crossfade between tracks
  const target = M.want ? EA.vol('music') * 1.6 : 0;
  const speaking = !!EA.speakingWho;
  duck += ((speaking ? 0.3 : 1) - duck) * 0.12;
  const switching = M.want !== M.track;
  const goal = switching ? 0 : target * duck;
  const cur = musicBus.gain.value;
  musicBus.gain.setTargetAtTime(goal, c.currentTime, switching ? 0.25 : 0.08);
  fxBus.gain.setTargetAtTime(EA.vol('fx') ? 1 : 0, c.currentTime, 0.05);
  if (switching && cur < 0.01) {
    M.track = M.want; song = M.track ? COMPILED[M.track] : null; step = 0; nextTime = c.currentTime + 0.1;
  }
  if (!song) return;
  if (nextTime < c.currentTime - 0.3) nextTime = c.currentTime + 0.05;
  while (nextTime < c.currentTime + 0.15) {
    song.byStep[step].forEach(e => note(e.inst, e.f, nextTime, (e.len || 1) * song.spb));
    nextTime += song.spb;
    step = (step + 1) % song.total;
  }
}

/* ---------- which track should play ---------- */
M.update = function(){
  if (!M.ctx) return;
  let w = 'town';
  const W = EA.world, inGame = !EA.$('hud').classList.contains('hidden');
  if (inGame && W.map) { if (W.map.interior) w = 'cozy'; else if (W.night() > 0.55) w = 'night'; }
  if (EA.settings.music === false || EA.vol('music') <= 0) w = null;
  M.want = w;
};
// browsers only allow sound after the first click / key press
['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, () => { M.unlock(); M.update(); }, {passive: true}));
})();
