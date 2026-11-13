// A maldição sombria: uma mancha roxa abre no alvo, tentáculos gordos sobem ondulando e recolhem, e uma caveirinha
// roxa sobe e some piscando. Ancorado no ponto do golpe.
import { fit, burst, seg, ease, bump } from "../../core/index.js";
import { caveira } from "./_comum.js";

export const meta = {
  name: "Sombra",
  desc: "Uma mancha roxa abre, tentáculos sobem ondulando e recolhem, e uma caveirinha sobe e some.",
  tags: ["rpglegend", "shadow", "curse", "magic", "one-shot"],
  size: [96, 104],
  origin: [48, 64],
  duration: 0.95,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#14061f", "#3a1257", "#6b2a9c", "#a45be0", "#e0b8ff", "#ffffff"], seed: 19 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 6);
  t += 0.034; // o primeiro quadro já mostra alguma coisa

  // a mancha: abre, fica, fecha
  const abre = ease.outBack(seg(t, 0, 0.12)) * (1 - ease.inQuad(seg(t, 0.65, 0.95)));
  if (abre > 0.05) {
    p.ellipse(0, 6, 15 * abre, 5 * abre, C[2]);
    p.ellipse(0, 6.5, 12 * abre, 3.5 * abre, C[0]);
  }

  // os tentáculos: sobem da mancha ondulando, a ponta clara, e voltam pra ela
  burst(5, o.seed, (r, i) => {
    const x0 = (i - 2) * 5 + r.range(-1.5, 1.5), atraso = 0.04 + r.range(0, 0.1), vida = r.range(0.45, 0.6), tt = t - atraso;
    if (tt < 0 || tt > vida) return;
    const k = tt / vida, altura = r.range(18, 30) * Math.sin(Math.PI * Math.min(1, k * 1.15)), fase = r.range(0, 6.28);
    for (let d = 0; d < altura; d++) {
      const u = d / Math.max(1, altura), y = 5 - d, x = x0 + Math.sin(fase + d * 0.25 + tt * 12) * (1 + u * 3);
      const larg = u < 0.5 ? 3 : u < 0.85 ? 2 : 1;
      p.rect(Math.round(x - larg / 2), y, larg, 1, u > 0.8 ? C[4] : u > 0.45 ? C[3] : C[2]);
    }
  });

  // a caveirinha: sobe do meio e some piscando
  if (t > 0.15 && t < 0.85) {
    const k = seg(t, 0.15, 0.85);
    if (!(k > 0.7 && Math.floor(t * 24) % 2)) caveira(p, 0, -6 - 30 * ease.outQuad(k), k < 0.5 ? "#e0b8ff" : "#a45be0");
  }

  const brilho = bump(t, 0, 0.8);
  if (brilho > 0.03) p.glow(0, 0, 24, C[3], 0.3 * brilho);
}
