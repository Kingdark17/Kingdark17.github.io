// A bola de fogo estoura no alvo: um clarão, chamas gordas em gota (como a tocha do Breno) saem, freiam e sobem
// encolhendo, brasas voam, e sobra um pouco de fumaça. Ancorado no ponto do golpe.
import { PAL, fit, burst, fly, seg, ease, WHITE } from "../../core/index.js";
import { chama, bola } from "./_comum.js";

export const meta = {
  name: "Fogo",
  desc: "Um clarão, chamas gordas em gota saem e sobem encolhendo, brasas voam e sobra fumaça.",
  tags: ["rpglegend", "fire", "magic", "one-shot"],
  size: [104, 104],
  origin: [52, 60],
  duration: 0.9,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: PAL.fire, fumaca: ["#1f2529", "#4a5258", "#7f878c", "#b3b9bc", "#dfe3e4", "#ffffff"], escala: 1, seed: 11 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 6), F = fit(o.fumaca, 6), s = o.escala;

  if (t < 0.07) {
    p.circle(0, 0, (t < 0.034 ? 10 : 14) * s, t < 0.034 ? WHITE : C[4]);
    if (t >= 0.034) p.circle(0, 0, 9 * s, WHITE);
  }

  // a fumaça, por trás: aparece quando o fogo cede
  burst(4, o.seed + 7, (r) => {
    const atraso = r.range(0.3, 0.42), vida = r.range(0.4, 0.5), tt = t - atraso;
    if (tt < 0 || tt > vida) return;
    const [x, y] = fly(r.range(-8, 8) * s, -6 * s, r.range(-10, 10), -30, tt, 0, 1);
    const k = tt / vida;
    bola(p, x, y, r.range(3.5, 5) * s * (k < 0.3 ? k / 0.3 : 1 - seg(k, 0.5, 1)), F);
  });

  // as chamas: saem em anel, freiam e sobem encolhendo
  burst(8, o.seed, (r, i) => {
    const a = (i / 8) * Math.PI * 2 + r.range(-0.3, 0.3), v = r.range(80, 130) * s, vida = r.range(0.4, 0.6), atraso = r.range(0.02, 0.06);
    const tt = t - atraso;
    if (tt < 0 || tt > vida) return;
    const [x, y] = fly(0, 0, Math.cos(a) * v, Math.sin(a) * v * 0.7, tt, -120, 6);
    const k = tt / vida, raio = r.range(4, 6) * s * (k < 0.15 ? 0.6 + (0.4 * k) / 0.15 : 1 - ease.inQuad(seg(k, 0.3, 1)));
    chama(p, x, y, raio, C);
  });
  // a chama grande do meio
  if (t > 0.03 && t < 0.5) {
    const k = seg(t, 0.03, 0.5);
    chama(p, 0, 2, 9 * s * (k < 0.2 ? 0.7 + 1.5 * k : 1 - ease.inQuad(seg(k, 0.2, 1))), C);
  }

  // as brasas
  burst(9, o.seed + 3, (r) => {
    const a = r.range(-Math.PI, 0), v = r.range(90, 170) * s, vida = r.range(0.35, 0.6), tt = t - 0.04;
    if (tt < 0 || tt > vida) return;
    if (tt > vida * 0.7 && Math.floor(tt * 24) % 2) return;
    const [x, y] = fly(0, 0, Math.cos(a) * v, Math.sin(a) * v, tt, 200, 3);
    p.rect(Math.round(x), Math.round(y), 2, 2, r.pick([C[3], C[4], WHITE]));
  });

  const brilho = Math.exp(-t / 0.12);
  if (brilho > 0.03) p.glow(0, 0, 26 * s, C[3], 0.4 * brilho);
}
