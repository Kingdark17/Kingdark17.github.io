// O golpe que acerta: uma estrela de quatro pontas gorda estoura no ponto do golpe (dois quadros brancos e
// amarelos), traços curtos saem dela como em quadrinho, ela encolhe esfriando, e lascas de 2 px voam e caem.
// No estilo do Breno: poucos tons chapados, formas gordas, e o contorno escuro vem do exporta.mjs.
import { PAL, fit, burst, fly, seg, ease, star, WHITE } from "../../core/index.js";

export const meta = {
  name: "Golpe",
  desc: "Uma estrela gorda de quatro pontas estoura no ponto do golpe, traços saem dela, ela encolhe esfriando e lascas voam e caem.",
  tags: ["rpglegend", "impact", "hit", "one-shot"],
  size: [96, 84],
  origin: [48, 42],
  duration: 0.36,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: PAL.fire, escala: 1, pedacos: 6, seed: 3 },
};

const CHEIA = 0.066; // dois quadros a 30 fps

export function draw(p, t, o) {
  const C = fit(o.palette, 6), s = o.escala;
  const giro = ((o.seed % 7) - 3) * 0.06;

  // os traços: seis, entre as pontas, saem rápido e recolhem pra fora
  if (t < 0.15) {
    burst(6, o.seed + 50, (r, i) => {
      const a = (i / 6) * Math.PI * 2 + giro + r.range(-0.15, 0.15) + Math.PI / 6;
      const k = seg(t, 0, 0.15), de = (9 + 12 * ease.outQuad(k)) * s, ate = (13 + 10 * ease.outCubic(seg(t, 0, 0.08))) * s + 2;
      if (ate - de < 1) return;
      const c = Math.cos(a), sn = Math.sin(a);
      p.beam(c * de, sn * de, c * ate, sn * ate, k < 0.5 ? 1.6 : 1, k < 0.4 ? C[5] : C[4]);
    });
  }

  // a estrela: cheia dois quadros, depois encolhe e esfria
  if (t < 0.17) {
    const k = seg(t, CHEIA, 0.17), r1 = (14 - 9 * ease.inQuad(k)) * s, r0 = (4 - 2 * k) * s;
    const quente = t < CHEIA;
    p.poly(star(0, 0, r0, r1, 4, -Math.PI / 4 + giro), quente ? C[4] : k < 0.5 ? C[3] : C[2]);
    if (t < 0.12) p.poly(star(0, 0, r0 * 0.6, r1 * 0.6, 4, -Math.PI / 4 + giro), t < 0.033 ? WHITE : quente ? C[5] : C[4]);
  }

  // as lascas: 2 px, saem rápido, caem e somem
  burst(o.pedacos, o.seed, (r) => {
    const a = r.range(-Math.PI, 0.4) - 0.2, v = r.range(110, 190) * s, vida = r.range(0.2, 0.3);
    const tt = t - 0.02;
    if (tt < 0 || tt > vida) return;
    const [x, y] = fly(0, 0, Math.cos(a) * v, Math.sin(a) * v, tt, 560, 3.5);
    const lado = tt < vida * 0.75 ? 2 : 1;
    p.rect(Math.round(x), Math.round(y), lado, lado, r.pick([C[5], C[4], C[4], C[3]]));
  });

  // o brilho, curto
  const brilho = Math.exp(-t / 0.045);
  if (brilho > 0.03) p.glow(0, 0, 16 * s, C[4], 0.35 * brilho);
}
