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
 * atravessa quando a sala é de passagem. Sala com conteúdo próprio
 * (combate, loja, NPC, quadro de missões, evento) troca esta tela pela
 * dela — `interagir` devolve qual, e `conteudoDaTela` escolhe.
 */

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';

import { DIR_LABEL, displayName, type Direction, type Item, type PetId } from '@rpg-legend/shared';
import { usuarioAtual } from '@/lib/api/account';
import { ErroDaApi } from '@/lib/api/client';
import { carregarSave, gravarSave } from '@/lib/api/save';
import { apresentacaoDe } from '@/lib/jogo/apresentacao';
import { andar, celulaEm, podeAndar, retomarSave, revelar, vizinhaEm, type EstadoDoJogo, type SaveCarregado } from '@/lib/jogo/estado';
import { atravessaSemInteragir, interagir, precisaConfirmar, type Aviso, type TelaAberta } from '@/lib/jogo/sala';
import { abrirAdm } from '@/lib/jogo/adm';
import { aplicarRemoto, instantaneoDaSala, type CosmeticosDoJogador } from '@/lib/jogo/coop';
import { abrirMochila } from '@/lib/jogo/mochila';
import { narrar } from '@/lib/jogo/narrador';
import { monstroAtual } from '@/lib/jogo/combate';
import { tocar } from '@/lib/som/efeitos';
import { useTrilha } from '@/lib/som/use-trilha';
import type { Tema } from '@/lib/som/musica';
import { marcar, type Recado } from '@/lib/jogo/tutorial';
import { abrirAventura, assinar, instantanea, mandarEstado, mandarPerfil, PAPEL_ANFITRIAO, travarParceiro } from '@/lib/rede/sala';
import { useSala } from '@/lib/rede/use-sala';
import type { Combate } from '@/lib/jogo/combate';
import { BichoDeEstimacao } from './bicho-de-estimacao';
import { ControleDeSom } from './controle-de-som';
import styles from './jogo.module.css';
import { Mapa } from './mapa';
import { PainelHeroi } from './painel-heroi';
import { TelaMochila } from './tela-mochila';
import { TextoDoJogo } from './texto-do-jogo';

/** Piscada entre o clique e o pedaço chegar. Só aparece na primeira vez de cada tela. */
function Abrindo() {
  return <p className={styles.abrindo}>Abrindo…</p>;
}

/**
 * As telas de sala entram por `next/dynamic`: nenhuma delas aparece
 * quando `/jogo` abre — o jogador chega no mapa e só depois entra numa
 * loja, num combate ou na mochila. Medido, tirá-las da carga inicial vale
 * mais do que parece, porque a de combate carrega o Motion junto.
 *
 * `ssr: false` porque nenhuma renderiza no servidor de qualquer jeito:
 * até o save voltar da nuvem esta tela devolve `null`.
 *
 * A de combate e a mochila são buscadas assim que o save carrega (ver
 * `useEffect` de prefetch): estar fora do pacote inicial não pode virar
 * uma espera na hora que o monstro aparece.
 */
const TelaAdm = dynamic(() => import('./tela-adm').then((m) => m.TelaAdm), { ssr: false, loading: Abrindo });
const TelaCombate = dynamic(() => import('./tela-combate').then((m) => m.TelaCombate), { ssr: false, loading: Abrindo });
const TelaDialogo = dynamic(() => import('./tela-dialogo').then((m) => m.TelaDialogo), { ssr: false, loading: Abrindo });
const TelaEvento = dynamic(() => import('./tela-evento').then((m) => m.TelaEvento), { ssr: false, loading: Abrindo });
const TelaGuia = dynamic(() => import('./tela-guia').then((m) => m.TelaGuia), { ssr: false, loading: Abrindo });
const TelaLoja = dynamic(() => import('./tela-loja').then((m) => m.TelaLoja), { ssr: false, loading: Abrindo });
const TelaMissoes = dynamic(() => import('./tela-missoes').then((m) => m.TelaMissoes), { ssr: false, loading: Abrindo });

