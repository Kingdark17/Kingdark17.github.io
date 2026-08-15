/**
 * Os textos da engine vêm com `<b>` no meio (nome do monstro, nome do item)
 * porque o original jogava tudo em `innerHTML`. Aqui a marcação vira
 * `<strong>` de verdade, sem `dangerouslySetInnerHTML`: o mapa e o save
 * trafegam pela rede e um dia vão vir de outro jogador no multiplayer —
 * não é lugar de confiar em HTML solto.
 */

import type { ReactNode } from 'react';

const NEGRITO = /<b>(.*?)<\/b>/g;

export function TextoDoJogo({ children }: { children: string }) {
  const partes: ReactNode[] = [];
  let fimAnterior = 0;

  for (const achado of children.matchAll(NEGRITO)) {
    const inicio = achado.index;
    if (inicio > fimAnterior) partes.push(children.slice(fimAnterior, inicio));
    partes.push(<strong key={inicio}>{achado[1]}</strong>);
    fimAnterior = inicio + achado[0].length;
  }
  partes.push(children.slice(fimAnterior));

  return <>{partes}</>;
}
