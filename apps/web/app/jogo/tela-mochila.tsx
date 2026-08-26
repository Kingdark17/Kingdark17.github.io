'use client';

/**
 * Mochila e ficha: o que está equipado, o que está guardado, e os pontos
 * de atributo esperando pra serem gastos.
 *
 * O level up do jogo é manual — 2 pontos por nível, distribuídos aqui.
 * Sem esta tela o jogador subia de nível e os pontos ficavam parados.
 *
 * **Duas colunas, como no jogo antigo** (`.item-browser-layout`): a grade
 * seleciona, a ficha ao lado mostra o que a peça faz e é de onde as ações
 * saem. A altura é travada e a rolagem acontece por dentro, então a
 * mochila é uma janela sobre o jogo em vez de uma página que cresce até o
 * topo ficar longe.
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

import {
  aceitaMaoSecundaria,
  descartar,
  desequipar,
  equipar,
  gastarPonto,
  podeEquipar,
  podeUsar,
  slotDoItem,
  usar,
  type Mochila,
} from '@/lib/jogo/mochila';
import { CartaItem } from './carta-item';
import { FichaItem } from './ficha-item';
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
  /**
   * A seleção é o `uid`, não o objeto: toda ação devolve um estado novo com
   * itens novos, e guardar a referência deixaria a ficha presa na versão
   * anterior da peça. Pelo `uid`, equipar mantém a mesma peça aberta e a
   * ficha passa sozinha de "Se você equipar" pra "Se você guardar".
   */
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const { hero, inventory } = mochila.estado;
  const guardados = inventory.filter((item) => !item.equipped && (aba === 'todos' || itemCategory(item) === aba));
  const resposta = mochila.log[mochila.log.length - 1];

  const vestidos = EQUIP_SLOTS.map((slot) => ({ slot, peca: hero.equip[slot] as Item | null }));
  const aberta =
    inventory.find((item) => item.uid === selecionado) ?? vestidos.find(({ peca }) => peca?.uid === selecionado)?.peca ?? null;

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

      <div className={styles.navegadorDeItens}>
        <div className={styles.listaDeItens}>
          <h2 className={styles.tituloDaSecao}>Equipado</h2>
          <div className={styles.gradeDeItens}>
            {vestidos.map(({ slot, peca }) =>
              peca ? (
                <CartaItem
                  key={slot}
                  item={peca}
                  rodape={ROTULO_DO_SLOT[slot]}
                  selecionado={peca.uid === selecionado}
                  onClick={() => setSelecionado(peca.uid)}
                />
              ) : (
                <div key={slot} className={`${styles.cartaItem} ${styles.slotVazio}`}>
                  <span className={styles.metaItem}>{ROTULO_DO_SLOT[slot]}</span>
                  <span className={styles.nomeItem}>vazio</span>
                </div>
              ),
            )}
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
                aria-pressed={aba === opcao}
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
                  selecionado={item.uid === selecionado}
                  onClick={() => setSelecionado(item.uid)}
                />
              ))}
            </div>
          )}
        </div>

        <aside className={styles.fichaDoItem} aria-label="Detalhes da peça">
          <FichaItem
            item={aberta}
            hero={hero}
            acoes={aberta && <AcoesDaPeca mochila={mochila} item={aberta} onAgir={onMochila} onSumir={() => setSelecionado(null)} />}
          />
        </aside>
      </div>
    </section>
  );
}

interface AcoesProps {
  mochila: Mochila;
  item: Item;
  onAgir: (proxima: Mochila) => void;
  onSumir: () => void;
}

/**
 * Os botões da peça aberta. Ficam num lugar só — antes eram repetidos em
 * cada carta da grade.
 *
 * Descartar limpa a seleção porque a peça deixa de existir; as outras
 * ações a mantêm, e a ficha se reescreve sozinha ao redor da mesma peça.
 */
function AcoesDaPeca({ mochila, item, onAgir, onSumir }: Readonly<AcoesProps>) {
  const slot = slotDoItem(mochila.estado, item);

  return (
    <>
      {slot ? (
        <button type="button" className={styles.botao} onClick={() => onAgir(desequipar(mochila, slot))}>
          Guardar
        </button>
      ) : (
        podeEquipar(item) && (
          <button type="button" className={styles.botao} onClick={() => onAgir(equipar(mochila, item))}>
            Equipar
          </button>
        )
      )}

      {!slot && aceitaMaoSecundaria(item) && (
        <button type="button" className={styles.botaoDiscreto} onClick={() => onAgir(equipar(mochila, item, 'secundaria'))}>
          Mão secundária
        </button>
      )}

      {podeUsar(item) && (
        <button type="button" className={styles.botao} onClick={() => onAgir(usar(mochila, item))}>
          Usar
        </button>
      )}

      <button
        type="button"
        className={styles.botaoDiscreto}
        onClick={() => {
          onAgir(descartar(mochila, item));
          onSumir();
        }}
      >
        Descartar
      </button>
    </>
  );
}