const ESPERA_ANTES_DE_SALVAR_MS = 2500;

const DIRECOES: { direcao: Direction; classe: string; seta: string }[] = [
  { direcao: 'N', classe: styles.norte, seta: '↑' },
  { direcao: 'W', classe: styles.oeste, seta: '←' },
  { direcao: 'E', classe: styles.leste, seta: '→' },
  { direcao: 'S', classe: styles.sul, seta: '↓' },
];

type EstadoDoSalvamento = 'parado' | 'salvando' | 'salvo';

export function TelaJogo({ slot, sala: codigoDaSala }: { slot: number; sala?: string }) {
  const sala = useSala();
  const emCoop = !!codigoDaSala && sala.codigo === codigoDaSala;
  const conduzo = !emCoop || sala.papel === PAPEL_ANFITRIAO;

  const [estado, setEstado] = useState<EstadoDoJogo | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [tela, setTela] = useState<TelaAberta | null>(null);
  const [perguntando, setPerguntando] = useState<Direction | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvamento, setSalvamento] = useState<EstadoDoSalvamento>('parado');
  const [pet, setPet] = useState<PetId | null>(null);
  const [admin, setAdmin] = useState(false);
  const [recado, setRecado] = useState<Recado | null>(null);
  const [guiaAberto, setGuiaAberto] = useState(false);

  const assinatura = useRef('');
  const precisaSalvar = useRef(false);
  const abriu = useRef(false);
  const cosmeticos = useRef<CosmeticosDoJogador | null>(null);
  const ultimoRemoto = useRef<Record<string, unknown> | null>(null);
  /** A mochila da última sincronização — o que permite omiti-la quando não mudou. */
  const mochilaEnviada = useRef<readonly Item[] | null>(null);

  useTrilha(temaDaCena(estado, tela));

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

  // A conta traz duas coisas que o save não tem: o pet (bônus de combate)
  // e se é a conta administradora (painel ADM). Falhar aqui não é erro de
  // jogo — sem pet a luta acontece igual, só sem os bônus.
  useEffect(() => {
    usuarioAtual()
      .then((usuario) => {
        setPet(usuario.pet && usuario.pet !== 'none' ? (usuario.pet as PetId) : null);
        setAdmin(usuario.isAdmin);
        cosmeticos.current = {
          username: usuario.username,
          avatarUrl: usuario.avatarUrl,
          frame: usuario.frame,
          nameColor: usuario.nameColor,
          pet: usuario.pet,
        };
      })
      .catch(() => undefined);
  }, []);

  // Combate é a tela que todo mundo abre, e a única cara (leva o Motion
  // junto). Buscar o pedaço enquanto o jogador ainda lê a sala tira a
  // espera de onde ela apareceria: na hora em que o monstro surge.
  useEffect(() => {
    void import('./tela-combate');
  }, []);

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

  /**
   * Só grava depois de um passo — carregar o jogo ou revelar uma sala não
   * conta como mudança de progresso.
   *
   * **Em sala co-op a gravação fica desligada.** O mapa da sessão é o do
   * anfitrião; gravá-lo no slot do convidado substituiria a masmorra dele
   * pela do parceiro só por ter entrado pra ajudar. Ao sair da sala, o
   * save do slot está como ele deixou.
   */
  useEffect(() => {
    if (!estado || !precisaSalvar.current || emCoop) return;
    const relogio = setTimeout(() => {
      precisaSalvar.current = false;
      void salvar(estado);
    }, ESPERA_ANTES_DE_SALVAR_MS);
    return () => clearTimeout(relogio);
  }, [estado, salvar, emCoop]);

  // ---------------------------------------------------------------- co-op

  /** O que o parceiro precisa saber, mandado depois de cada mudança minha. */
  const sincronizar = useCallback(
    (atual: EstadoDoJogo, abrindo = false) => {
      if (!emCoop || !sala.papel) return;
      const pacote = instantaneoDaSala(atual, sala.papel, atual.hero.name, cosmeticos.current, mochilaEnviada.current);
      // Marcado só depois de montar o pacote: se marcasse antes, a primeira
      // sincronização já acharia que a mochila tinha ido, e o servidor
      // ficaria sem ela — devolvendo vazio no eco e apagando a do jogador.
      mochilaEnviada.current = atual.inventory;
      if (abrindo) abrirAventura(pacote, sala.turno);
      else mandarEstado(pacote, sala.turno);
    },
    [emCoop, sala.papel, sala.turno],
  );

  // Conexão caída apaga o que o servidor sabia da sala. Esquecer o que já
  // foi enviado obriga a próxima sincronização a levar a mochila inteira de
  // novo — sem isto, o servidor voltaria sem mochila nenhuma e o eco
  // esvaziaria a do jogador.
  useEffect(() => {
    if (sala.fase === 'desligado') mochilaEnviada.current = null;
  }, [sala.fase]);

  // Quem conduz abre a aventura assim que o save carrega; quem acompanha
  // manda o próprio perfil e espera o `welcome`.
  useEffect(() => {
    if (!emCoop || !estado || !sala.papel || abriu.current) return;
    abriu.current = true;

    mandarPerfil({
      name: estado.hero.name,
      hero: estado.hero,
      inventory: estado.inventory,
      party: estado.party,
      publicProfile: cosmeticos.current,
    });
    if (sala.papel === PAPEL_ANFITRIAO) sincronizar(estado, true);
  }, [emCoop, estado, sala.papel, sincronizar]);

  /**
   * Estado que chegou do parceiro. O herói continua sendo o meu: quem o
   * devolve é `profiles[meuPapel]`, não o pacote do outro.
   *
   * Assina a sessão direto em vez de olhar `sala.remoto` a cada render:
   * o `setEstado` acontece no callback de uma fonte externa, que é
   * exatamente o caso pra que `useEffect` existe. `ultimoRemoto` corta a
   * reaplicação quando o que mudou na sessão foi outra coisa (um recado,
   * um perfil), o que só geraria render à toa.
   */
  useEffect(() => {
    if (!emCoop) return;
    return assinar(() => {
      const agora = instantanea();
      if (!agora.remoto || !agora.papel || agora.remoto === ultimoRemoto.current) return;
      ultimoRemoto.current = agora.remoto;
      setEstado((atual) => (atual ? aplicarRemoto(atual, agora.remoto!, agora.perfis[agora.papel!]) : atual));
    });
  }, [emCoop]);

  function registrarMudanca(proximo: EstadoDoJogo, avisoNovo: Aviso | null) {
    precisaSalvar.current = true;
    setSalvamento('parado');
    setEstado(proximo);
    setAviso(avisoNovo);
    setPerguntando(null);
    sincronizar(proximo);
  }

  function entrar(atual: EstadoDoJogo, direcao: Direction) {
    const movido = andar(atual, direcao);
    if (movido === atual) return;

    // "Dê o primeiro passo" fecha aqui; as outras etapas de sala saem
    // de dentro de `interagir`, que sabe em que sala o jogador caiu.
    const passo = marcar(movido, 'move');
    const resultado = interagir(passo.estado, undefined, pet);

    // Sala sem som próprio soa como passo, que é o que o cliente antigo
    // tocava em toda caminhada.
    tocar(resultado.som ?? 'step');

    registrarMudanca(resultado.estado, resultado.aviso);
    setRecado(resultado.recado ?? passo.recado);
    setTela(resultado.tela);
  }

  function abrirTelaDaMochila(atual: EstadoDoJogo) {
    const passo = marcar(atual, 'inventory');
    if (passo.recado) {
      setEstado(passo.estado);
      setRecado(passo.recado);
      precisaSalvar.current = true;
    }
    setTela({ tipo: 'mochila', mochila: abrirMochila(passo.estado) });
  }

  /**
   * Toda ação dentro de uma tela dessas mexe no save — vida da criatura,
   * ouro, mochila, equipe, missão. O estado do jogo acompanha em vez de
   * esperar o fim: fechar a aba no meio de um chefe não devolve o chefe
   * com vida cheia.
   */
  function seguir(proxima: TelaAberta, proximoEstado: EstadoDoJogo) {
    setTela(proxima);
    setEstado(proximoEstado);
    precisaSalvar.current = true;
    setSalvamento('parado');
    sincronizar(proximoEstado);
  }

  function fechar(estadoFinal: EstadoDoJogo, avisoFinal: Aviso | null = null) {
    setTela(null);
    setEstado(estadoFinal);
    setAviso(avisoFinal);
    precisaSalvar.current = true;
    setSalvamento('parado');
    sincronizar(estadoFinal);
  }

  function mover(direcao: Direction) {
    if (!estado || !conduzo) return;

    // Quem conduz avisa o parceiro que está andando: enquanto isso ele não
    // age, senão os dois mexem no mesmo mapa ao mesmo tempo.
    if (emCoop) travarParceiro();

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

  function conteudoDaTela(aberta: TelaAberta) {
    switch (aberta.tipo) {
      case 'combate':
        return (
          <TelaCombate
            combate={aberta.combate}
            onCombate={(proximo) => seguir({ tipo: 'combate', combate: proximo }, proximo.estado)}
            onEncerrar={(final) => fechar(final.estado, avisoDoFim(final))}
          />
        );
      case 'loja':
        return (
          <TelaLoja
            loja={aberta.loja}
            onLoja={(proxima) => seguir({ tipo: 'loja', loja: proxima }, proxima.estado)}
            onFechar={(final) => fechar(final.estado)}
          />
        );
      case 'dialogo':
        return (
          <TelaDialogo
            dialogo={aberta.dialogo}
            onDialogo={(proximo) => seguir({ tipo: 'dialogo', dialogo: proximo }, proximo.estado)}
            onFechar={(final) => fechar(final.estado)}
          />
        );
      case 'missoes':
        return (
          <TelaMissoes
            quadro={aberta.quadro}
            onQuadro={(proximo) => seguir({ tipo: 'missoes', quadro: proximo }, proximo.estado)}
            onFechar={(final) => fechar(final.estado)}
          />
        );
      case 'evento':
        return (
          <TelaEvento
            evento={aberta.evento}
            onEvento={(proximo) => seguir({ tipo: 'evento', evento: proximo }, proximo.estado)}
            onFechar={(final) => fechar(final.estado)}
          />
        );
      case 'mochila':
        return (
          <TelaMochila
            mochila={aberta.mochila}
            onMochila={(proxima) => seguir({ tipo: 'mochila', mochila: proxima }, proxima.estado)}
            onFechar={(final) => fechar(final.estado)}
          />
        );
      case 'adm':
        return (
          <TelaAdm
            adm={aberta.adm}
            onAdm={(proximo) => seguir({ tipo: 'adm', adm: proximo }, proximo.estado)}
            onFechar={(final) => fechar(final.estado)}
          />
        );
    }
  }

  const enfeites = (
    <>
      <BichoDeEstimacao pet={pet} />
      {recado && (
        <div className={styles.recado} role="status">
          <span className={styles.textoDoRecado}>
            <strong>{recado.titulo}</strong>
            <span>{recado.texto}</span>
          </span>
          <button type="button" className={styles.fecharRecado} onClick={() => setRecado(null)} aria-label="Fechar aviso">
            ×
          </button>
        </div>
      )}
    </>
  );

  if (guiaAberto) {
    return (
      <div className={styles.conteudo}>
        <PainelHeroi hero={estado.hero} />
        <TelaGuia estado={estado} onFechar={() => setGuiaAberto(false)} />
        {enfeites}
      </div>
    );
  }

  if (tela) {
    return (
      <div className={styles.conteudo}>
        <PainelHeroi hero={estado.hero} />
        {conteudoDaTela(tela)}
        {enfeites}
      </div>
    );
  }

  const visual = apresentacaoDe(estado);
  const narracao = narrar(estado);
  const alvoDaPergunta = perguntando ? celulaEm(estado, vizinhaEm(estado, perguntando) ?? estado.pos) : null;

  return (
    <div className={styles.conteudo}>
      <PainelHeroi hero={estado.hero} />

      <section>
        <h1 className={styles.local}>{visual.lugar}</h1>
        {narracao && (
          <div className={styles.descricaoLocal}>
            <p className={styles.linhaDaCena}>{narracao.ambiente}</p>
            {narracao.conteudo && (
              <p className={styles.linhaDaCena}>
                <TextoDoJogo>{narracao.conteudo}</TextoDoJogo>
              </p>
            )}
            <p className={styles.pistasDasPortas}>{narracao.portas.join(' ')}</p>
          </div>
        )}

        <Mapa
          grade={estado.map}
          posicao={estado.pos}
          linhas={estado.mapRows}
          colunas={estado.mapCols}
          icone={visual.icone}
          rotulo={visual.rotulo}
          gasta={visual.gasta}
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

        {/* A mochila não é sala: abre por botão, e continua acessível com a
            pergunta "deseja entrar?" na tela — beber uma poção antes de
            encarar o monstro é justamente quando ela serve. */}
        <div className={styles.acoesDaExploracao}>
          <button
            type="button"
            className={`${styles.botao} ${estado.hero.attrPoints > 0 ? styles.botaoPrincipal : ''}`}
            onClick={() => abrirTelaDaMochila(estado)}
          >
            🎒 Mochila
            {estado.hero.attrPoints > 0 && <span className={styles.marcaDePontos}>{estado.hero.attrPoints}</span>}
          </button>

          <button type="button" className={styles.botao} onClick={() => setGuiaAberto(true)}>
            📖 Guia
          </button>

          <ControleDeSom />

          {admin && (
            <button type="button" className={styles.botao} onClick={() => setTela({ tipo: 'adm', adm: abrirAdm(estado) })}>
              🛠️ ADM
            </button>
          )}
        </div>

        <div className={styles.bussola}>
          {DIRECOES.map(({ direcao, classe, seta }) => (
            <button
              key={direcao}
              type="button"
              className={`${styles.botaoDirecao} ${classe}`}
              onClick={() => mover(direcao)}
              disabled={!podeAndar(estado, direcao) || perguntando !== null || !conduzo}
              aria-label={DIR_LABEL[direcao]}
              title={DIR_LABEL[direcao]}
            >
              {seta}
            </button>
          ))}
        </div>

        <p className={styles.estadoSalvamento}>
          {emCoop && `Sala ${sala.codigo} · ${conduzo ? 'você conduz a exploração' : 'o anfitrião conduz'} · o progresso desta sessão não é gravado`}
          {!emCoop && salvamento === 'salvando' && 'Salvando na nuvem…'}
          {!emCoop && salvamento === 'salvo' && 'Progresso salvo na nuvem.'}
        </p>

        {erro && <p className={styles.erro}>{erro}</p>}
      </section>

      {enfeites}
    </div>
  );
}

/**
 * Qual trilha combina com o que está na tela. Enquanto o save não chega
 * (`estado` nulo) toca o tema de menu, igual ao cliente antigo fora do
 * jogo.
 */
function temaDaCena(estado: EstadoDoJogo | null, tela: TelaAberta | null): Tema {
  if (!estado) return 'menu';
  if (tela?.tipo === 'combate') return monstroAtual(estado)?.isBoss ? 'boss' : 'combat';
  return estado.mapMode === 'dungeon' ? 'dungeon' : 'city';
}

function avisoDoFim(final: Combate): Aviso {
  if (final.fase === 'derrota') return { icone: '💀', titulo: 'Derrota', texto: final.log.join(' ') };
  if (final.fase === 'fuga') return { icone: '🏃', titulo: 'Fuga', texto: 'Você escapa da batalha, ofegante.' };
  return {
    icone: '🏆',
    titulo: 'Vitória',
    texto: `Você venceu a batalha!${final.loot ? ` Encontrou <b>${displayName(final.loot)}</b>.` : ''}`,
  };
}
