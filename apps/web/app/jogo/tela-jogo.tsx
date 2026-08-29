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

/* eslint-disable @next/next/no-img-element */

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { DIR_LABEL, displayName, type Direction, type Item, type PetId } from '@rpg-legend/shared';
import { usuarioAtual } from '@/lib/api/account';
import { ErroDaApi } from '@/lib/api/client';
import { carregarSave, gravarSave } from '@/lib/api/save';
import { apresentacaoDe } from '@/lib/jogo/apresentacao';
import { arteDoTipo } from '@/lib/jogo/icones-do-mapa';
import { andar, celulaEm, podeAndar, retomarSave, revelar, vizinhaEm, type EstadoDoJogo, type SaveCarregado } from '@/lib/jogo/estado';
import { atravessaSemInteragir, interagir, precisaConfirmar, type Aviso, type TelaAberta } from '@/lib/jogo/sala';
import { abrirAdm } from '@/lib/jogo/adm';
import { aplicarRemoto, instantaneoDaSala, type CosmeticosDoJogador } from '@/lib/jogo/coop';
import { anotar, type Anotacao } from '@/lib/jogo/diario';
import { abrirMochila } from '@/lib/jogo/mochila';
import { narrar } from '@/lib/jogo/narrador';
import { direcaoDaTecla, estaDigitando } from '@/lib/jogo/teclado';
import { monstroAtual } from '@/lib/jogo/combate';
import { tocar } from '@/lib/som/efeitos';
import { useTrilha } from '@/lib/som/use-trilha';
import type { Tema } from '@/lib/som/musica';
import { marcar, type Recado } from '@/lib/jogo/tutorial';
import { abrirAventura, assinar, instantanea, mandarEstado, mandarPerfil, PAPEL_ANFITRIAO, sairDaSala, travarParceiro } from '@/lib/rede/sala';
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
const TelaDiario = dynamic(() => import('./tela-diario').then((m) => m.TelaDiario), { ssr: false, loading: Abrindo });
const TelaEvento = dynamic(() => import('./tela-evento').then((m) => m.TelaEvento), { ssr: false, loading: Abrindo });
const TelaGuia = dynamic(() => import('./tela-guia').then((m) => m.TelaGuia), { ssr: false, loading: Abrindo });
const TelaLoja = dynamic(() => import('./tela-loja').then((m) => m.TelaLoja), { ssr: false, loading: Abrindo });
const TelaMissoes = dynamic(() => import('./tela-missoes').then((m) => m.TelaMissoes), { ssr: false, loading: Abrindo });

const ESPERA_ANTES_DE_SALVAR_MS = 2500;

/**
 * Teto do adiamento, contado desde a primeira mudança ainda não gravada.
 *
 * Sem ele o adiamento não tem fim: cada passo reinicia os 2,5 s, então
 * quem joga sem parar nunca grava. É o pior caso de perda por aba
 * fechada, travada ou derrubada — dez segundos, não a sessão.
 */
const ESPERA_MAXIMA_MS = 10000;

const DIRECOES: { direcao: Direction; classe: string; seta: string }[] = [
  { direcao: 'N', classe: styles.norte, seta: '↑' },
  { direcao: 'W', classe: styles.oeste, seta: '←' },
  { direcao: 'E', classe: styles.leste, seta: '→' },
  { direcao: 'S', classe: styles.sul, seta: '↓' },
];

type EstadoDoSalvamento = 'parado' | 'salvando' | 'salvo';

