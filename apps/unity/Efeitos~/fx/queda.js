// O monstro que cai: um estouro branco, e bolas gordas de fumaça (luz em cima, sombra embaixo, sólidas, então o
// contorno do exporta.mjs abraça a nuvem inteira) saem dele, freiam, sobem um pouco e murcham; estrelinhas em
// cruz voam e piscam. No estilo do Breno, sem fumaça translúcida.
import { PAL, fit, burst, fly, seg, ease, WHITE } from "../../core/index.js";

export const meta = {
  name: "Queda",
  desc: "Um estouro branco vira uma nuvem de bolas gordas que freiam, sobem e murcham, com estrelinhas piscando em volta.",
  tags: ["rpglegend", "death", "poof", "one-shot"],
  size: [100, 80],
  origin: [50, 44],
  duration: 0.95,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: PAL.smoke, stars: ["#ff9404", "#fff200", "#ffffff"], seed: 7 },
};

/** Uma bola da nuvem: a sombra embaixo, o corpo, a luz em cima à esquerda. */
function bola(p, x, y, r, C) {
  if (r < 0.8) return;
  p.circle(x + 0.5, y + 1, r, C[1]);
  p.circle(x, y, r, C[3]);
  if (r > 2) p.circle(x - r * 0.3, y - r * 0.35, r * 0.55, C[4]);
}

/** A estrelinha em cruz, 3 ou 5 px. */
function estrela(p, x, y, grande, c) {
  x = Math.round(x);
  y = Math.round(y);
  p.px(x, y, WHITE);
  const n = grande ? 2 : 1;
  for (let i = 1; i <= n; i++) {
    p.px(x - i, y, c);
    p.px(x + i, y, c);
    p.px(x, y - i, c);
    p.px(x, y + i, c);
  }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), E = fit(o.stars, 3);

  // o estouro: dois quadros
  if (t < 0.07) {
    const r = t < 0.034 ? 8 : 12;
    p.circle(0, 0, r, t < 0.034 ? WHITE : C[5]);
    if (t >= 0.034) p.circle(0, 0, 7, WHITE);
  }

  // a nuvem: um anel de bolas e algumas no meio
  const bolas = [];
  burst(12, o.seed, (r, i) => {
    const anel = i < 9, a = anel ? (i / 9) * Math.PI * 2 + r.range(-0.25, 0.25) : r.range(0, Math.PI * 2);
    const v = anel ? r.range(80, 115) : r.range(15, 40), vida = r.range(0.6, 0.85), atraso = r.range(0.02, 0.06);
    const tt = t - atraso;
    if (tt < 0 || tt > vida) return;
    const [x, y] = fly(0, 0, Math.cos(a) * v, Math.sin(a) * v * 0.75, tt, -22, 7);
    const k = tt / vida, rMax = anel ? r.range(4.5, 6.5) : r.range(6, 8);
    const raio = rMax * (k < 0.2 ? 0.55 + 0.45 * ease.outCubic(k / 0.2) : 1 - ease.inQuad(seg(k, 0.45, 1)));
    bolas.push([x, y, raio]);
  });
  // de trás pra frente (as de baixo por cima), pra luz das de cima não cobrir a sombra das de baixo
  bolas.sort((a, b) => a[1] - b[1]);
  for (const [x, y, r] of bolas) bola(p, x, y, r, C);

  // as estrelinhas: voam pra cima e pros lados, piscam e somem
  burst(6, o.seed + 9, (r, i) => {
    const a = r.range(-Math.PI * 0.95, -Math.PI * 0.05), v = r.range(130, 190), vida = r.range(0.45, 0.7), atraso = r.range(0.03, 0.1);
    const tt = t - atraso;
    if (tt < 0 || tt > vida) return;
    if (tt > vida * 0.6 && Math.floor(tt * 20) % 2) return; // pisca antes de sumir
    const [x, y] = fly(0, -4, Math.cos(a) * v, Math.sin(a) * v, tt, 160, 3.2);
    estrela(p, x, y, i % 3 === 0 && tt < vida * 0.5, E[i % 2]);
  });

  const brilho = Math.exp(-t / 0.06);
  if (brilho > 0.03) p.glow(0, 0, 20, C[5], 0.3 * brilho);
}
