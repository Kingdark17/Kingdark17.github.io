// Lento: um caracolzinho aparece em cima da cabeça, balança devagar e some piscando, enquanto gotas de gosma
// azul escorrem pra baixo. Ancorado na cabeça.
import { fit, burst, seg, ease } from "../../core/index.js";
import { caracol } from "./_comum.js";

export const meta = {
  name: "Lento",
  desc: "Um caracolzinho aparece em cima da cabeça e balança devagar enquanto gotas azuis escorrem.",
  tags: ["rpglegend", "status", "slow", "one-shot"],
  size: [56, 64],
  origin: [28, 24],
  duration: 1.0,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#0a2a4a", "#1f5fa8", "#3fa9f5", "#9bdcff", "#e6f7ff", "#ffffff"], seed: 47 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 6);

  // as gotas: escorrem devagar pelos lados
  burst(4, o.seed, (r, i) => {
    const tt = t - 0.05 - i * 0.1, vida = 0.5;
    if (tt < 0 || tt > vida) return;
    const x = (i % 2 ? 1 : -1) * r.range(6, 11), y = 4 + 26 * ease.inQuad(tt / vida);
    p.rect(Math.round(x), Math.round(y), 2, tt < vida * 0.6 ? 3 : 2, C[2]);
    p.px(Math.round(x), Math.round(y), C[4]);
  });

  // o caracol: sobe um pouco, balança e some piscando
  const entra = ease.outBack(seg(t, -0.03, 0.2));
  if (t < 0.9 && !(t > 0.7 && Math.floor(t * 24) % 2)) caracol(p, Math.sin(t * 5) * 2, -4 - 6 * entra, "#9bdcff", "#3fa9f5");
}
