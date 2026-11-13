// A rajada glacial no alvo: um cristal grande cresce no meio e quebra, estilhaços em losango saem em estrela e
// caem girando, um anel de frio abre e flocos descem. Ancorado no ponto do golpe.
import { fit, burst, fly, seg, ease, WHITE } from "../../core/index.js";
import { losango, cruzinha } from "./_comum.js";

export const meta = {
  name: "Gelo",
  desc: "Um cristal cresce e quebra, estilhaços em losango saem em estrela e caem, flocos descem.",
  tags: ["rpglegend", "ice", "magic", "one-shot"],
  size: [104, 104],
  origin: [52, 52],
  duration: 0.95,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#0a2a4a", "#1f5fa8", "#3fa9f5", "#9bdcff", "#e6f7ff", "#ffffff"], escala: 1, seed: 13 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 6), s = o.escala;

  // o cristal do meio: cresce rápido, segura, e some quando quebra
  if (t < 0.2) {
    const k = ease.outBack(seg(t, -0.03, 0.1)), h = 18 * k * s, w = 8 * k * s;
    if (h > 1) {
      p.poly([[0, -h], [w, 0], [0, h * 0.7], [-w, 0]], C[2]);
      p.poly([[0, -h], [w, 0], [0, 0]], C[4]);
      p.poly([[0, -h], [-w * 0.5, -h * 0.2], [0, 0]], WHITE);
    }
  }

  // os estilhaços: saem quando o cristal quebra
  burst(10, o.seed, (r, i) => {
    const a = (i / 10) * Math.PI * 2 + r.range(-0.2, 0.2), v = r.range(60, 105) * s, vida = r.range(0.45, 0.6), tt = t - 0.18;
    if (tt < 0 || tt > vida) return;
    const [x, y] = fly(0, 0, Math.cos(a) * v, Math.sin(a) * v - 30, tt, 300, 3);
    const giro = a + tt * r.range(-6, 6), tam = r.range(6, 9) * s * (1 - seg(tt / vida, 0.6, 1) * 0.6);
    losango(p, x, y, giro, tam, tam * 0.45, C[2], C[4]);
  });

  // o anel de frio que abre no estouro
  if (t > 0.17 && t < 0.32) {
    const k = seg(t, 0.17, 0.32);
    p.ring(0, 0, (5 + 10 * ease.outCubic(k)) * s, 1, k < 0.5 ? C[3] : C[2]);
  }

  // os flocos descendo
  burst(8, o.seed + 5, (r) => {
    const atraso = r.range(0.2, 0.45), vida = r.range(0.4, 0.5), tt = t - atraso;
    if (tt < 0 || tt > vida) return;
    const x = r.range(-26, 26) * s + Math.sin(tt * 8 + r.range(0, 6)) * 2, y = r.range(-30, -6) * s + tt * 40;
    cruzinha(p, x, y, false, C[4]);
  });

  const brilho = Math.exp(-Math.max(0, t - 0.17) / 0.1) * (t > 0.15 ? 1 : 0.4);
  if (brilho > 0.03) p.glow(0, 0, 24 * s, C[3], 0.35 * brilho);
}
