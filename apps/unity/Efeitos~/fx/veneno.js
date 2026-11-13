// Os esporos venenosos: uma nuvem verde baixa, bolhas gordas que sobem balançando e estouram em anelzinhos,
// esporos pontilhando em volta e gotas que caem. Ancorado no ponto do golpe.
import { fit, burst, fly, seg, ease, bump, WHITE } from "../../core/index.js";

export const meta = {
  name: "Veneno",
  desc: "Uma nuvem verde, bolhas gordas sobem balançando e estouram, esporos pontilham e gotas caem.",
  tags: ["rpglegend", "poison", "magic", "one-shot"],
  size: [96, 112],
  origin: [48, 64],
  duration: 1.0,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#0f2a08", "#2f6b12", "#5fb31e", "#a8e83a", "#e8ffb0", "#ffffff"], seed: 23 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 6);
  t += 0.034; // o primeiro quadro já mostra alguma coisa

  // a nuvem baixa do começo
  if (t < 0.35) {
    const k = seg(t, 0, 0.35), r = 10 * ease.outCubic(Math.min(1, k * 2)) * (1 - ease.inQuad(seg(k, 0.5, 1)));
    if (r > 1) {
      p.circle(-6, 2, r * 0.8, C[2]);
      p.circle(6, 2, r * 0.8, C[2]);
      p.circle(0, -2, r, C[3]);
      p.circle(-2, -4, r * 0.45, C[4]);
    }
  }

  // as bolhas: sobem balançando, crescem e estouram num anel
  burst(7, o.seed, (r) => {
    const atraso = r.range(0.04, 0.3), vida = r.range(0.35, 0.55), tt = t - atraso;
    if (tt < 0) return;
    const x0 = r.range(-14, 14), sobe = r.range(40, 70), fase = r.range(0, 6);
    const x = x0 + Math.sin(tt * 10 + fase) * 2.5, y = r.range(-4, 6) - sobe * tt;
    const raio = r.range(2.5, 4.5) * Math.min(1, tt / 0.1);
    if (tt <= vida) {
      p.circle(x, y, raio, C[3]);
      p.circle(x - raio * 0.35, y - raio * 0.35, Math.max(0.6, raio * 0.35), C[5]);
    } else if (tt <= vida + 0.08) {
      p.ring(x, y, raio + 2 * seg(tt, vida, vida + 0.08) + 1, 1, C[4]);
    }
  });

  // os esporos
  burst(12, o.seed + 4, (r) => {
    const a = r.range(0, Math.PI * 2), v = r.range(30, 80), vida = r.range(0.5, 0.8), tt = t - r.range(0.05, 0.2);
    if (tt < 0 || tt > vida) return;
    if (tt > vida * 0.6 && Math.floor(tt * 20) % 2) return;
    const [x, y] = fly(0, 0, Math.cos(a) * v, Math.sin(a) * v, tt, -20, 3);
    p.px(x, y, r.pick([C[4], C[3], WHITE]));
  });

  // as gotas que caem
  burst(4, o.seed + 9, (r) => {
    const tt = t - r.range(0.1, 0.3), vida = 0.4;
    if (tt < 0 || tt > vida) return;
    const [x, y] = fly(r.range(-10, 10), 4, r.range(-20, 20), -20, tt, 400, 0);
    p.rect(Math.round(x), Math.round(y), 2, 3, C[2]);
  });

  const brilho = bump(t, 0, 0.7);
  if (brilho > 0.03) p.glow(0, 0, 22, C[3], 0.25 * brilho);
}
