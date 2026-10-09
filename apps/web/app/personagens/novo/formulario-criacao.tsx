'use client';

/**
 * Criação de personagem: nome, raça e cabelo.
 *
 * Classe, poderes e a Roleta do Destino saíram daqui (doc do Breno,
 * 2026-10): o herói nasce Aprendiz e escolhe a classe no Treinamento de
 * Guilda, na cidade, antes de poder descer à masmorra. Ver
 * `lib/jogo/criacao.ts`.
 *
 * O herói é montado por `buildApprentice()` da engine compartilhada, dentro
 * de `montarSaveInicial` — aqui só tem tela e estado.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { RACES, type Race } from '@rpg-legend/shared';
import { ErroDaApi } from '@/lib/api/client';
import { CABELO_PADRAO, CORPOS, PENTEADOS, SEM_CABELO } from '@/lib/paperdoll/camadas';
import { gravarSave } from '@/lib/api/save';
import { criacaoVazia, faltaParaComecar, type Criacao } from '@/lib/jogo/criacao';
import { montarSaveInicial } from '@/lib/jogo/save-inicial';
import { Paperdoll } from '../../componentes/paperdoll';
import styles from './criacao.module.css';

/**
 * O que dizer embaixo do boneco. A arte está chegando por partes, e a
 * legenda diz **qual** parte falta em vez de deixar o jogador achando que
 * a tela quebrou.
 */
function legendaDoBoneco(raca: Race | null): string {
  if (!raca) return 'Escolha uma raça para ver seu herói.';
  if (!CORPOS.has(raca.id)) return `${raca.name} ainda não tem corpo desenhado.`;
  return raca.name;
}

const AVISOS: Record<NonNullable<ReturnType<typeof faltaParaComecar>>, string> = {
  nome: 'Dê um nome ao seu herói.',
  raca: 'Escolha uma raça.',
};

export function FormularioCriacao({ slot }: { slot: number }) {
  const router = useRouter();
  const [criacao, setCriacao] = useState<Criacao>(() => criacaoVazia(''));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  function escolherRaca(raca: Race) {
    setErro('');
    setCriacao((atual) => ({ ...atual, raca }));
  }

  async function comecar() {
    const falta = faltaParaComecar(criacao);
    if (falta) {
      setErro(AVISOS[falta]);
      return;
    }

    setSalvando(true);
    try {
      await gravarSave({ slot, save: montarSaveInicial(criacao) });
      router.push('/personagens');
    } catch (falha) {
      setErro(falha instanceof ErroDaApi ? falha.message : 'Erro inesperado ao salvar o personagem.');
      setSalvando(false);
    }
  }

  return (
    // A prévia vai **ao lado** das listas, e não em cima delas — pedido do
    // doc do Breno. Em cima, ela saía da tela enquanto a pessoa rolava as
    // raças. Do lado, e presa enquanto a página rola, ela acompanha cada
    // escolha.
    //
    // À esquerda e primeiro no DOM, igual à ficha do herói no jogo: é o
    // mesmo boneco nas duas telas, e reconhecer que é a mesma figura é
    // metade do ponto (ver `.balao` em `acabamento.module.css`). No celular
    // não cabe coluna, e ela volta pro topo — que é onde a ordem do DOM a
    // põe sem truque de `order`.
    <div className={styles.criacao}>
      <aside className={styles.colunaDaPrevia} aria-label="Prévia do herói">
        <div className={styles.previa}>
          <Paperdoll
            className={styles.balaoDoBoneco}
            raca={criacao.raca?.id ?? null}
            cabelo={criacao.cabelo}
            sinais={{ vivo: true }}
            reserva={
              <span className={styles.reservaDoBoneco} aria-hidden>
                {criacao.raca?.icon ?? '❔'}
              </span>
            }
          />
          <p className={styles.legendaDoBoneco}>{legendaDoBoneco(criacao.raca)}</p>
        </div>
      </aside>

      <div className={styles.colunaDoFormulario}>
        <section className={styles.secao}>
          <label className={styles.campo}>
            <span className={styles.rotulo}>Nome do herói</span>
            <input
              className={styles.entrada}
              value={criacao.nome}
              maxLength={20}
              onChange={(evento) => {
                setErro('');
                setCriacao((atual) => ({ ...atual, nome: evento.target.value }));
              }}
            />
          </label>
        </section>

        <section className={styles.secao}>
          <h2 className={styles.tituloSecao}>Raça</h2>
          <ul className={styles.grade}>
            {RACES.map((raca) => (
              <li key={raca.id}>
                <button
                  type="button"
                  className={`${styles.carta} ${criacao.raca?.id === raca.id ? styles.cartaEscolhida : ''}`}
                  aria-pressed={criacao.raca?.id === raca.id}
                  onClick={() => escolherRaca(raca)}
                >
                  {/* O corpo da raça no lugar do emoji, pedido do doc do
                      Breno: asa, cauda e orelha dizem mais que o 🧝. Com o
                      cabelo escolhido, pra carta já ser o seu herói; parado,
                      porque doze bonecos respirando juntos viram ruído. O
                      emoji fica de reserva pra raça ainda sem corpo. */}
                  <Paperdoll
                    className={styles.figuraDaRaca}
                    raca={raca.id}
                    cabelo={criacao.cabelo}
                    lado={128}
                    reserva={
                      <span className={styles.reservaDaRaca} aria-hidden>
                        {raca.icon}
                      </span>
                    }
                  />
                  <span className={styles.nomeCarta}>{raca.name}</span>
                  <span className={styles.descricao}>{raca.desc}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* A seção só existe pra quem leva cabelo desenhado. Felino e
            morto-vivo têm a cabeça resolvida na própria arte, e oferecer
            penteado que não vai aparecer seria mentir pro jogador. */}
        {criacao.raca && !SEM_CABELO.has(criacao.raca.id) && (
          <section className={styles.secao}>
            <h2 className={styles.tituloSecao}>Cabelo</h2>
            <ul className={styles.gradeDeCabelo}>
              {PENTEADOS.map((penteado) => {
                const escolhido = (criacao.cabelo ?? CABELO_PADRAO) === penteado.id;
                return (
                  <li key={penteado.id}>
                    <button
                      type="button"
                      className={`${styles.carta} ${styles.cartaDeCabelo} ${escolhido ? styles.cartaEscolhida : ''}`}
                      aria-pressed={escolhido}
                      onClick={() => setCriacao((atual) => ({ ...atual, cabelo: penteado.id }))}
                    >
                      <span
                        className={styles.amostraDeCabelo}
                        style={{ backgroundImage: `url('/img/paperdoll/cabelo/${penteado.id}.png'), url('/img/paperdoll/corpo/${criacao.raca?.id}.png')` }}
                        aria-hidden
                      />
                      <span className={styles.nomeCarta}>{penteado.nome}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className={styles.acoes}>
          <button type="button" className={styles.botao} onClick={comecar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Começar aventura'}
          </button>
        </div>

        <p className={styles.dica}>
          Você começa como Aprendiz. A classe e o primeiro poder vêm do Treinamento de Guilda, na cidade — sem ele, o portão da
          masmorra não abre.
        </p>

        {erro && <p className={styles.erro}>{erro}</p>}
      </div>
    </div>
  );
}
