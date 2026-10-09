'use client';

/**
 * A sala em quadradinhos, com o herói andando — o mapa estilo Pokémon do
 * doc do Breno. O desenho é de `lib/jogo/desenho-da-sala.ts`, com PixiJS; a
 * regra de andar é de `lib/jogo/sala-em-tiles.ts`, e quem decide o passo é
 * a tela de exploração. Este componente só liga um ao outro.
 *
 * O PixiJS é buscado aqui dentro, com `import()`, e não no topo do
 * arquivo: assim ele vira um pedaço à parte e só baixa quando a exploração
 * aparece (o guia de lazy loading do Next diz o mesmo pra biblioteca de
 * terceiros).
 *
 * O canvas é enfeite pra quem lê a tela com leitor: a narração em texto ao
 * lado continua dizendo o que tem na sala e por onde dá pra ir.
 */

import { useEffect, useRef, useState } from 'react';

import { criarCena, type Cena, type Figura, type TemaDaSala } from '@/lib/jogo/desenho-da-sala';
import type { PassoNaSala, PlantaDaSala } from '@/lib/jogo/sala-em-tiles';
import styles from './jogo.module.css';

interface Props {
  /** Muda quando o jogador troca de sala: aí o herói aparece no lugar, sem andar até lá. */
  sala: string;
  planta: PlantaDaSala;
  tema: TemaDaSala;
  conteudo: Figura | null;
  heroi: Figura;
  passo: PassoNaSala;
}

export function CenaDaSala({ sala, planta, tema, conteudo, heroi, passo }: Readonly<Props>) {
  const alvo = useRef<HTMLDivElement>(null);
  const cena = useRef<Cena | null>(null);
  const [pronta, setPronta] = useState(false);
  const salaDesenhada = useRef<string | null>(null);

  // Uma cena por boneco: trocar de raça (ADM) refaz; andar não.
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const pixi = await import('pixi.js');
      if (cancelado || !alvo.current) return;
      const criada = await criarCena(pixi, alvo.current, heroi);
      // Desmontou enquanto o PixiJS iniciava (o StrictMode faz isso no
      // desenvolvimento): a cena nasceu órfã e sai junto.
      if (cancelado) {
        criada.destruir();
        return;
      }
      cena.current = criada;
      setPronta(true);
    })();
    return () => {
      cancelado = true;
      cena.current?.destruir();
      cena.current = null;
      salaDesenhada.current = null;
      setPronta(false);
    };
  }, [heroi]);

  useEffect(() => {
    if (pronta) void cena.current?.desenharSala(planta, tema, conteudo);
  }, [pronta, planta, tema, conteudo]);

  useEffect(() => {
    if (!pronta) return;
    const mesmaSala = salaDesenhada.current === sala;
    cena.current?.colocarHeroi(passo, mesmaSala);
    salaDesenhada.current = sala;
  }, [pronta, sala, passo]);

  return <div ref={alvo} className={styles.cenaDaSala} />;
}
