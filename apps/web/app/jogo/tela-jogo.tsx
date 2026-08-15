'use client';

/**
 * A tela de exploração: carrega o save da nuvem, anda pelas portas da
 * cidade e da masmorra, e grava de volta.
 *
 * O salvamento é adiado 2,5 s depois do último passo, igual ao
 * `scheduleCloudSave()` do cliente antigo — andar três salas seguidas
 * manda uma requisição, não três. A assinatura devolvida pela API vira a
 * `baseSignature` da próxima gravação: é assim que o servidor sabe que
 * este navegador está partindo do progresso mais recente.
 *
 * Sala "interessante" pergunta antes (`precisaConfirmar`); dizer não
 * atravessa quando a sala é de passagem. Combate, lojas, NPCs e eventos
 * ainda não foram migrados e avisam isso ao entrar.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { DIR_LABEL, type Direction } from '@rpg-legend/shared';
import { ErroDaApi } from '@/lib/api/client';
import { carregarSave, gravarSave } from '@/lib/api/save';
import { apresentacaoDe } from '@/lib/jogo/apresentacao';
import { andar, celulaAtual, celulaEm, podeAndar, retomarSave, revelar, vizinhaEm, type EstadoDoJogo, type SaveCarregado } from '@/lib/jogo/estado';
import { atravessaSemInteragir, interagir, precisaConfirmar, type Aviso } from '@/lib/jogo/sala';
import styles from './jogo.module.css';
import { Mapa } from './mapa';
import { PainelHeroi } from './painel-heroi';
import { TextoDoJogo } from './texto-do-jogo';

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
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [perguntando, setPerguntando] = useState<Direction | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvamento, setSalvamento] = useState<EstadoDoSalvamento>('parado');

  const assinatura = useRef('');
  const precisaSalvar = useRef(false);

  // Sem token o carregamento já rejeita sozinho (ver `chamarApi`).
  useEffect(() => {
    carregarSave(slot)
      .then((nuvem) => {
        if (!nuvem.save) {
          setErro('Este slot ainda não tem personagem.');
          return;
        }
        assinatura.current = nuvem.signature ?? '';
        setEstado(retomarSave(nuvem.save as SaveCarregado));
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

  // Só grava depois de um passo — carregar o jogo ou revelar uma sala não
  // conta como mudança de progresso.
  useEffect(() => {
    if (!estado || !precisaSalvar.current) return;
    const relogio = setTimeout(() => {
      precisaSalvar.current = false;
      void salvar(estado);
    }, ESPERA_ANTES_DE_SALVAR_MS);
    return () => clearTimeout(relogio);
  }, [estado, salvar]);

  function registrarMudanca(proximo: EstadoDoJogo, avisoNovo: Aviso | null) {
    precisaSalvar.current = true;
    setSalvamento('parado');
    setEstado(proximo);
    setAviso(avisoNovo);
    setPerguntando(null);
  }

  function entrar(atual: EstadoDoJogo, direcao: Direction) {
    const movido = andar(atual, direcao);
    if (movido === atual) return;
    const resultado = interagir(movido);
    registrarMudanca(resultado.estado, resultado.aviso);
  }

  function mover(direcao: Direction) {
    if (!estado) return;

    const destino = vizinhaEm(estado, direcao);
    if (!destino) return;

    const alvo = celulaEm(estado, destino);
    if (alvo && precisaConfirmar(alvo)) {
      setEstado(revelar(estado, destino));
      setAviso(null);
      setPerguntando(direcao);
      return;
    }

    entrar(estado, direcao);
  }

  function recusar() {
    if (!estado || !perguntando) return;

    const destino = vizinhaEm(estado, perguntando);
    const alvo = destino ? celulaEm(estado, destino) : null;

    if (!alvo || !atravessaSemInteragir(alvo)) {
      setPerguntando(null);
      setAviso({ icone: '🚶', titulo: 'Você recua', texto: 'Você decide não entrar e recua um passo.' });
      return;
    }

    registrarMudanca(andar(estado, perguntando), {
      icone: '🚶',
      titulo: 'De passagem',
      texto: 'Você passa pelo local sem interagir e segue seu caminho.',
    });
  }

  if (carregando) return <p>Carregando progresso…</p>;
  if (erro && !estado) return <p className={styles.erro}>{erro}</p>;
  if (!estado) return null;

  const visual = apresentacaoDe(estado);
  const aqui = celulaAtual(estado);
  const alvoDaPergunta = perguntando ? celulaEm(estado, vizinhaEm(estado, perguntando) ?? estado.pos) : null;

  return (
    <div className={styles.conteudo}>
      <PainelHeroi hero={estado.hero} />

      <section>
        <h1 className={styles.local}>{visual.lugar}</h1>
        <p className={styles.descricaoLocal}>
          <TextoDoJogo>{aqui ? visual.descricao(aqui) : ''}</TextoDoJogo>
        </p>

        <Mapa
          grade={estado.map}
          posicao={estado.pos}
          linhas={estado.mapRows}
          colunas={estado.mapCols}
          icone={visual.icone}
          descricao={`Mapa: ${visual.lugar}`}
        />

        <ul className={styles.legenda}>
          {visual.legenda.map(([icone, nome]) => (
            <li key={nome} className={styles.itemLegenda}>
              <span aria-hidden>{icone}</span>
              <span>{nome}</span>
            </li>
          ))}
        </ul>

        {alvoDaPergunta && perguntando && (
          <div className={styles.caixa} role="dialog" aria-label="Entrar na sala?">
            <span className={styles.iconeCaixa} aria-hidden>
              {visual.icone(alvoDaPergunta) || '🚪'}
            </span>
            <div>
              <p className={styles.textoCaixa}>
                <TextoDoJogo>{visual.textoDeEntrada(alvoDaPergunta)}</TextoDoJogo>
              </p>
              <div className={styles.escolhas}>
                <button type="button" className={`${styles.botao} ${styles.botaoPrincipal}`} onClick={() => entrar(estado, perguntando)}>
                  Sim
                </button>
                <button type="button" className={styles.botao} onClick={recusar}>
                  Não
                </button>
              </div>
            </div>
          </div>
        )}

        {aviso && !perguntando && (
          <div className={styles.caixa} role="status">
            <span className={styles.iconeCaixa} aria-hidden>
              {aviso.icone}
            </span>
            <div>
              <h2 className={styles.tituloCaixa}>{aviso.titulo}</h2>
              <p className={styles.textoCaixa}>
                <TextoDoJogo>{aviso.texto}</TextoDoJogo>
              </p>
            </div>
          </div>
        )}

        <div className={styles.bussola}>
          {DIRECOES.map(({ direcao, classe, seta }) => (
            <button
              key={direcao}
              type="button"
              className={`${styles.botaoDirecao} ${classe}`}
              onClick={() => mover(direcao)}
              disabled={!podeAndar(estado, direcao) || perguntando !== null}
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
