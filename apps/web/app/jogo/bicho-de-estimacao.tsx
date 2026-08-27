'use client';

/**
 * O bichinho no canto da tela — porta de `render()`/`love()` de
 * `js/pets.js`. Clicar solta um coração e o pet reage por um instante.
 *
 * O carinho é só enfeite: o bônus de combate do pet vem de `petBonus()`,
 * lá em `lib/jogo/combate.ts`, e não depende de ninguém clicar aqui.
 */

import { useEffect, useState } from 'react';

import { petIcon, type PetId } from '@rpg-legend/shared';

import { SpriteDePet } from '@/app/componentes/sprite-de-pet';
import { ROSTOS_DE_PET } from '@/lib/pets/rostos';
import { tocar } from '@/lib/som/efeitos';
import styles from './jogo.module.css';

/** Para arte parada, que não tem duração própria pra ditar o tempo. */
const DURACAO_DO_CARINHO_MS = 1200;

export function BichoDeEstimacao({ pet }: { pet: PetId | null }) {
  const [carinho, setCarinho] = useState(false);
  const rosto = pet ? ROSTOS_DE_PET[pet] : undefined;

  // Quem manda no tempo é a própria animação, não um número escrito aqui:
  // com a constante, arte mais longa cortaria no meio e arte mais curta
  // congelaria esperando. Cada tira traz a sua duração.
  const duracao = rosto?.coracao.duracaoMs || DURACAO_DO_CARINHO_MS;

  useEffect(() => {
    if (!carinho) return;
    const relogio = setTimeout(() => setCarinho(false), duracao);
    return () => clearTimeout(relogio);
  }, [carinho, duracao]);

  if (!pet) return null;

  return (
    <button
      type="button"
      className={`${styles.bichinho} ${carinho ? styles.bichinhoFeliz : ''}`}
      onClick={() => {
        setCarinho(true);
        tocar('heal');
      }}
      aria-label="Fazer carinho no seu pet"
    >
      {rosto ? (
        <SpriteDePet
          className={styles.rostoDoBichinho}
          animacao={carinho ? rosto.coracao : rosto.normal}
          // A reação toca uma vez e segura a pose; o estado parado repete.
          umaVez={carinho}
        />
      ) : (
        <span aria-hidden>{petIcon(pet)}</span>
      )}
      {carinho && (
        <span className={styles.coracao} aria-hidden>
          ❤
        </span>
      )}
    </button>
  );
}
