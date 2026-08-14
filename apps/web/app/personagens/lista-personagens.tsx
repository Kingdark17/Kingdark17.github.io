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
import { useCallback, useEffect, useState } from 'react';

import { apagarPersonagem, listarPersonagens, type ResumoPersonagem } from '@/lib/api/characters';
import { ErroDaApi } from '@/lib/api/client';
import { lerToken } from '@/lib/api/session';
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

  const recarregar = useCallback(async () => {
    try {
      const lista = await listarPersonagens();
      setPersonagens(lista.characters);
      setMaxSlots(lista.maxSlots);
      setErro('');
    } catch (falha) {
      setErro(falha instanceof ErroDaApi ? falha.message : 'Erro inesperado.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!lerToken()) {
      setErro('Entre na sua conta para ver seus personagens.');
      setCarregando(false);
      return;
    }
    void recarregar();
  }, [recarregar]);

  async function confirmarExclusao(slot: number) {
    setOcupado(true);
    try {
      await apagarPersonagem(slot);
      setConfirmandoSlot(null);
      await recarregar();
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
                  <button type="button" className={styles.botao} disabled>
                    Jogar
                  </button>
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
