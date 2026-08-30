'use client';

/**
 * Escolha de personagem: os até 4 slots da conta, com o resumo que a API
 * extrai do save guardado na nuvem.
 *
 * Apagar personagem pede confirmação na própria carta em vez de
 * `window.confirm` (que o cliente antigo usava): o `confirm` bloqueia a
 * página inteira e não dá pra estilizar nem ler direito no celular.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { idDaRaca } from '@rpg-legend/shared';

import { apagarPersonagem, listarPersonagens, type ResumoPersonagem } from '@/lib/api/characters';
import { ErroDaApi } from '@/lib/api/client';
import { Paperdoll } from '../componentes/paperdoll';
import styles from './personagens.module.css';

function dataCurta(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? '' : data.toLocaleString('pt-BR');
}

export function ListaPersonagens() {
  const [personagens, setPersonagens] = useState<ResumoPersonagem[]>([]);
  const [maxSlots, setMaxSlots] = useState(4);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [confirmandoSlot, setConfirmandoSlot] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [versao, setVersao] = useState(0);

  // Sem token a listagem já rejeita sozinha (ver `chamarApi`), então o
  // "entre na sua conta" chega pelo mesmo `.catch` de qualquer outro erro.
  // Apagar personagem só incrementa `versao`: quem busca a lista é sempre
  // este efeito, num lugar só.
  useEffect(() => {
    listarPersonagens()
      .then((lista) => {
        setPersonagens(lista.characters);
        setMaxSlots(lista.maxSlots);
        setErro('');
      })
      .catch((falha) => setErro(falha instanceof ErroDaApi ? falha.message : 'Erro inesperado.'))
      .finally(() => setCarregando(false));
  }, [versao]);

  async function confirmarExclusao(slot: number) {
    setOcupado(true);
    try {
      await apagarPersonagem(slot);
      setConfirmandoSlot(null);
      setVersao((atual) => atual + 1);
    } catch (falha) {
      setErro(falha instanceof ErroDaApi ? falha.message : 'Erro inesperado.');
    } finally {
      setOcupado(false);
    }
  }

  if (carregando) return <p>Carregando personagens…</p>;

  const porSlot = new Map(personagens.map((personagem) => [personagem.slot, personagem]));
  const slots = Array.from({ length: maxSlots }, (_, indice) => indice + 1);

  return (
    <>
      {erro && <p className={styles.erro}>{erro}</p>}

      <ul className={styles.grade}>
        {slots.map((slot) => {
          const personagem = porSlot.get(slot);

          if (!personagem) {
            return (
              <li key={slot} className={`${styles.slot} ${styles.slotVazio}`}>
                <p className={styles.numeroSlot}>Slot {slot}</p>
                <Link className={styles.botao} href={`/personagens/novo?slot=${slot}`}>
                  Criar personagem
                </Link>
              </li>
            );
          }

          return (
            <li key={slot} className={styles.slot}>
              <p className={styles.numeroSlot}>Slot {slot}</p>

              {/* O mesmo balão da criação e do painel da partida: é o
                  personagem que a pessoa montou, e reconhecê-lo de relance
                  é metade do motivo de haver um seletor. `idDaRaca` porque
                  o save grava a raça pelo nome, e só os novos têm `raceId`. */}
              <div className={styles.retratoDoSlot}>
                <Paperdoll
                  className={styles.balaoDoBoneco}
                  raca={idDaRaca(personagem)}
                  arma={personagem.equip?.arma}
                  armadura={personagem.equip?.armadura}
                  secundaria={personagem.equip?.secundaria}
                  lado={104}
                  // Um atraso por slot: sem ele os três bonecos sobem e
                  // descem no mesmo instante e parecem uma engrenagem.
                  sinais={{ vivo: true, atraso: slot * 430 }}
                  reserva={
                    <span className={styles.reservaDoSlot} aria-hidden>
                      {personagem.raceIcon || '❔'}
                    </span>
                  }
                />
              </div>

              <h2 className={styles.nome}>{personagem.name || 'Sem nome'}</h2>
              <p className={styles.classe}>{personagem.className || 'Classe desconhecida'}</p>

              <div className={styles.numeros}>
                <span className={styles.numero}>
                  <span className={styles.valor}>{personagem.level}</span>
                  <span className={styles.chave}>Nível</span>
                </span>
                <span className={styles.numero}>
                  <span className={styles.valor}>{personagem.floor}</span>
                  <span className={styles.chave}>Andar</span>
                </span>
              </div>

              <p className={styles.atualizado}>Salvo em {dataCurta(personagem.updatedAt)}</p>

              {confirmandoSlot === slot ? (
                <div className={styles.confirmacao}>
                  <p className={styles.perguntaConfirmacao}>Apagar este personagem para sempre?</p>
                  <div className={styles.rodapeSlot}>
                    <button
                      type="button"
                      className={`${styles.botaoDiscreto} ${styles.botaoPerigo}`}
                      onClick={() => confirmarExclusao(slot)}
                      disabled={ocupado}
                    >
                      Sim, apagar
                    </button>
                    <button type="button" className={styles.botaoDiscreto} onClick={() => setConfirmandoSlot(null)} disabled={ocupado}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.rodapeSlot}>
                  <Link className={styles.botao} href={`/jogo?slot=${slot}`}>
                    Jogar
                  </Link>
                  <button type="button" className={styles.botaoDiscreto} onClick={() => setConfirmandoSlot(slot)}>
                    Apagar
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
