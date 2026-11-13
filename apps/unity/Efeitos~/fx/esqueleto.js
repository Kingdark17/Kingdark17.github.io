// O esqueleto do necromante surgindo: o chão abre num buraco escuro, torrões de terra espirram, caem e assentam,
// e fiapos gordos de alma verde sobem ondulando do buraco e se desfazem. O esqueleto (o seguidor do app) aparece
// no fim. Ancorado no pé: y = 0 é o chão. No estilo do Breno: tons chapados e o contorno do exporta.mjs.
import { fit, burst, fly, seg, ease, bump } from "../../core/index.js";

export const meta = {
  name: "Esqueleto surgindo",
  desc: "O chão abre num buraco, torrões de terra espirram e assentam, e fiapos de alma verde sobem ondulando e se desfazem.",
  tags: ["rpglegend", "summon", "spawn", "necromancy", "one-shot"],
  size: [128, 72],
  origin: [64, 60],
  duration: 0.95,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    terra: ["#1a0e08", "#3d2616", "#613d24", "#8a5a34", "#b07a48"],
    palette: ["#0c2a20", "#17603c", "#2fa35a", "#7ee08f", "#d8ffd8"],
    seed: 5,
  },
};

export function draw(p, t, o) {
  const T = fit(o.terra, 5), A = fit(o.palette, 5);

  // a rachadura: um risco verde no primeiro quadro, antes do buraco abrir
  if (t < 0.05) {
    p.line(-9, 0, -3, -1, A[3]);
    p.line(-3, -1, 2, 0, A[4]);
    p.line(2, 0, 9, -1, A[3]);
  }

  // o buraco: abre rápido, fica, fecha no fim
  const abre = ease.outBack(seg(t, 0, 0.12)) * (1 - ease.inQuad(seg(t, 0.7, 0.95)));
  if (abre > 0.05) {
    p.ellipse(0, 0, 12 * abre, 4 * abre, T[2]);
    p.ellipse(0, 0.5, 10 * abre, 3 * abre, T[0]);
  }

  // as almas: cada uma uma cabeça redonda clara com um rabo ondulado, se soltam do buraco, sobem e se desfazem
  burst(4, o.seed + 3, (r, i) => {
    const x0 = (i - 1.5) * 4 + r.range(-1, 1), atraso = 0.05 + i * 0.05 + r.range(0, 0.03), vida = r.range(0.45, 0.6);
    const tt = t - atraso;
    if (tt < 0 || tt > vida) return;
    const k = tt / vida, fase = r.range(0, 6.28);
    const cy = -3 - 38 * ease.outQuad(k), onda = (y) => x0 + Math.sin(fase + y * 0.3 + tt * 10) * 1.6;
    const rabo = 12 * (1 - ease.inQuad(seg(k, 0.4, 1))) + 2;
    for (let d = 1; d <= rabo; d++) {
      const y = cy + 1 + d, u = d / rabo;
      p.rect(Math.round(onda(y)), Math.round(y), u < 0.5 ? 2 : 1, 1, u < 0.35 ? A[3] : A[2]);
    }
    const raio = k < 0.75 ? 2.2 : 2.2 * (1 - seg(k, 0.75, 1)) + 0.6;
    p.circle(onda(cy), cy, raio, A[3]);
    p.circle(onda(cy) - 0.5, cy - 0.5, raio * 0.5, A[4]);
  });

  // os torrões: espirram do buraco, caem, quicam uma vez no chão e somem
  burst(10, o.seed, (r) => {
    const a = r.range(-Math.PI * 0.85, -Math.PI * 0.15), v = r.range(110, 170), atraso = r.range(0.02, 0.08), vida = r.range(0.55, 0.8);
    const tt = t - atraso;
    if (tt < 0 || tt > vida) return;
    let [x, y] = fly(r.range(-6, 6), -1, Math.cos(a) * v, Math.sin(a) * v, tt, 520, 1.5);
    if (y > 0) y = -Math.abs(Math.sin(tt * 18)) * 1.5; // no chão: quica um pouco e assenta
    const lado = tt > vida * 0.8 ? 1 : r.pick([2, 2, 3]);
    p.rect(Math.round(x), Math.round(y) - lado + 1, lado, lado, r.pick([T[2], T[3], T[3], T[4]]));
  });

  // o brilho verde da alma, que pulsa enquanto ela sobe
  const brilho = bump(t, 0.04, 0.8);
  if (brilho > 0.03) p.glow(0, -10, 22, A[2], 0.3 * brilho);
}
