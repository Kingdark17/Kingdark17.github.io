// O raio: um zigue-zague cai do alto no alvo (branco com borda amarela, muda de desenho a cada quadro), estoura
// numa estrela elétrica e faíscas quicam. Ancorado no ponto do golpe; o raio vem de cima.
import { fit, burst, fly, seg, star, bolt, rng, WHITE } from "../../core/index.js";

export const meta = {
  name: "Raio",
  desc: "Um raio em zigue-zague cai do alto, pisca, estoura numa estrela elétrica e faíscas quicam.",
  tags: ["rpglegend", "lightning", "electric", "magic", "one-shot"],
  size: [104, 128],
  origin: [52, 88],
  duration: 0.6,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#1a2a5a", "#2f6bd1", "#4fd2ff", "#fff200", "#fffbd0", "#ffffff"], seed: 29 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 6);

  // o raio: dois desenhos alternando, nos primeiros quadros
  if (t < 0.17) {
    const caminho = bolt(rng(o.seed, Math.floor(t * 30) % 2), 4, -84, 0, 0, { jag: 0.25, depth: 4 });
    for (let i = 1; i < caminho.length; i++) p.beam(caminho[i - 1][0], caminho[i - 1][1], caminho[i][0], caminho[i][1], t < 0.1 ? 2.4 : 1.4, C[3]);
    for (let i = 1; i < caminho.length; i++) p.line(caminho[i - 1][0], caminho[i - 1][1], caminho[i][0], caminho[i][1], WHITE);
  }

  // a estrela elétrica no ponto
  if (t > 0.03 && t < 0.25) {
    const k = seg(t, 0.03, 0.25);
    p.poly(star(0, 0, 3, 14 * (1 - 0.6 * k), 6, ((Math.floor(t * 30) % 2) * Math.PI) / 6), k < 0.5 ? C[3] : C[2]);
    if (k < 0.5) p.circle(0, 0, 3, WHITE);
  }

  // as faíscas: riscos curtos que voam, caem e quicam no chão
  burst(10, o.seed + 1, (r) => {
    const a = r.range(-Math.PI, 0.2), v = r.range(120, 220), vida = r.range(0.25, 0.45), tt = t - 0.04;
    if (tt < 0 || tt > vida) return;
    const chao = 14, onde = (u) => {
      const [x, y] = fly(0, 0, Math.cos(a) * v, Math.sin(a) * v, Math.max(0, u), 700, 3);
      return [x, y > chao ? chao - (y - chao) * 0.3 : y];
    };
    const [x, y] = onde(tt), [x2, y2] = onde(tt - 0.02);
    p.line(x2, y2, x, y, r.chance(0.5) ? C[3] : C[2]);
  });

  const brilho = Math.exp(-t / 0.08);
  if (brilho > 0.03) {
    p.glow(0, 0, 26, C[2], 0.4 * brilho);
    p.glowLine(4, -84, 0, 0, 6, C[2], 0.3 * brilho);
  }
}
