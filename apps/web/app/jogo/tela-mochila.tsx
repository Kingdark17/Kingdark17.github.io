'use client';

/**
 * Mochila e ficha: o que está equipado, o que está guardado, e os pontos
 * de atributo esperando pra serem gastos.
 *
 * O level up do jogo é manual — 2 pontos por nível, distribuídos aqui.
 * Sem esta tela o jogador subia de nível e os pontos ficavam parados.
 */

import { useState } from 'react';

import {
  ATTR_KEYS,
  ATTR_LABELS,
  CATEGORY_LABELS,
  EQUIP_SLOTS,
  itemCategory,
  type AttrKey,
  type EquipSlot,
  type Item,
  type ItemCategory,
} from '@rpg-legend/shared';

import { aceitaMaoSecundaria, descartar, desequipar, equipar, gastarPonto, podeEquipar, podeUsar, usar, type Mochila } from '@/lib/jogo/mochila';
import { CartaItem } from './carta-item';
import styles from './jogo.module.css';

const ROTULO_DO_SLOT: Record<EquipSlot, string> = {
  arma: 'Arma',
  secundaria: 'Secundária',
  armadura: 'Armadura',
  acessorio: 'Acessório',
};

type Aba = 'todos' | ItemCategory;

const ABAS: Aba[] = ['todos', 'arma', 'armadura', 'acessorio', 'consumivel', 'material'];

function rotuloDaAba(aba: Aba): string {
  return aba === 'todos' ? 'Todos' : CATEGORY_LABELS[aba];
}

interface Props {
  mochila: Mochila;
  onMochila: (proxima: Mochila) => void;
  onFechar: (final: Mochila) => void;
}

export function TelaMochila({ mochila, onMochila, onFechar }: Props) {
  const [aba, setAba] = useState<Aba>('todos');

  const { hero, inventory } = mochila.estado;
  const guardados = inventory.filter((item) => !item.equipped && (aba === 'todos' || itemCategory(item) === aba));
  const resposta = mochila.log[mochila.log.length - 1];

  return (
    <section className={styles.loja}>
      <header className={styles.cabecalhoLoja}>
        <h1 className={styles.local}>🎒 Mochila</h1>
        <p className={styles.ouro}>💰 {hero.gold} ouro</p>
        <button type="button" className={styles.botao} onClick={() => onFechar(mochila)}>
          Fechar
        </button>
      </header>

      {resposta && <p className={styles.linhaDoLog}>{resposta}</p>}

      <h2 className={styles.tituloDaSecao}>Equipado</h2>
      <div className={styles.gradeDeItens}>
        {EQUIP_SLOTS.map((slot) => {
          const peca = hero.equip[slot] as Item | null;
          if (!peca) {
            return (
              <div key={slot} className={`${styles.cartaItem} ${styles.slotVazio}`}>
                <span className={styles.metaItem}>{ROTULO_DO_SLOT[slot]}</span>
                <span className={styles.nomeItem}>vazio</span>
              </div>
            );
          }
          return (
            <CartaItem
              key={slot}
              item={peca}
              rodape={`${ROTULO_DO_SLOT[slot]} · guardar`}
              onClick={() => onMochila(desequipar(mochila, slot))}
            />
          );
        })}
      </div>

      {hero.attrPoints > 0 && (
        <>
          <h2 className={styles.tituloDaSecao}>Subiu de nível: {hero.attrPoints} ponto(s) para distribuir</h2>
          <div className={styles.escolhas}>
            {ATTR_KEYS.map((chave: AttrKey) => (
              <button key={chave} type="button" className={styles.botao} onClick={() => onMochila(gastarPonto(mochila, chave))}>
                + {ATTR_LABELS[chave]} <span className={styles.custoDeMana}>({hero.attrs[chave]})</span>
              </button>
            ))}
          </div>
        </>
      )}

      <h2 className={styles.tituloDaSecao}>Guardado</h2>
      <div className={styles.escolhas}>
        {ABAS.map((opcao) => (
          <button
            key={opcao}
            type="button"
            className={`${styles.botao} ${aba === opcao ? styles.botaoPrincipal : ''}`}
            onClick={() => setAba(opcao)}
          >
            {rotuloDaAba(opcao)}
          </button>
        ))}
      </div>

      {guardados.length === 0 ? (
        <p className={styles.vazio}>Nada aqui.</p>
      ) : (
        <div className={styles.gradeDeItens}>
          {guardados.map((item) => (
            <CartaItem
              key={item.uid}
              item={item}
              acoes={
                <>
                  {podeEquipar(item) && (
                    <button type="button" className={styles.botaoDiscreto} onClick={() => onMochila(equipar(mochila, item))}>
                      Equipar
                    </button>
                  )}
                  {aceitaMaoSecundaria(item) && (
                    <button type="button" className={styles.botaoDiscreto} onClick={() => onMochila(equipar(mochila, item, 'secundaria'))}>
                      Mão secundária
                    </button>
                  )}
                  {podeUsar(item) && (
                    <button type="button" className={styles.botaoDiscreto} onClick={() => onMochila(usar(mochila, item))}>
                      Usar
                    </button>
                  )}
                  <button type="button" className={styles.botaoDiscreto} onClick={() => onMochila(descartar(mochila, item))}>
                    Descartar
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