export function TelaJogo({ slot, sala: codigoDaSala }: { slot: number; sala?: string }) {
  const router = useRouter();
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
  const [diario, setDiario] = useState<Anotacao[]>([]);
  const [guiaAberto, setGuiaAberto] = useState(false);
  const [diarioAberto, setDiarioAberto] = useState(false);
  const [legendaAberta, setLegendaAberta] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const [saindo, setSaindo] = useState(false);

  const assinatura = useRef('');
  const precisaSalvar = useRef(false);
  /** Quando começou a espera atual. `0` = não há nada esperando pra gravar. */
  const esperandoDesde = useRef(0);
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

  /** Devolve se gravou. Quem sai da partida precisa saber: navegar depois
      de uma gravação que falhou joga fora o progresso em silêncio. */
  const salvar = useCallback(
    async (paraGravar: EstadoDoJogo): Promise<boolean> => {
      setSalvamento('salvando');
      try {
        const resposta = await gravarSave({ slot, save: paraGravar, baseSignature: assinatura.current });
        assinatura.current = resposta.signature;
        setSalvamento('salvo');
        return true;
      } catch (falha) {
        setSalvamento('parado');
        setErro(falha instanceof ErroDaApi ? falha.message : 'Erro inesperado ao salvar.');
        return false;
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

    // O adiamento é reiniciado a cada mudança, então jogo sem pausa
    // conseguia empurrar a gravação pra sempre — bastava não parar 2,5 s.
    // Quem descobriu isso foi a tecla segurada, que mudava o estado 30
    // vezes por segundo, mas a falha não era dela: combate encadeado ou
    // uma sequência de compras chegam no mesmo lugar. O teto conta desde
    // a **primeira** mudança ainda não gravada, então o pior caso é
    // perder ESPERA_MAXIMA_MS de jogo, não a sessão inteira.
    esperandoDesde.current ||= Date.now();
    const jaEsperou = Date.now() - esperandoDesde.current;
    const espera = Math.max(0, Math.min(ESPERA_ANTES_DE_SALVAR_MS, ESPERA_MAXIMA_MS - jaEsperou));

    const relogio = setTimeout(() => {
      precisaSalvar.current = false;
      esperandoDesde.current = 0;
      void salvar(estado);
    }, espera);
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

  /**
   * Conexão caída apaga o que o servidor sabia da sala.
   *
   * Esquecer a mochila enviada obriga a próxima sincronização a levá-la
   * inteira de novo — sem isto o servidor voltaria sem mochila nenhuma e o
   * eco esvaziaria a do jogador.
   *
   * `abriu` também precisa voltar a `false`, e por motivo parecido: o
   * servidor **não guarda perfil entre reinícios** (é decisão de segurança,
   * ver `deposito-de-salas.ts`), então quem volta pra sala precisa reenviar
   * o seu. Enquanto essa trava ficava ligada pra sempre, a reconexão
   * devolvia a sala e não devolvia o jogo: ninguém reenviava perfil e o
   * anfitrião não reabria a aventura.
   */
  useEffect(() => {
    if (sala.fase === 'desligado' || sala.fase === 'reconectando') {
      mochilaEnviada.current = null;
      abriu.current = false;
    }
  }, [sala.fase]);

  /**
   * Sair da partida. Grava o passo que ainda estiver na fila antes de
   * navegar — o salvamento é adiado 2,5 s, então sair logo depois de andar
   * perderia essa jogada sem avisar. **Se a gravação falhar, não sai**: a
   * mensagem de erro fica na tela e o jogador decide.
   *
   * Em co-op não há o que gravar (a sessão nunca é gravada, por decisão),
   * mas há uma sala pra desfazer: sem `sairDaSala()` o parceiro ficaria
   * esperando alguém que já foi embora.
   */
  async function sairDaPartida() {
    if (!estado || saindo) return;
    setSaindo(true);

    if (emCoop) {
      sairDaSala();
    } else if (precisaSalvar.current) {
      precisaSalvar.current = false;
      esperandoDesde.current = 0;
      if (!(await salvar(estado))) {
        precisaSalvar.current = true;
        setSaindo(false);
        setConfirmandoSaida(false);
        return;
      }
    }

    router.push('/menu');
  }

  /**
   * Quem conduz abre a aventura assim que o save carrega; quem acompanha
   * manda o próprio perfil e espera o `welcome`.
   *
   * Roda de novo depois de uma reconexão, porque `abriu` é zerado na queda
   * (ver acima). A fase entra na conta pra isso não disparar no meio do
   * caminho: durante `reconectando` o papel antigo ainda está na sessão, e
   * mandar perfil por um socket caído não chega em ninguém.
   */
  useEffect(() => {
    const naSala = sala.fase === 'esperando' || sala.fase === 'jogando';
    if (!emCoop || !estado || !sala.papel || !naSala || abriu.current) return;
    abriu.current = true;

    mandarPerfil({
      name: estado.hero.name,
      hero: estado.hero,
      inventory: estado.inventory,
      party: estado.party,
      publicProfile: cosmeticos.current,
    });
    if (sala.papel === PAPEL_ANFITRIAO) sincronizar(estado, true);
  }, [emCoop, estado, sala.papel, sala.fase, sincronizar]);

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

  /**
   * As duas portas por onde acontecimento chega ao jogador — e é por isso
   * que o diário escreve daqui, e não de um gerador próprio: assim ele
   * registra **exatamente** o que foi mostrado. Diário que discorda da
   * tela seria pior que diário nenhum.
   *
   * `null` só limpa a caixa; não é acontecimento e não vira linha.
   */
  function avisar(proximo: Aviso | null) {
    setAviso(proximo);
    if (proximo) setDiario((atual) => anotar(atual, proximo));
  }

  function recadar(proximo: Recado | null) {
    setRecado(proximo);
    if (proximo) setDiario((atual) => anotar(atual, { icone: '✨', ...proximo }));
  }

  function registrarMudanca(proximo: EstadoDoJogo, avisoNovo: Aviso | null) {
    precisaSalvar.current = true;
    setSalvamento('parado');
    setEstado(proximo);
    avisar(avisoNovo);
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
    recadar(resultado.recado ?? passo.recado);
    setTela(resultado.tela);
  }

  function abrirTelaDaMochila(atual: EstadoDoJogo) {
    const passo = marcar(atual, 'inventory');
    if (passo.recado) {
      setEstado(passo.estado);
      recadar(passo.recado);
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
    avisar(avisoFinal);
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

  /**
   * WASD e setas andam, como `bindKeyboard()` fazia em `js/ui.js`. O
   * cliente antigo tinha teclado desde sempre e o front novo nasceu só
   * com os botões.
   *
   * A jogada entra por `ref` em vez de por dependência do efeito: `mover`
   * é redefinida a cada render, e listá-la nas dependências assinaria e
   * desassinaria a `window` a cada passo dado. O `ref` é reatribuído
   * depois de todo render, então nunca sobra closure velha.
   */
  const jogadaDoTeclado = useRef<(direcao: Direction) => boolean>(() => false);

  useEffect(() => {
    jogadaDoTeclado.current = (direcao) => {
      // As mesmas condições que apagam os botões da bússola. Teclado que
      // anda com o botão desabilitado é teclado que burla a tela — no
      // co-op ele mexeria no mapa do parceiro fora da vez.
      if (tela || guiaAberto || diarioAberto || confirmandoSaida) return false;
      if (!estado || perguntando !== null || !conduzo) return false;

      // Daqui pra baixo a tecla é do jogo, mesmo sem porta desse lado:
      // seta que ora anda e ora rola a página é pior que seta que não faz
      // nada. Fora da exploração ela continua rolando normalmente.
      if (podeAndar(estado, direcao)) mover(direcao);
      return true;
    };
  });

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (estaDigitando(evento.target as HTMLElement | null)) return;

      const direcao = direcaoDaTecla(evento);
      if (!direcao) return;

      if (jogadaDoTeclado.current(direcao)) evento.preventDefault();
    }

    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  function recusar() {
    if (!estado || !perguntando) return;

    const destino = vizinhaEm(estado, perguntando);
    const alvo = destino ? celulaEm(estado, destino) : null;

    if (!alvo || !atravessaSemInteragir(alvo)) {
      setPerguntando(null);
      avisar({ icone: '🚶', titulo: 'Você recua', texto: 'Você decide não entrar e recua um passo.' });
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

  // Tela própria, mas não tela cheia: a ficha do herói continua ao lado,
  // igual ao guia e à mochila. Ler o diário é conferir o que aconteceu com
  // *este* personagem — esconder os atributos enquanto isso não ajuda.
  if (diarioAberto) {
    return (
      <div className={styles.conteudo}>
        <PainelHeroi hero={estado.hero} />
        <TelaDiario anotacoes={diario} onFechar={() => setDiarioAberto(false)} />
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

      <section className={styles.exploracao}>
        {/* A narração vem antes do mapa no HTML, e não só no desenho: é o
            texto que a pessoa lê pra decidir a próxima porta. O mapa é
            consulta, e consulta vem depois — inclusive pra quem ouve a
            tela em vez de ver. */}
        <div className={styles.cena}>
          <div className={styles.narracao}>
            <h1 className={`${styles.local} ${styles.tituloDaCena}`}>{visual.lugar}</h1>
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

              <button type="button" className={styles.botao} onClick={() => setDiarioAberto(true)}>
                📜 Diário
                {diario.length > 0 && <span className={styles.marcaDoDiario}>{diario.length}</span>}
              </button>

              <button type="button" className={styles.botao} onClick={() => setGuiaAberto(true)}>
                <img className={styles.iconeDeBotao} src="/img/ui/guia.png" alt="" aria-hidden />
                Guia
              </button>

              <ControleDeSom />

              {admin && (
                <button type="button" className={styles.botao} onClick={() => setTela({ tipo: 'adm', adm: abrirAdm(estado) })}>
                  🛠️ ADM
                </button>
              )}

              {/* As duas portas empilhadas, e não troca de `src` no hover:
                  assim as duas carregam junto com a página e a primeira
                  passada do mouse não espera download nem pisca. */}
              <button
                type="button"
                className={`${styles.botao} ${styles.botaoSair}`}
                onClick={() => setConfirmandoSaida(true)}
                disabled={saindo}
              >
                <span className={styles.porta} aria-hidden>
                  <img className={styles.portaFechada} src="/img/ui/porta.png" alt="" />
                  <img className={styles.portaAberta} src="/img/ui/porta-aberta.png" alt="" />
                </span>
                Sair
              </button>
            </div>

            {/* Confirmação na própria tela, e não `window.confirm`: o mesmo
                motivo da exclusão de personagem — o `confirm` trava a página
                inteira e não dá pra ler direito no celular. E aqui ele
                atrapalharia mais, porque a mensagem muda conforme o modo. */}
            {confirmandoSaida && (
              <div className={styles.confirmacaoDeSaida} role="dialog" aria-label="Sair da partida?">
                <p className={styles.perguntaDeSaida}>Sair da partida?</p>
                <p className={styles.detalheDaSaida}>
                  {emCoop
                    ? 'A sala se desfaz e seu parceiro volta a jogar sozinho. O progresso desta sessão não é gravado — seu personagem continua como estava antes de você entrar.'
                    : 'Seu progresso é gravado na nuvem antes de sair.'}
                </p>
                <div className={styles.botoesDaSaida}>
                  <button type="button" className={styles.botao} onClick={() => void sairDaPartida()} disabled={saindo}>
                    {saindo ? 'Saindo…' : 'Sim, sair'}
                  </button>
                  <button type="button" className={styles.botao} onClick={() => setConfirmandoSaida(false)} disabled={saindo}>
                    Continuar jogando
                  </button>
                </div>
              </div>
            )}

            {/* Fica dentro da narração, e não depois da cena: solto lá
                embaixo ele caía **abaixo do bloco mais alto** — como a
                navegação é mais alta que o texto, sobravam trezentos
                pixels de nada entre os botões e esta linha. */}
            <p className={styles.estadoSalvamento}>
              {emCoop && `Sala ${sala.codigo} · ${conduzo ? 'você conduz a exploração' : 'o anfitrião conduz'} · o progresso desta sessão não é gravado`}
              {!emCoop && salvamento === 'salvando' && 'Salvando na nuvem…'}
              {!emCoop && salvamento === 'salvo' && 'Progresso salvo na nuvem.'}
            </p>

            {erro && <p className={styles.erro}>{erro}</p>}
          </div>

          {/* Mapa e bússola formam um bloco só. Separados — como estavam,
              com a bússola lá embaixo depois dos botões — olhar onde dá pra
              ir e clicar pra ir viravam dois movimentos de olho na tela. */}
          <aside className={styles.navegacao} aria-label="Mapa e movimento">
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

            {/* O original mostrava a mesma dica embaixo dos botões. Só
                aparece onde há teclado: no celular ela seria mentira. */}
            <p className={styles.dicaDoTeclado}>Use WASD ou as setas do teclado.</p>

            {/* Botão, e não `title` no ícone: a legenda tem que abrir no
                toque também, e um alvo de 15px não é alvo de dedo. */}
            <button
              type="button"
              className={styles.chaveDaLegenda}
              aria-expanded={legendaAberta}
              onClick={() => setLegendaAberta((aberta) => !aberta)}
            >
              {legendaAberta ? '▾ Legenda' : '▸ Legenda'}
            </button>

            {/* A legenda desenha a mesma arte da grade, resolvida pelo mesmo
                `arteDoTipo` — antes era uma segunda lista de emoji escrita à
                mão. O nome fica de pé mesmo se um tipo novo chegar sem arte. */}
            {legendaAberta && (
              <ul className={styles.legenda}>
                {visual.legenda.map(([tipo, nome]) => {
                  const arte = arteDoTipo(tipo);
                  return (
                    <li key={nome} className={styles.itemLegenda}>
                      {arte && <img className={styles.arteDaLegenda} src={arte} alt="" aria-hidden />}
                      <span>{nome}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>
        </div>
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
