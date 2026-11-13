// O desvio do herói: riscos brancos de velocidade passam pelos lados do corpo e uma poeirinha sobe do pé.
// Ancorado no pé: y = 0 é o chão.
import { fit, burst, fly, seg, ease } from "../../core/index.js";
import { bola } from "./_comum.js";

export const meta = {
  name: "Desvio",
  desc: "Riscos brancos de velocidade passam pelos lados do corpo e uma poeirinha sobe do pé.",
  tags: ["rpglegend", "dodge", "one-shot"],
  size: [80, 56],
  origin: [40, 48],
  duration: 0.55,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#1f2529", "#4a5258", "#7f878c", "#b3b9bc", "#dfe3e4", "#ffffff"], seed: 53 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 6);

  // os riscos: passam rápido, dos dois lados, em alturas diferentes
  burst(4, o.seed, (r, i) => {
    const lado = i % 2 ? 1 : -1, y = -r.range(6, 28), tt = t - i * 0.03, vida = 0.22;
    if (tt < 0 || tt > vida) return;
    const k = ease.outCubic(tt / vida), x0 = lado * (8 + 10 * k), comp = 10 * (1 - k) + 2;
    p.beam(x0, y, x0 + lado * comp, y, 1, k < 0.5 ? C[5] : C[4]);
  });

  // a poeirinha do pé
  burst(4, o.seed + 1, (r, i) => {
    const tt = t - 0.02, vida = r.range(0.35, 0.5);
    if (tt < 0 || tt > vida) return;
    const [x, y] = fly(0, -1, (i % 2 ? 1 : -1) * r.range(30, 60), -r.range(8, 20), tt, 0, 4);
    const k = tt / vida;
    bola(p, x, y, r.range(2, 3) * (k < 0.3 ? 0.6 + k : 1 - seg(k, 0.4, 1)), C);
  });
}
