'use client';

/**
 * Loja e ferreiro. Só desenha e rola o dado da pechincha — as regras estão
 * em `lib/jogo/loja.ts` e na engine.
 *
 * O original é um modal com três grades (comprar, vender, reforjar) e um
 * painel de detalhe. Aqui as três grades continuam, mas a reforja aparece
 * só no ferreiro, como lá.
 *
 * **Clicar na carta seleciona; quem compra e vende é a ficha ao lado.** Era
 * o pedido do doc do Breno ("botão de confirmar pra quando quiser
 * vender/comprar"), e é o molde que o resto do jogo já seguia: a mochila
 * funciona assim, o jogo antigo também, e a própria `CartaItem` avisa que
 * "a carta não age". Só esta tela agia no primeiro clique — um toque sem
 * querer vendia a peça, sem volta. Agora o botão diz o preço e a ficha
 * mostra o que a peça muda em você antes de você pagar.
 */

import { useState } from 'react';

import { concordar, FORGE_MATERIALS, itemView, templateById, tierFor, tierRank, TIER_ORDER, type Item } from '@rpg-legend/shared';

import {
  comprar,
  estoque,
  pechinchar,
  precoDaRenovacao,
  precoDeCompra,
  precoDeVenda,
  reforjar,
  renovarEstoque,
  vendaveis,
  vender,
  type Loja,
} from '@/lib/jogo/loja';
import { CartaItem } from './carta-item';
import { FichaItem } from './ficha-item';
import styles from './jogo.module.css';
import { useFichaAVista } from './use-ficha-a-vista';

const LADOS_DO_DADO = 20;

function rolarD20(): number {
  return Math.floor(Math.random() * LADOS_DO_DADO) + 1;
}

/** Só dá pra reforjar equipamento que esteja na mochila e tenha tier. */
function reforjaveis(loja: Loja): Item[] {
  return loja.estado.inventory.filter((item) => !item.equipped && tierFor(item));
}

function quantidadeDoMaterial(loja: Loja, templateId: string): number {
  return loja.estado.inventory.filter((item) => item.templateId === templateId).length;
}

interface Props {
  loja: Loja;
  onLoja: (proxima: Loja) => void;
  onFechar: (final: Loja) => void;
}

export function TelaLoja({ loja, onLoja, onFechar }: Props) {
  const [paraReforjar, setParaReforjar] = useState<string | null>(null);
  /**
   * A peça aberta na ficha, pelo `uid` — igual à mochila. O preço e o ouro
   * são lidos **a cada desenho**, nunca guardados no clique: renovar o
   * estoque ou rolar a pechincha no meio muda os dois, e a peça pode até
   * sumir (aí a ficha simplesmente esvazia).
   */
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const ficha = useFichaAVista(selecionado);

  const ehFerreiro = loja.kind === 'blacksmith';
  const aVenda = estoque(loja);
  const paraVender = vendaveis(loja);
  const daForja = reforjaveis(loja);
  const naForja = daForja.find((item) => item.uid === paraReforjar) ?? null;
  const renovacao = precoDaRenovacao(loja);
  const ouro = loja.estado.hero.gold;

  const aComprar = aVenda.find((item) => item.uid === selecionado) ?? null;
  const aVender = aComprar ? null : (paraVender.find((item) => item.uid === selecionado) ?? null);
  const aberta = aComprar ?? aVender;

  /**
   * Toda compra e venda **fecha a ficha**. Comprar leva a peça pra mochila;
   * se ela continuasse aberta, o mesmo botão viraria "Vender" embaixo do
   * dedo, e um duplo-clique compraria e venderia de uma vez.
   */
  function agir(proxima: Loja) {
    setSelecionado(null);
    onLoja(proxima);
  }

  return (
    <section className={styles.loja}>
      <header className={styles.cabecalhoLoja}>
        <h1 className={styles.local}>{ehFerreiro ? '🔨 Ferreiro' : '🏵 Vendedor Itinerante'}</h1>
        <div className={styles.ladoDoCabecalho}>
          <p className={styles.ouro}>💰 {loja.estado.hero.gold} ouro</p>
          <button type="button" className={styles.botao} onClick={() => onFechar(loja)}>
            Sair
          </button>
        </div>
      </header>

      <p className={styles.linhaDoLog}>{loja.log[loja.log.length - 1]}</p>

      <div className={styles.escolhas}>
        {loja.descontoRolado ? (
          <span className={styles.resultadoPechincha}>
            {loja.dado !== null ? `🎲 ${loja.dado} · ` : ''}
            {loja.desconto > 0 ? `Desconto de ${Math.round(loja.desconto * 100)}%` : 'Sem desconto nesta visita'}
          </span>
        ) : (
          <button type="button" className={styles.botao} onClick={() => onLoja(pechinchar(loja, rolarD20()))}>
            🎲 Rolar dado por desconto
          </button>
        )}

        <button
          type="button"
          className={styles.botao}
          onClick={() => onLoja(renovarEstoque(loja))}
          disabled={loja.estado.hero.gold < renovacao}
        >
          Renovar estoque ({renovacao} ouro)
        </button>
      </div>

      <div className={styles.navegadorDeItens}>
        <div className={styles.listaDeItens}>
          <h2 className={styles.tituloDaSecao}>À venda</h2>
          {aVenda.length === 0 ? (
            <p className={styles.vazio}>O estoque acabou. Renove para ver mercadoria nova.</p>
          ) : (
            <div className={styles.gradeDeItens}>
              {/* Toda carta é clicável, inclusive a que você não pode pagar:
                  ver o que ela faz é de graça. Quem trava é o botão da ficha. */}
              {aVenda.map((item) => (
                <CartaItem
                  key={item.uid}
                  item={item}
                  rodape={`${precoDeCompra(loja, item)} ouro`}
                  selecionado={item.uid === selecionado}
                  onClick={() => setSelecionado(item.uid)}
                />
              ))}
            </div>
          )}

          <h2 className={styles.tituloDaSecao}>Sua mochila</h2>
          {paraVender.length === 0 ? (
            <p className={styles.vazio}>Nada para vender.</p>
          ) : (
            <div className={styles.gradeDeItens}>
              {paraVender.map((item) => (
                <CartaItem
                  key={item.uid}
                  item={item}
                  rodape={`vende por ${precoDeVenda(item)} ouro`}
                  selecionado={item.uid === selecionado}
                  onClick={() => setSelecionado(item.uid)}
                />
              ))}
            </div>
          )}
        </div>

        <aside ref={ficha} className={styles.fichaDoItem} aria-label="Detalhes da peça">
          {aberta ? (
            <FichaItem
              item={aberta}
              hero={loja.estado.hero}
              acoes={
                aComprar ? (
                  <BotaoDeCompra preco={precoDeCompra(loja, aComprar)} ouro={ouro} onComprar={() => agir(comprar(loja, aComprar))} />
                ) : (
                  <button type="button" className={styles.botao} onClick={() => agir(vender(loja, aVender as Item))}>
                    Vender por {precoDeVenda(aVender as Item)} ouro
                  </button>
                )
              }
            />
          ) : (
            <p className={styles.fichaVazia}>Escolha uma peça à venda ou da sua mochila para ver o preço e o que ela muda em você.</p>
          )}
        </aside>
      </div>

      {ehFerreiro && (
        <>
          <h2 className={styles.tituloDaSecao}>⚒️ Reforja</h2>
          {daForja.length === 0 ? (
            <p className={styles.vazio}>Desequipe uma arma, armadura ou acessório para reforjar.</p>
          ) : (
            <>
              <div className={styles.gradeDeItens}>
                {daForja.map((item) => (
                  <CartaItem
                    key={item.uid}
                    item={item}
                    rodape="selecionar"
                    selecionado={item.uid === paraReforjar}
                    onClick={() => setParaReforjar(item.uid)}
                  />
                ))}
              </div>

              {naForja && <PainelDaForja loja={loja} item={naForja} onLoja={onLoja} />}
            </>
          )}
        </>
      )}
    </section>
  );
}

