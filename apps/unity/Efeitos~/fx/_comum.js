// Formas em comum dos efeitos do jogo, no estilo do Breno: gordas, poucos tons chapados (o contorno escuro vem
// do exporta.mjs). Arquivo com _ na frente: a pixelfx não o trata como efeito.
import { WHITE } from "../../core/index.js";

/** A chama em gota, como a da tocha da Caverna: a borda, o meio e o miolo, apontando pra cima. C: escuro → claro. */
export function chama(p, x, y, r, C) {
  if (r < 0.8) return;
  const gota = (rr, c) => {
    p.circle(x, y, rr, c);
    p.tri(x - rr * 0.95, y - rr * 0.2, x + rr * 0.95, y - rr * 0.2, x, y - rr * 2.3, c);
  };
  gota(r, C[1]);
  if (r > 1.6) gota(r * 0.68, C[2]);
  if (r > 2.6) gota(r * 0.38, C[4]);
}

/** A bola de fumaça: a sombra embaixo, o corpo, a luz em cima à esquerda. C: escuro → claro (6 tons). */
export function bola(p, x, y, r, C) {
  if (r < 0.8) return;
  p.circle(x + 0.5, y + 1, r, C[1]);
  p.circle(x, y, r, C[3]);
  if (r > 2) p.circle(x - r * 0.3, y - r * 0.35, r * 0.55, C[4]);
}

/** A estrelinha em cruz, 3 ou 5 px, com o miolo branco. */
export function cruzinha(p, x, y, grande, c) {
  x = Math.round(x);
  y = Math.round(y);
  p.px(x, y, WHITE);
  const n = grande ? 2 : 1;
  for (let i = 1; i <= n; i++) {
    p.px(x - i, y, c);
    p.px(x + i, y, c);
    p.px(x, y - i, c);
    p.px(x, y + i, c);
  }
}

/** O estilhaço em losango apontando no ângulo a: comprido `comp`, largo `larg`; uma face mais clara. */
export function losango(p, x, y, a, comp, larg, escuro, claro) {
  const c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
  const frente = [x + c * comp, y + s * comp], tras = [x - c * comp * 0.5, y - s * comp * 0.5];
  const l1 = [x + nx * larg, y + ny * larg], l2 = [x - nx * larg, y - ny * larg];
  p.poly([frente, l1, tras, l2], escuro);
  p.tri(frente[0], frente[1], l2[0], l2[1], x, y, claro);
}

/** A nota musical (colcheia), 6 x 7 px. */
const NOTA = ["...##.", "...#.#", "...#..", "...#..", ".###..", "####..", ".##..."];
export function nota(p, x, y, c) {
  p.sprite(NOTA, { "#": c }, Math.round(x) - 3, Math.round(y) - 6);
}

/** A seta gorda pra cima, 7 x 8 px, com o risco claro no meio. */
const SETA = ["...#...", "..###..", ".#####.", "#######", "..###..", "..###..", "..###..", "..###.."];
export function seta(p, x, y, c, claro) {
  p.sprite(SETA, { "#": c }, Math.round(x) - 3, Math.round(y) - 4);
  p.rect(Math.round(x), Math.round(y) - 3, 1, 6, claro);
}

/** O caracol do lento, 9 x 6 px: a concha (c) e o corpo (corpo). */
const CARACOL = ["..####...", ".#....#..", "#..##..#.", "#..#...#.", ".#....#.#", "ooooooooo"];
export function caracol(p, x, y, c, corpo) {
  p.sprite(CARACOL, { "#": c, o: corpo }, Math.round(x) - 4, Math.round(y) - 5);
}

/** A caveirinha, 7 x 6 px. */
const CAVEIRA = [".#####.", "#######", "#..#..#", "#######", ".##.##.", ".#.#.#."];
export function caveira(p, x, y, c) {
  p.sprite(CAVEIRA, { "#": c }, Math.round(x) - 3, Math.round(y) - 3);
}
