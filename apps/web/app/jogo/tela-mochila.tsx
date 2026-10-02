'use client';

/**
 * Mochila e ficha: o que está equipado e o que está guardado.
 *
 * **O arranjo é o "Assim" do usuário** (2026-10-02, montado na página de
 * arranjo da mochila): a coluna larga tem o boneco com os espaços e, logo
 * embaixo, a ficha da peça escolhida; a estreita tem o guardado, com as abas
 * em texto. Antes o guardado vinha depois do boneco na coluna larga e só
 * aparecia rolando, enquanto a coluna da ficha ficava quase vazia.
 *
 * A grade seleciona, a ficha mostra o que a peça faz e é de onde as ações
 * saem. A altura é travada e a rolagem acontece por dentro de cada coluna,
 * então a mochila é uma janela sobre o jogo em vez de uma página que cresce
 * até o topo ficar longe.
 *
 * Os pontos de atributo não moram mais aqui: com a mochila aberta o painel
 * do herói perde o retrato (o boneco já está no meio) e ganha um "+" ao lado
 * de cada atributo. Ver `PainelHeroi` e `tela-jogo.tsx`.
 */

import { useState } from 'react';

import { CATEGORY_LABELS, displayName, EQUIP_SLOTS, itemCategory, type Item, type ItemCategory } from '@rpg-legend/shared';

import {
  aceitaMaoSecundaria,
  armaQueOcupaAsMaos,
  descartar,
  desequipar,
  equipar,
  equiparNoLugarDaArma,
  podeEquipar,
  podeUsar,
  slotDoItem,
  usar,
  type Mochila,
} from '@/lib/jogo/mochila';
import { CartaItem } from './carta-item';
import { Equipamento } from './equipamento';
import { FichaItem } from './ficha-item';
import styles from './jogo.module.css';
import { useFichaAVista } from './use-ficha-a-vista';

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
  // `sempre`: a ficha mora embaixo do boneco, numa coluna que rola. Escolher
  // uma carta no guardado, à direita, a deixaria fora da vista também no
  // computador.
  const ficha = useFichaAVista(selecionado, { sempre: true });

  const { hero, inventory } = mochila.estado;
  const guardados = inventory.filter((item) => !item.equipped && (aba === 'todos' || itemCategory(item) === aba));
  const resposta = mochila.log[mochila.log.length - 1];

  const vestidos = EQUIP_SLOTS.map((slot) => hero.equip[slot] as Item | null);
  const aberta = inventory.find((item) => item.uid === selecionado) ?? vestidos.find((peca) => peca?.uid === selecionado) ?? null;

  return (
    <section className={styles.loja}>
      <header className={styles.cabecalhoLoja}>
        <h1 className={styles.local}>🎒 Mochila</h1>
        <div className={styles.ladoDoCabecalho}>
          <p className={styles.ouro}>💰 {hero.gold} ouro</p>
          <button type="button" className={styles.botao} onClick={() => onFechar(mochila)}>
            Fechar
          </button>
        </div>
      </header>

      {resposta && <p className={styles.linhaDoLog}>{resposta}</p>}

      <div className={styles.navegadorDeItens}>
        <div className={styles.listaDeItens}>
          <h2 className={styles.tituloDaSecao}>Equipado</h2>
          <Equipamento hero={hero} selecionado={selecionado} onEscolher={setSelecionado} />

          {/* Embaixo do boneco, e não numa coluna própria: "Se você equipar"
              fala do corpo que está logo acima. */}
          <aside ref={ficha} className={styles.fichaDoItem} aria-label="Detalhes da peça">
            <FichaItem
              item={aberta}
              hero={hero}
              acoes={aberta && <AcoesDaPeca mochila={mochila} item={aberta} onAgir={onMochila} onSumir={() => setSelecionado(null)} />}
            />
          </aside>
        </div>

        <div className={styles.listaDeItens}>
          <h2 className={styles.tituloDaSecao}>Guardado</h2>
          {/* Texto, e não pedra: na coluna estreita os botões de pedra saíam
              um por linha, de larguras diferentes, e empurravam as cartas
              pra baixo. Pedra em duas por linha não cabe — "Consumível" não
              entra em meia coluna com a arte no dobro. */}
          <div className={styles.abasDeTexto}>
            {ABAS.map((opcao) => (
              <button
                key={opcao}
                type="button"
                aria-pressed={aba === opcao}
                className={styles.abaDeTexto}
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
 *
 * **Duas mãos ocupadas não vira botão morto.** Com uma arma de duas mãos na
 * mão principal, a mão secundária está fechada — e um "Equipar" que só
 * responde com recusa é pior que não existir. No lugar dele vem o aviso
 * dizendo qual arma ocupa, e um botão que diz o que vai acontecer se for
 * clicado. Não clicar é a resposta "não": nada acontece sozinho.
 */
function AcoesDaPeca({ mochila, item, onAgir, onSumir }: Readonly<AcoesProps>) {
  const slot = slotDoItem(mochila.estado, item);
  const armaOcupando = armaQueOcupaAsMaos(mochila.estado, item);
  // Arma leve ainda tem pra onde ir com as mãos ocupadas: a mão principal,
  // trocando pela arma de duas mãos. O escudo não — só existe pra secundária.
  const temOutroSlot = itemCategory(item) === 'arma';

  return (
    <>
      {armaOcupando && (
        <p className={styles.avisoDasMaos}>
          {displayName(armaOcupando)} ocupa as duas mãos. Para usar {displayName(item)} na mão secundária, a arma vai para a mochila.
        </p>
      )}

      {slot ? (
        <button type="button" className={styles.botao} onClick={() => onAgir(desequipar(mochila, slot))}>
          Guardar
        </button>
      ) : (
        podeEquipar(item) &&
        (!armaOcupando || temOutroSlot) && (
          <button type="button" className={styles.botao} onClick={() => onAgir(equipar(mochila, item))}>
            Equipar
          </button>
        )
      )}

      {armaOcupando && (
        <button
          type="button"
          className={`${styles.botao} ${styles.botaoPrincipal}`}
          onClick={() => onAgir(equiparNoLugarDaArma(mochila, item))}
        >
          Guardar {displayName(armaOcupando)} e equipar
        </button>
      )}

      {!slot && !armaOcupando && aceitaMaoSecundaria(item) && (
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
