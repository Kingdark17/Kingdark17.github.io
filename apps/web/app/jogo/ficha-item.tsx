'use client';

/**
 * A ficha da peça selecionada: o que ela é, o que ela dá, e **o que muda em
 * você** se vestir.
 *
 * A última parte é a razão de a ficha existir. Antes desta tela o jogador
 * equipava, olhava a ficha do herói, e desequipava se tivesse piorado — o
 * trabalho de comparar era dele. Pior: uma peça como a Armadura de Placas
 * (`{ defesa: 7, esquiva: -2 }`) sobe uma coisa e baixa outra, e a perda só
 * aparecia no combate seguinte, sem ligação visível com a troca.
 *
 * Os números vêm de `lib/jogo/impacto.ts`, que não calcula nada por conta
 * própria — ele passa o herói por `equipItem` e mede com as mesmas funções
 * que o combate usa. Ver o cabeçalho de lá.
 */

import Image from 'next/image';
import type { ReactNode } from 'react';

import { CATEGORY_LABELS, itemView, statTags, tierFor, type Hero, type Item } from '@rpg-legend/shared';

import { impactoDaPeca, type LinhaDeImpacto } from '@/lib/jogo/impacto';
import { spriteDoItem } from './carta-item';
import styles from './jogo.module.css';

const LADO_DO_SPRITE = 56;

/** Vírgula decimal, que é como o resto do jogo escreve número quebrado. */
function numero(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

function diferenca(linha: LinhaDeImpacto): string {
  // Os dois lados já chegam arredondados de `impacto.ts`; arredondar a
  // subtração evita o 0.30000000000000004 aparecer na tela.
  const delta = Math.round((linha.depois - linha.antes) * 10) / 10;
  return `${delta > 0 ? '+' : '−'}${numero(Math.abs(delta))}`;
}

interface Props {
  item: Item | null;
  hero: Hero;
  /** Botões da peça. Ficam aqui, e não na carta, pra existirem num lugar só. */
  acoes: ReactNode;
}

export function FichaItem({ item, hero, acoes }: Readonly<Props>) {
  if (!item) {
    return (
      <p className={styles.fichaVazia}>
        Escolha uma peça — equipada ou guardada — para ver o que ela faz e o que muda em você.
      </p>
    );
  }

  const visao = itemView(item);
  const tier = tierFor(item);
  const atributos = statTags(item);
  const impacto = impactoDaPeca(hero, item);

  return (
    <>
      <header className={styles.cabecalhoDaFicha}>
        <Image className={styles.spriteDaFicha} src={spriteDoItem(item)} alt="" width={LADO_DO_SPRITE} height={LADO_DO_SPRITE} unoptimized />
        <div>
          <h3 className={styles.nomeDaFicha} style={{ color: `var(${visao.rarityColorVar})` }}>
            {visao.name}
          </h3>
          <p className={styles.metaDaFicha}>
            {CATEGORY_LABELS[visao.category]} · {visao.rarityLabel}
            {tier ? ` · Tier ${tier}` : ''}
            {` · ${visao.value} ouro`}
          </p>
        </div>
      </header>

      <p className={styles.descricaoDaFicha}>{visao.desc}</p>

      {atributos.length > 0 && (
        <div className={styles.fichaStats}>
          {atributos.map((tag) => (
            // `positive` já vem da engine — é ela que sabe que `esquiva: -2`
            // é uma perda. A carta jogava esse dado fora ao juntar tudo num
            // texto só.
            <span key={tag.text} className={tag.positive ? styles.statBom : styles.statRuim}>
              {tag.text}
            </span>
          ))}
        </div>
      )}

      {/* Efeito de arma (queimadura, atordoar, sangramento...). Existe no
          item desde sempre e nunca tinha aparecido em lugar nenhum da tela. */}
      {visao.proc && (
        <p className={styles.procDaFicha}>
          {visao.proc.label} · {Math.round(visao.proc.chance * 100)}% por golpe
        </p>
      )}

      {impacto && (
        <section className={styles.impacto}>
          <h4 className={styles.tituloDoImpacto}>{impacto.acao === 'equipar' ? 'Se você equipar' : 'Se você guardar'}</h4>

          {impacto.linhas.length === 0 ? (
            // Lista vazia é informação, não ausência dela: a peça cabe no
            // slot e não muda nada em você.
            <p className={styles.impactoNulo}>Não muda nenhum dos seus números.</p>
          ) : (
            <ul className={styles.listaDoImpacto}>
              {impacto.linhas.map((linha) => {
                const melhorou = linha.depois > linha.antes;
                return (
                  <li key={linha.rotulo} className={styles.linhaDoImpacto}>
                    <span className={styles.rotuloDoImpacto}>{linha.rotulo}</span>
                    <span className={styles.numerosDoImpacto}>
                      {numero(linha.antes)} → {numero(linha.depois)}
                    </span>
                    <span className={melhorou ? styles.melhor : styles.pior}>{diferenca(linha)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <div className={styles.acoesDaFicha}>{acoes}</div>
    </>
  );
}