/**
 * O botão de confirmar compra. Sem ouro ele fica desabilitado **e diz
 * quanto falta** — botão cinza sem explicação faz a pessoa procurar o
 * defeito na tela, não no bolso.
 */
function BotaoDeCompra({ preco, ouro, onComprar }: Readonly<{ preco: number; ouro: number; onComprar: () => void }>) {
  const falta = preco - ouro;
  return (
    <>
      {falta > 0 && <p className={styles.avisoDasMaos}>Faltam {falta} de ouro.</p>}
      <button type="button" className={`${styles.botao} ${styles.botaoPrincipal}`} onClick={onComprar} disabled={falta > 0}>
        Comprar por {preco} ouro
      </button>
    </>
  );
}

function PainelDaForja({ loja, item, onLoja }: { loja: Loja; item: Item; onLoja: (proxima: Loja) => void }) {
  const pity = item.reforgeFails ?? 0;
  const noMaximo = tierRank(item) === TIER_ORDER.length - 1;

  if (noMaximo) {
    const alcancou = concordar(item, ['alcançou', 'alcançou', 'alcançaram', 'alcançaram']);
    return (
      <p className={styles.vazio}>
        🏆 {itemView(item).name} já {alcancou} o tier MAX.
      </p>
    );
  }

  return (
    <div className={styles.caixa}>
      <div>
        <h3 className={styles.tituloCaixa}>Reforjar {itemView(item).name}</h3>
        <p className={styles.textoCaixa}>
          O resultado pode piorar, manter ou melhorar o tier. Garantia de melhoria: {Math.min(4, pity)}/4 tentativas sem sucesso.
        </p>

        <div className={styles.escolhas}>
          {Object.entries(FORGE_MATERIALS).map(([id, cfg]) => {
            const disponiveis = quantidadeDoMaterial(loja, id);
            const podeUsar = disponiveis > 0 && loja.estado.hero.gold >= cfg.cost;
            // Nome e arte do material vêm do catálogo de itens: a engine só
            // guarda custo e probabilidades por `templateId`.
            const material = templateById(id);
            return (
              <button
                key={id}
                type="button"
                className={styles.botao}
                disabled={!podeUsar}
                onClick={() => onLoja(reforjar(loja, item, id))}
                title={pity >= 4 ? 'Garantia ativa: pelo menos +1 tier' : cfg.outcomes.map(([d, p]) => `${d > 0 ? '+' : ''}${d}: ${p}%`).join(' · ')}
              >
                {material?.name ?? id}{' '}
                <span className={styles.custoDeMana}>
                  ({cfg.cost} ouro · você tem {disponiveis})
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
