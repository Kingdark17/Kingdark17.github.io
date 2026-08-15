'use client';

/**
 * Loja e ferreiro. Só desenha e rola o dado da pechincha — as regras estão
 * em `lib/jogo/loja.ts` e na engine.
 *
 * O original é um modal com três grades (comprar, vender, reforjar) e um
 * painel de detalhe. Aqui as três grades continuam, mas a reforja aparece
 * só no ferreiro, como lá.
 */

import { useState } from 'react';

import { FORGE_MATERIALS, itemView, templateById, tierFor, tierRank, TIER_ORDER, type Item } from '@rpg-legend/shared';

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
import styles from './jogo.module.css';

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

  const ehFerreiro = loja.kind === 'blacksmith';
  const aVenda = estoque(loja);
  const paraVender = vendaveis(loja);
  const daForja = reforjaveis(loja);
  const selecionado = daForja.find((item) => item.uid === paraReforjar) ?? null;
  const renovacao = precoDaRenovacao(loja);

  return (
    <section className={styles.loja}>
      <header className={styles.cabecalhoLoja}>
        <h1 className={styles.local}>{ehFerreiro ? '🔨 Ferreiro' : '🏵 Vendedor Itinerante'}</h1>
        <p className={styles.ouro}>💰 {loja.estado.hero.gold} ouro</p>
        <button type="button" className={styles.botao} onClick={() => onFechar(loja)}>
          Sair
        </button>
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

      <h2 className={styles.tituloDaSecao}>À venda</h2>
      {aVenda.length === 0 ? (
        <p className={styles.vazio}>O estoque acabou. Renove para ver mercadoria nova.</p>
      ) : (
        <div className={styles.gradeDeItens}>
          {aVenda.map((item) => {
            const preco = precoDeCompra(loja, item);
            return (
              <CartaItem
                key={item.uid}
                item={item}
                rodape={`${preco} ouro · comprar`}
                onClick={loja.estado.hero.gold >= preco ? () => onLoja(comprar(loja, item)) : undefined}
              />
            );
          })}
        </div>
      )}

      <h2 className={styles.tituloDaSecao}>Sua mochila</h2>
      {paraVender.length === 0 ? (
        <p className={styles.vazio}>Nada para vender.</p>
      ) : (
        <div className={styles.gradeDeItens}>
          {paraVender.map((item) => (
            <CartaItem key={item.uid} item={item} rodape={`${precoDeVenda(item)} ouro · vender`} onClick={() => onLoja(vender(loja, item))} />
          ))}
        </div>
      )}

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

              {selecionado && <PainelDaForja loja={loja} item={selecionado} onLoja={onLoja} />}
            </>
          )}
        </>
      )}
    </section>
  );
}

function PainelDaForja({ loja, item, onLoja }: { loja: Loja; item: Item; onLoja: (proxima: Loja) => void }) {
  const pity = item.reforgeFails ?? 0;
  const noMaximo = tierRank(item) === TIER_ORDER.length - 1;

  if (noMaximo) return <p className={styles.vazio}>🏆 {itemView(item).name} já alcançou o tier MAX.</p>;

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
