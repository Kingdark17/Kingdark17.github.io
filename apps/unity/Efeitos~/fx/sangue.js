// O corte serrilhado: um risco vermelho em zigue-zague rasga o alvo em dois quadros, gotas gordas de sangue
// espirram e caem, e o risco afina e some. Ancorado no ponto do golpe.
import { fit, burst, fly, seg, WHITE } from "../../core/index.js";

export const meta = {
  name: "Sangue",
  desc: "Um risco vermelho serrilhado rasga o alvo, gotas espirram e caem e o risco se apaga.",
  tags: ["rpglegend", "bleed", "cut", "one-shot"],
  size: [96, 112],
  origin: [48, 44],
  duration: 0.7,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#3a0608", "#8a0f14", "#c41a1e", "#ed1c24", "#ff6a4a", "#ffffff"], seed: 37 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 6);

  // o risco: serrilhado, da esquerda de cima pra direita de baixo
  if (t < 0.3) {
    const k = seg(t, 0, 0.066), pontos = [];
    for (let i = 0; i <= 8; i++) {
      const u = (i / 8) * k;
      pontos.push([-18 + 36 * u, -14 + 28 * u + (i % 2 ? 2 : -2)]);
    }
    const larg = t < 0.1 ? 2.5 : 1.5 * (1 - seg(t, 0.1, 0.3)) + 0.5;
    for (let i = 1; i < pontos.length; i++) p.beam(pontos[i - 1][0], pontos[i - 1][1], pontos[i][0], pontos[i][1], larg, t < 0.1 ? C[4] : C[3]);
    if (t < 0.066) for (let i = 1; i < pontos.length; i++) p.line(pontos[i - 1][0], pontos[i - 1][1], pontos[i][0], pontos[i][1], WHITE);
  }

  // as gotas: espirram, caem e somem
  burst(9, o.seed, (r) => {
    const a = r.range(-1.2, 0.6), v = r.range(80, 150), vida = r.range(0.35, 0.55), tt = t - 0.04;
    if (tt < 0 || tt > vida) return;
    const [x, y] = fly(r.range(-6, 6), r.range(-6, 6), Math.cos(a) * v, Math.sin(a) * v, tt, 500, 2);
    const lado = tt < vida * 0.7 ? r.pick([2, 3]) : 1;
    p.rect(Math.round(x), Math.round(y), lado, lado, r.pick([C[2], C[3], C[3], C[4]]));
  });
}
