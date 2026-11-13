// A cura: um anel de luz verde sobe do pé à cabeça, e cruzes gordas (+) aparecem em volta do corpo, sobem e
// piscam antes de sumir, com um brilho verde no chão. Ancorado no pé: y = 0 é o chão. Tons chapados e o
// contorno do exporta.mjs, como a arte do Breno.
import { fit, burst, seg, ease, bump, WHITE } from "../../core/index.js";

export const meta = {
  name: "Cura",
  desc: "Um anel verde sobe pelo corpo e cruzes gordas sobem em volta, piscando antes de sumir.",
  tags: ["rpglegend", "heal", "buff", "one-shot"],
  size: [64, 72],
  origin: [32, 64],
  duration: 1.1,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#0b3d1a", "#1e8a3a", "#3fd15a", "#a6ff8a", "#ffffff"], seed: 2 },
};

/** A cruz: braços de 2 px, 7 px de ponta a ponta; pequena, 5 px com braços de 1. */
function cruz(p, x, y, grande, C) {
  x = Math.round(x);
  y = Math.round(y);
  if (grande) {
    p.rect(x - 3, y - 1, 7, 2, C[3]);
    p.rect(x - 1, y - 3, 2, 7, C[3]);
    p.rect(x - 1, y - 1, 2, 2, WHITE);
  } else {
    p.rect(x - 2, y, 5, 1, C[3]);
    p.rect(x, y - 2, 1, 5, C[3]);
    p.px(x, y, WHITE);
  }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 5);

  // o anel: sobe do pé até acima da cabeça, se estreitando
  if (t < 0.45) {
    const k = ease.outQuad(seg(t, 0, 0.45)), y = -36 * k, rx = 12 - 4 * k;
    // a metade de trás mais escura, a da frente clara (o corpo fica no meio)
    for (let g = 0; g < Math.PI * 2; g += 0.05) {
      const x = Math.cos(g) * rx, yy = y + Math.sin(g) * 3;
      p.px(x, yy, Math.sin(g) < 0 ? C[2] : k < 0.7 ? WHITE : C[3]);
      p.px(x, yy + 1, Math.sin(g) < 0 ? C[1] : C[3]);
    }
  }

  // as cruzes: aparecem em volta do corpo em sequência, sobem e piscam
  burst(7, o.seed, (r, i) => {
    const atraso = 0.08 + i * 0.07 + r.range(0, 0.04), vida = r.range(0.38, 0.5);
    const tt = t - atraso;
    if (tt < 0 || tt > vida) return;
    if (tt > vida * 0.65 && Math.floor(tt * 24) % 2) return;
    const lado = i % 2 ? 1 : -1, x = lado * r.range(5, 13), y = -r.range(6, 30) - 16 * ease.outQuad(tt / vida);
    cruz(p, x, y, i % 3 === 0, C);
  });

  // o brilho no chão e no corpo
  const brilho = bump(t, 0, 0.8);
  if (brilho > 0.03) {
    p.glow(0, -2, 18, C[2], 0.3 * brilho);
    p.glow(0, -18, 16, C[3], 0.15 * brilho);
  }
}
