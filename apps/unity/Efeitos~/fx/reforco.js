// Os reforços no herói (os poderes que não batem): um brilho sobe do pé, e a forma diz qual — setas subindo
// (força), uma mira que fecha nele (precisão), redemoinhos de vento (esquiva), uma bolha de escudo (escudo) ou
// fumaça escura subindo do corpo (crítico). Ancorado no pé: y = 0 é o chão.
import { fit, burst, seg, ease, bump, WHITE } from "../../core/index.js";
import { seta, cruzinha } from "./_comum.js";

export const meta = {
  name: "Reforço",
  desc: "Um brilho sobe do pé e a forma do reforço aparece em volta do herói: setas, mira, vento, bolha ou fumaça.",
  tags: ["rpglegend", "buff", "one-shot"],
  size: [80, 88],
  origin: [40, 76],
  duration: 1.0,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#5c1208", "#ed1c24", "#ff9404", "#ffc20e", "#fff200", "#ffffff"], forma: "setas", seed: 41 },
};

const MEIO = -16; // o meio do corpo

export function draw(p, t, o) {
  const C = fit(o.palette, 6);

  // o anel do pé, que abre e some (todos têm)
  if (t < 0.3) {
    const k = seg(t, 0, 0.3);
    p.ellipse(0, 0, 6 + 10 * ease.outCubic(k), 2 + 3 * ease.outCubic(k), k < 0.5 ? C[3] : C[2]);
    p.ellipse(0, 0, 4 + 9 * ease.outCubic(k), 1 + 2.5 * ease.outCubic(k), C[0]);
  }

  if (o.forma === "setas") {
    // setas gordas sobem em volta do corpo, uma de cada vez
    burst(5, o.seed, (r, i) => {
      const atraso = 0.05 + i * 0.1, vida = 0.45, tt = t - atraso;
      if (tt < 0 || tt > vida) return;
      if (tt > vida * 0.7 && Math.floor(tt * 24) % 2) return;
      const x = (i % 2 ? 1 : -1) * r.range(7, 13), y = -r.range(2, 10) - 30 * ease.outQuad(tt / vida);
      seta(p, x, y, C[3], C[4]);
    });
  } else if (o.forma === "mira") {
    // uma mira grande fecha no herói e trava com um brilho
    const k = ease.outCubic(seg(t, 0, 0.35)), r = 26 - 15 * k;
    if (t < 0.75 && !(t > 0.55 && Math.floor(t * 24) % 2)) {
      p.ring(0, MEIO, r, 2, C[3]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.rect(Math.round(dx * (r + 1)) - (dx ? 2 : 1), Math.round(MEIO + dy * (r + 1)) - (dy ? 2 : 1), dx ? 5 : 2, dy ? 5 : 2, C[4]);
    }
    if (t > 0.33 && t < 0.5) cruzinha(p, 8, MEIO - 10, true, C[4]);
  } else if (o.forma === "vento") {
    // riscos brancos curvos giram em volta do corpo, subindo
    burst(4, o.seed, (r, i) => {
      const atraso = i * 0.08, vida = 0.5, tt = t - atraso;
      if (tt < 0 || tt > vida) return;
      const k = tt / vida, a0 = r.range(0, 6.28) + k * 6, y = -4 - 26 * k, comp = 1.4 * Math.sin(Math.PI * k);
      p.arc(0, y, 12, 2, a0, a0 + comp, k < 0.5 ? C[5] : C[4]);
    });
  } else if (o.forma === "bolha") {
    // a bolha do escudo: um hexágono grande aparece, brilha e some piscando
    const k = ease.outBack(seg(t, 0.02, 0.22));
    if (t < 0.85 && !(t > 0.6 && Math.floor(t * 24) % 2) && k > 0.05) {
      const pts = [];
      for (let i = 0; i < 6; i++) pts.push([Math.cos((i / 6) * Math.PI * 2 + Math.PI / 6) * 17 * k, MEIO + Math.sin((i / 6) * Math.PI * 2 + Math.PI / 6) * 19 * k]);
      for (let i = 0; i < 6; i++) p.beam(pts[i][0], pts[i][1], pts[(i + 1) % 6][0], pts[(i + 1) % 6][1], 1.4, C[3]);
      p.line(pts[4][0] + 2, pts[4][1] + 3, pts[5][0] - 1, pts[5][1] + 4, WHITE);
    }
  } else if (o.forma === "fumaca") {
    // fiapos escuros sobem do corpo, ondulando
    burst(6, o.seed, (r, i) => {
      const atraso = i * 0.06 + r.range(0, 0.05), vida = r.range(0.45, 0.6), tt = t - atraso;
      if (tt < 0 || tt > vida) return;
      const k = tt / vida, x0 = (i - 2.5) * 4, topo = -6 - 34 * ease.outQuad(k), base = -2 - 30 * ease.inQuad(seg(k, 0.3, 1));
      for (let y = base; y > topo; y--) {
        const u = (base - y) / Math.max(1, base - topo);
        p.rect(Math.round(x0 + Math.sin(y * 0.3 + tt * 9 + i) * 1.5), y, u < 0.6 ? 2 : 1, 1, u > 0.7 ? C[4] : u > 0.35 ? C[3] : C[2]);
      }
    });
  }

  const brilho = bump(t, 0, 0.7);
  if (brilho > 0.03) p.glow(0, MEIO, 20, C[3], 0.25 * brilho);
}
