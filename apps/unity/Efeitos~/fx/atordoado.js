// Atordoado: três estrelas amarelas giram em volta da cabeça, numa elipse, e somem piscando. Ancorado na cabeça.
import { fit, seg, ease } from "../../core/index.js";
import { cruzinha } from "./_comum.js";

export const meta = {
  name: "Atordoado",
  desc: "Três estrelas amarelas giram em volta da cabeça e somem piscando.",
  tags: ["rpglegend", "status", "stun", "one-shot"],
  size: [56, 40],
  origin: [28, 24],
  duration: 1.0,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#5c1208", "#ed1c24", "#ff9404", "#ffc20e", "#fff200", "#ffffff"], seed: 43 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 6);
  const entra = ease.outBack(seg(t, -0.03, 0.15));
  if (t > 0.92 || (t > 0.75 && Math.floor(t * 24) % 2)) return;
  for (let i = 0; i < 3; i++) {
    const a = t * 7 + (i / 3) * Math.PI * 2, x = Math.cos(a) * 12 * entra, y = Math.sin(a) * 4 * entra;
    cruzinha(p, x, y, Math.sin(a) > 0, Math.sin(a) > 0 ? C[4] : C[3]);
  }
}
