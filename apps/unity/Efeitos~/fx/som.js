// A canção: arcos de som se abrem do alvo pros lados e notas saem em espiral, balançando e piscando antes de
// sumir. Ancorado no ponto do golpe (ou no herói, na canção de batalha).
import { fit, burst, seg, ease, bump } from "../../core/index.js";
import { nota } from "./_comum.js";

export const meta = {
  name: "Som",
  desc: "Arcos de som se abrem pros lados e notas saem em espiral, balançando.",
  tags: ["rpglegend", "sound", "song", "magic", "one-shot"],
  size: [104, 96],
  origin: [52, 52],
  duration: 0.95,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#2a0a2a", "#7a1f7a", "#c43fc4", "#ff8aff", "#ffd0ff", "#ffffff"], seed: 31 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 6);
  t += 0.034; // o primeiro quadro já mostra alguma coisa

  // três ondas de arcos, dos dois lados
  for (let w = 0; w < 3; w++) {
    const t0 = w * 0.12, k = seg(t, t0, t0 + 0.35);
    if (k <= 0 || k >= 1) continue;
    const r = 6 + 22 * ease.outCubic(k), larg = k < 0.5 ? 2 : 1, c = k < 0.5 ? C[4] : C[3];
    p.arc(0, 0, r, larg, -0.6, 0.6, c);
    p.arc(0, 0, r, larg, Math.PI - 0.6, Math.PI + 0.6, c);
  }

  // as notas: giram pra fora subindo, balançam e somem piscando
  burst(6, o.seed, (r, i) => {
    const atraso = 0.05 + i * 0.06, vida = r.range(0.45, 0.6), tt = t - atraso;
    if (tt < 0 || tt > vida) return;
    if (tt > vida * 0.7 && Math.floor(tt * 24) % 2) return;
    const k = tt / vida, a = r.range(0, Math.PI * 2) + k * 2.5, raio = 6 + 22 * ease.outQuad(k);
    nota(p, Math.cos(a) * raio, Math.sin(a) * raio * 0.7 - 12 * k, i % 2 ? C[3] : C[4]);
  });

  const brilho = bump(t, 0, 0.6);
  if (brilho > 0.03) p.glow(0, 0, 20, C[3], 0.25 * brilho);
}
