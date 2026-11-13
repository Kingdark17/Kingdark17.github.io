// A poeira do golpe que cai no chão (o círculo do monstro, a investida que bate na parede): um anel de bolas de
// poeira rola pelo chão, pedrinhas pulam e caem. Com `onda`, um anel de força abre antes (o rugido do chefe).
// Ancorado no chão: y = 0.
import { fit, burst, fly, seg, ease } from "../../core/index.js";
import { bola } from "./_comum.js";

export const meta = {
  name: "Poeira",
  desc: "Um anel de bolas de poeira rola pelo chão e pedrinhas pulam e caem.",
  tags: ["rpglegend", "dust", "impact", "ground", "one-shot"],
  size: [112, 72],
  origin: [56, 56],
  duration: 0.75,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#1f2529", "#4a5258", "#7f878c", "#b3b9bc", "#dfe3e4", "#ffffff"],
    forca: ["#5c1208", "#ed1c24", "#ff9404", "#ffc20e", "#fff200", "#ffffff"],
    escala: 1,
    onda: false,
    seed: 61,
  },
};

/** Um anel deitado no chão (só a borda), de `grossura` px. */
function anel(p, rx, ry, grossura, c) {
  const passos = Math.max(24, Math.ceil(rx * 4));
  for (let i = 0; i < passos; i++) {
    const g = (i / passos) * Math.PI * 2, x = Math.cos(g) * rx, y = Math.sin(g) * ry;
    p.px(x, y, c);
    if (grossura > 1) p.px(x, y + 1, c);
  }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), F = fit(o.forca, 6), s = o.escala;

  // a onda de força (o rugido): dois anéis abrem no chão
  if (o.onda) {
    for (let w = 0; w < 2; w++) {
      const k = seg(t, w * 0.12, w * 0.12 + 0.4);
      if (k > 0 && k < 1) anel(p, (8 + 34 * ease.outCubic(k)) * s, (3 + 11 * ease.outCubic(k)) * s, k < 0.5 ? 2 : 1, k < 0.5 ? F[4] : F[3]);
    }
  }

  // as bolas de poeira: saem em anel pelo chão, freiam e murcham
  const bolas = [];
  burst(10, o.seed, (r, i) => {
    const a = (i / 10) * Math.PI * 2 + r.range(-0.2, 0.2), v = r.range(70, 110) * s, vida = r.range(0.45, 0.65), tt = t - r.range(0, 0.04);
    if (tt < 0 || tt > vida) return;
    const [x, y] = fly(0, -2, Math.cos(a) * v, Math.sin(a) * v * 0.35, tt, -15, 6);
    const k = tt / vida, raio = r.range(3, 4.5) * s * (k < 0.2 ? 0.6 + 2 * k : 1 - ease.inQuad(seg(k, 0.4, 1)));
    bolas.push([x, y, raio]);
  });
  bolas.sort((a, b) => a[1] - b[1]);
  for (const [x, y, r] of bolas) bola(p, x, y, r, C);

  // as pedrinhas: pulam e caem no chão
  burst(6, o.seed + 2, (r) => {
    const a = r.range(-Math.PI * 0.9, -Math.PI * 0.1), v = r.range(60, 110) * s, vida = r.range(0.35, 0.5), tt = t - 0.02;
    if (tt < 0 || tt > vida) return;
    let [x, y] = fly(0, -2, Math.cos(a) * v, Math.sin(a) * v, tt, 600, 1);
    if (y > 0) y = 0;
    p.rect(Math.round(x), Math.round(y) - 1, 2, 2, r.pick([C[2], C[3]]));
  });
}
