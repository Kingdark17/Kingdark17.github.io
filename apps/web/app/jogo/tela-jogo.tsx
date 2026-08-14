'use client';

/**
 * A cidade jogável: carrega o save da nuvem, deixa andar pelas portas e
 * grava de volta.
 *
 * O salvamento é adiado 2,5 s depois do último passo, igual ao
 * `scheduleCloudSave()` do cliente antigo — andar três salas seguidas
 * manda uma requisição, não três. A assinatura devolvida pela API vira a
 * `baseSignature` da próxima gravação: é assim que o servidor sabe que
 * este navegador está partindo do progresso mais recente.
 *
 * Só cidade por enquanto. Masmorra, combate, lojas e NPCs entram depois.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { DIR_LABEL, cityRoomDesc, cityShortLabel, type Direction } from '@rpg-legend/shared';
import { ErroDaApi } from '@/lib/api/client';
import { carregarSave, gravarSave } from '@/lib/api/save';
import { lerToken } from '@/lib/api/session';
import { andar, celulaAtual, entrarNaCidade, podeAndar, type EstadoDoJogo, type SaveCarregado } from '@/lib/jogo/estado';
import styles from './jogo.module.css';
import { Mapa } from './mapa';
import { PainelHeroi } from './painel-heroi';

const ESPERA_ANTES_DE_SALVAR_MS = 2500;

const DIRECOES: { direcao: Direction; classe: string; seta: string }[] = [
  { direcao: 'N', classe: styles.norte, seta: '↑' },
  { direcao: 'W', classe: styles.oeste, seta: '←' },
  { direcao: 'E', classe: styles.leste, seta: '→' },
  { direcao: 'S', classe: styles.sul, seta: '↓' },
];

type EstadoDoSalvamento = 'parado' | 'salvando' | 'salvo';

export function TelaJogo({ slot }: { slot: number }) {
  const [estado, setEstado] = useState<EstadoDoJogo | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvamento, setSalvamento] = useState<EstadoDoSalvamento>('parado');

  const assinatura = useRef('');
  const precisaSalvar = useRef(false);

  useEffect(() => {
    if (!lerToken()) {
      setErro('Entre na sua conta para jogar.');
      setCarregando(false);
      return;
    }

    carregarSave(slot)
      .then((nuvem) => {
        if (!nuvem.save) {
          setErro('Este slot ainda não tem personagem.');
          return;
        }
        assinatura.current = nuvem.signature ?? '';
        setEstado(entrarNaCidade(nuvem.save as SaveCarregado));
      })
      .catch((falha) => setErro(falha instanceof ErroDaApi ? falha.message : 'Erro inesperado ao carregar o progresso.'))
      .finally(() => setCarregando(false));
  }, [slot]);

  const salvar = useCallback(
    async (paraGravar: EstadoDoJogo) => {
      setSalvamento('salvando');
      try {
        const resposta = await gravarSave({ slot, save: paraGravar, baseSignature: assinatura.current });
        assinatura.current = resposta.signature;
        setSalvamento('salvo');
      } catch (falha) {
        setSalvamento('parado');
        setErro(falha instanceof ErroDaApi ? falha.message : 'Erro inesperado ao salvar.');
      }
    },
    [slot],
  );

  // Só grava depois de um passo — carregar o jogo não conta como mudança.
  useEffect(() => {
    if (!estado || !precisaSalvar.current) return;
    const relogio = setTimeout(() => {
      precisaSalvar.current = false;
      void salvar(estado);
    }, ESPERA_ANTES_DE_SALVAR_MS);
    return () => clearTimeout(relogio);
  }, [estado, salvar]);

  function mover(direcao: Direction) {
    setEstado((atual) => {
      if (!atual) return atual;
      const proximo = andar(atual, direcao);
      if (proximo !== atual) {
        precisaSalvar.current = true;
        setSalvamento('parado');
      }
      return proximo;
    });
  }

  if (carregando) return <p>Carregando progresso…</p>;
  if (erro && !estado) return <p className={styles.erro}>{erro}</p>;
  if (!estado) return null;

  const aqui = celulaAtual(estado);

  return (
    <div className={styles.conteudo}>
      <PainelHeroi hero={estado.hero} />

      <section>
        <h1 className={styles.local}>{aqui ? cityShortLabel(aqui) : 'Cidade Inicial'}</h1>
        <p className={styles.descricaoLocal}>{aqui ? cityRoomDesc(aqui) : ''}</p>

        <Mapa grade={estado.map} posicao={estado.pos} linhas={estado.mapRows} colunas={estado.mapCols} />

        <div className={styles.bussola}>
          {DIRECOES.map(({ direcao, classe, seta }) => (
            <button
              key={direcao}
              type="button"
              className={`${styles.botaoDirecao} ${classe}`}
              onClick={() => mover(direcao)}
              disabled={!podeAndar(estado, direcao)}
              aria-label={DIR_LABEL[direcao]}
              title={DIR_LABEL[direcao]}
            >
              {seta}
            </button>
          ))}
        </div>

        <p className={styles.estadoSalvamento}>
          {salvamento === 'salvando' && 'Salvando na nuvem…'}
          {salvamento === 'salvo' && 'Progresso salvo na nuvem.'}
        </p>

        {erro && <p className={styles.erro}>{erro}</p>}
      </section>
    </div>
  );
}
