'use client';

/**
 * O bichinho no canto da tela — porta de `render()`/`love()` de
 * `js/pets.js`. Clicar solta um coração; o dragão filhote troca de rosto
 * por um instante, que é o único pet com arte própria (`img/pets/`).
 *
 * O carinho é só enfeite: o bônus de combate do pet vem de `petBonus()`,
 * lá em `lib/jogo/combate.ts`, e não depende de ninguém clicar aqui.
 */

import { useEffect, useState } from 'react';

import { petIcon, type PetId } from '@rpg-legend/shared';

import { tocar } from '@/lib/som/efeitos';
import styles from './jogo.module.css';

const ROSTOS: Partial<Record<PetId, { normal: string; coracao: string }>> = {
  baby_dragon: { normal: '/img/pets/dragon-normal.png', coracao: '/img/pets/dragon-heart.png' },
};

const DURACAO_DO_CARINHO_MS = 1200;

export function BichoDeEstimacao({ pet }: { pet: PetId | null }) {
  const [carinho, setCarinho] = useState(false);

  useEffect(() => {
    if (!carinho) return;
    const relogio = setTimeout(() => setCarinho(false), DURACAO_DO_CARINHO_MS);
    return () => clearTimeout(relogio);
  }, [carinho]);

  if (!pet) return null;

  const rosto = ROSTOS[pet];

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
        /* eslint-disable-next-line @next/next/no-img-element */
        <img className={styles.rostoDoBichinho} src={carinho ? rosto.coracao : rosto.normal} alt="" />
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
