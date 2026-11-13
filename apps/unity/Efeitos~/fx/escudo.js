// O escudo do vigor apanhando: o hexágono azul aparece na frente do golpe, pisca branco, racha e solta lascas
// que caem. Ancorado no meio do corpo.
import { fit, burst, fly, seg, WHITE } from "../../core/index.js";

export const meta = {
  name: "Escudo apanhando",
  desc: "Um hexágono azul pisca branco na frente do golpe, racha e solta lascas que caem.",
  tags: ["rpglegend", "shield", "block", "one-shot"],
  size: [72, 88],
  origin: [36, 40],
  duration: 0.55,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#0a2a4a", "#1f5fa8", "#3fa9f5", "#9bdcff", "#e6f7ff", "#ffffff"], seed: 59 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 6);
  const pts = [];
  for (let i = 0; i < 6; i++) pts.push([Math.cos((i / 6) * Math.PI * 2 + Math.PI / 6) * 15, Math.sin((i / 6) * Math.PI * 2 + Math.PI / 6) * 17]);

  if (t < 0.3) {
    const c = t < 0.07 ? WHITE : C[3];
    for (let i = 0; i < 6; i++) p.beam(pts[i][0], pts[i][1], pts[(i + 1) % 6][0], pts[(i + 1) % 6][1], t < 0.15 ? 2 : 1.2, c);
    // a rachadura no meio
    if (t > 0.07) {
      p.line(-6, -8, -1, -1, C[4]);
      p.line(-1, -1, 4, -4, C[4]);
      p.line(-1, -1, 1, 7, C[4]);
    }
  }

  // as lascas: caem quando ele racha
  burst(8, o.seed, (r) => {
    const tt = t - 0.15, vida = r.range(0.25, 0.4);
    if (tt < 0 || tt > vida) return;
    const a = r.range(0, Math.PI * 2), [x, y] = fly(Math.cos(a) * 12, Math.sin(a) * 12, Math.cos(a) * 40, Math.sin(a) * 40 - 30, tt, 400, 1);
    p.rect(Math.round(x), Math.round(y), 2, 2, r.pick([C[3], C[4]]));
  });

  const brilho = Math.exp(-t / 0.08);
  if (brilho > 0.03) p.glow(0, 0, 20, C[3], 0.35 * brilho);
  void seg;
}
