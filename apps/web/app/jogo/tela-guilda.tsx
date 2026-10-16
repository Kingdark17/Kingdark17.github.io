'use client';

/**
 * O Treinamento de Guilda: o Aprendiz escolhe a classe.
 *
 * O molde é o da loja e da mochila — a grade seleciona, a ficha ao lado
 * mostra o que a escolha dá e é dela que a ação sai. Escolher classe é a
 * decisão mais pesada do personagem e não tem volta, então a carta só
 * seleciona: quem treina é o botão da ficha, que diz o nome da classe.
 *
 * Quem já tem classe vê a dele e mais nada. Ver `jogo/guilda.ts` (na engine).
 */

import Image from 'next/image';
import { useState } from 'react';

import {
  ATTR_LABELS,
  CLASSES,
  POWERS,
  hasClass,
  powerById,
  templateById,
  treinar,
  type AttrKey,
  type ClassDef,
  type Guilda,
  type Power,
} from '@rpg-legend/shared';

import styles from './jogo.module.css';
import { useFichaAVista } from './use-ficha-a-vista';

interface Props {
  guilda: Guilda;
  onGuilda: (proxima: Guilda) => void;
  onFechar: (final: Guilda) => void;
}

/** Os poderes que a classe dá: o dela e os que só ela tem (a Canção de Batalha do bardo). */
function poderesDaClasse(classe: ClassDef): Power[] {
  const assinatura = powerById(classe.signatureId);
  const exclusivos = POWERS.filter((poder) => poder.soDaClasse === classe.id && poder.id !== classe.signatureId);
  return [...(assinatura ? [assinatura] : []), ...exclusivos];
}

function vies(classe: ClassDef): string {
  return (Object.entries(classe.bias) as [AttrKey, number][]).map(([chave, valor]) => `+${valor} ${ATTR_LABELS[chave]}`).join(' · ');
}

export function TelaGuilda({ guilda, onGuilda, onFechar }: Readonly<Props>) {
  const { hero } = guilda.estado;
  const treinado = hasClass(hero);
  const [escolhida, setEscolhida] = useState<ClassDef | null>(null);
  const ficha = useFichaAVista(escolhida?.id ?? null);
  const resposta = guilda.log[guilda.log.length - 1];

  return (
    <section className={styles.loja}>
      <header className={styles.cabecalhoLoja}>
        <h1 className={styles.local}>⚜️ Guilda dos Aventureiros</h1>
        <button type="button" className={styles.botao} onClick={() => onFechar(guilda)}>
          Sair
        </button>
      </header>

      {resposta && <p className={styles.linhaDoLog}>{resposta}</p>}

      {treinado ? (
        <p className={styles.textoDaGuilda}>
          Você é {hero.classIcon} {hero.className}. A guilda segue de portas abertas, mas o treinamento de classe se faz uma vez só.
        </p>
      ) : (
        <>
          <p className={styles.textoDaGuilda}>
            Escolha sua classe. Ela dá sua arma inicial, soma atributos e ensina seu primeiro poder — e vale para sempre.
          </p>

          <div className={styles.navegadorDeItens}>
            <div className={styles.listaDeItens}>
              <div className={styles.gradeDeItens}>
                {CLASSES.map((classe) => (
                  <button
                    key={classe.id}
                    type="button"
                    className={`${styles.cartaItem} ${styles.cartaClicavel} ${escolhida?.id === classe.id ? styles.cartaSelecionada : ''}`}
                    aria-pressed={escolhida?.id === classe.id}
                    onClick={() => setEscolhida(classe)}
                  >
                    <span className={styles.iconeDaCarta} aria-hidden>
                      {classe.icon}
                    </span>
                    <span className={styles.nomeItem}>{classe.name}</span>
                    <span className={styles.metaItem}>{classe.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <aside ref={ficha} className={styles.fichaDoItem} aria-label="Detalhes da classe">
              {escolhida ? (
                <FichaDaClasse classe={escolhida} onTreinar={() => onGuilda(treinar(guilda, escolhida))} />
              ) : (
                <p className={styles.fichaVazia}>Escolha uma classe para ver o que a guilda ensina.</p>
              )}
            </aside>
          </div>
        </>
      )}
    </section>
  );
}

function FichaDaClasse({ classe, onTreinar }: Readonly<{ classe: ClassDef; onTreinar: () => void }>) {
  const arma = templateById(classe.weaponTemplate);

  return (
    <>
      <header className={styles.cabecalhoDaFicha}>
        <span className={styles.iconeDaClasse} aria-hidden>
          {classe.icon}
        </span>
        <div>
          <h3 className={styles.nomeDaFicha}>{classe.name}</h3>
          <p className={styles.descricaoDaFicha}>{classe.desc}</p>
        </div>
      </header>

      <section className={styles.impacto}>
        <h4 className={styles.tituloDoImpacto}>O que a guilda ensina</h4>
        <ul className={styles.listaDoImpacto}>
          {arma && (
            <li className={`${styles.linhaDaGuilda} ${styles.linhaDaArma}`}>
              <span className={styles.rotuloDaGuilda}>Arma</span>
              <span className={styles.armaDaGuilda}>
                <Image className={styles.spriteItem} src={`/img/${arma.sprite}`} alt="" width={32} height={32} unoptimized />
                {arma.name}
              </span>
            </li>
          )}
          {poderesDaClasse(classe).map((poder) => (
            <li key={poder.id} className={styles.linhaDaGuilda}>
              <span className={styles.rotuloDaGuilda}>Poder</span>
              <span>
                {poder.icon} {poder.name} <span className={`${styles.custoDeMana} ${styles.custoDoPoder}`}>({poder.cost} MP)</span>
                <span className={styles.descricaoDoPoder}>{poder.desc}</span>
              </span>
            </li>
          ))}
          <li className={styles.linhaDaGuilda}>
            <span className={styles.rotuloDaGuilda}>Atributos</span>
            <span>{vies(classe)}</span>
          </li>
        </ul>
      </section>

      <div className={styles.acoesDaFicha}>
        <button type="button" className={`${styles.botao} ${styles.botaoPrincipal}`} onClick={onTreinar}>
          Treinar como {classe.name}
        </button>
      </div>
    </>
  );
}
