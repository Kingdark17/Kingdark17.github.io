// O julgamento sagrado: um feixe dourado cai do alto no alvo, estoura numa estrela de oito pontas, e faíscas
// douradas sobem. Ancorado no ponto do golpe; o feixe vem de cima.
import { fit, burst, fly, seg, ease, star, WHITE } from "../../core/index.js";
import { cruzinha } from "./_comum.js";

export const meta = {
  name: "Luz",
  desc: "Um feixe dourado cai do alto, estoura numa estrela de oito pontas e faíscas douradas sobem.",
  tags: ["rpglegend", "holy", "light", "magic", "one-shot"],
  size: [96, 128],
  origin: [48, 88],
  duration: 0.85,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#5a3a00", "#b07a00", "#ffc20e", "#fff200", "#fffbd0", "#ffffff"], seed: 17 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 6);
  t += 0.034; // o primeiro quadro já mostra alguma coisa

  // o feixe: desce em dois quadros, fica, afina e some
  if (t < 0.3) {
    const desce = seg(t, 0, 0.066), topo = -84, fundo = topo + (0 - topo) * desce;
    const larg = t < 0.12 ? 4 : 4 * (1 - seg(t, 0.12, 0.3)) + 0.5;
    p.rect(-larg - 1, topo, (larg + 1) * 2, fundo - topo, C[3]);
    p.rect(-larg * 0.45, topo, Math.max(1, larg * 0.9), fundo - topo, WHITE);
  }

  // a estrela: estoura quando o feixe chega
  if (t > 0.06 && t < 0.32) {
    const k = seg(t, 0.06, 0.32), r1 = 16 - 10 * ease.inQuad(k), r0 = 4 - 2 * k;
    p.poly(star(0, 0, r0, r1, 8, -Math.PI / 2), k < 0.4 ? C[3] : C[2]);
    if (k < 0.6) p.poly(star(0, 0, r0 * 0.5, r1 * 0.55, 8, -Math.PI / 2), WHITE);
  }

  // as faíscas: sobem devagar e piscam
  burst(10, o.seed, (r, i) => {
    const atraso = 0.08 + r.range(0, 0.2), vida = r.range(0.35, 0.55), tt = t - atraso;
    if (tt < 0 || tt > vida) return;
    if (tt > vida * 0.6 && Math.floor(tt * 24) % 2) return;
    const [x, y] = fly(r.range(-6, 6), r.range(-4, 2), r.range(-50, 50), r.range(-90, -40), tt, 40, 2);
    if (i % 3 === 0) cruzinha(p, x, y, false, C[3]);
    else p.rect(Math.round(x), Math.round(y), 2, 2, r.pick([C[3], C[4], WHITE]));
  });

  const brilho = Math.exp(-Math.max(0, t - 0.05) / 0.12);
  if (brilho > 0.03) {
    p.glow(0, 0, 28, C[3], 0.4 * brilho);
    p.glowLine(0, -84, 0, 0, 8, C[3], 0.25 * brilho);
  }
}
