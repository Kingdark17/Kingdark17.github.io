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
 * O herói anda solto dentro da sala (decisão do usuário, 2026-10-11) e
 * aciona o que ela tem **encostando** no conteúdo; a sala de monstro começa
 * a luta assim que se entra (`lutaAoEntrar`), e a escada e a saída
 * perguntam antes (`confirmaAoTocar`). Sala com conteúdo próprio (combate,
 * loja, NPC, quadro de missões, evento) troca esta tela pela dela —
 * `interagir` devolve qual, e `conteudoDaTela` escolhe.
 */

/* eslint-disable @next/next/no-img-element */

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { displayName, idDaRaca, roomArrival, type Direction, type Item, type PetId, type Walker } from '@rpg-legend/shared';
import { usuarioAtual } from '@/lib/api/account';
import { ErroDaApi } from '@/lib/api/client';
import { carregarSave, gravarSave } from '@/lib/api/save';
import { apresentacaoDe } from '@/lib/jogo/apresentacao';
import { arteDoTipo } from '@/lib/jogo/icones-do-mapa';
import { TEMAS, type Figura } from '@/lib/jogo/desenho-da-sala';
import { PARADO, entradaCombinada, plantaDaSala, type PosicaoNaSala, type Vetor } from '@/lib/jogo/andar-na-sala';
import { andar, celulaAtual, retomarSave, vizinhaEm, type EstadoDoJogo, type SaveCarregado } from '@/lib/jogo/estado';
import { confirmaAoTocar, interagir, lutaAoEntrar, type Aviso, type TelaAberta } from '@/lib/jogo/sala';
import { abrirAdm } from '@/lib/jogo/adm';
import { aplicarRemoto, instantaneoDaSala, type CosmeticosDoJogador } from '@/lib/jogo/coop';
import { anotar, type Anotacao } from '@/lib/jogo/diario';
import { abrirMochila, gastarPonto } from '@/lib/jogo/mochila';
import { narrar } from '@/lib/jogo/narrador';
import { direcaoAoSoltar, direcaoDaTecla, estaDigitando } from '@/lib/jogo/teclado';
import { monstroAtual } from '@/lib/jogo/combate';
import { tocar } from '@/lib/som/efeitos';
import { useTrilha } from '@/lib/som/use-trilha';
import type { Tema } from '@/lib/som/musica';
import { marcar, type Recado } from '@/lib/jogo/tutorial';
import { curarNaTela, curarPeloParceiro } from '@/lib/jogo/cura-do-parceiro';
import {
  abrirAventura,
  assinar,
  instantanea,
  mandarCura,
  mandarEstado,
  mandarPerfil,
  PAPEL_ANFITRIAO,
  sairDaSala,
  travarParceiro,
} from '@/lib/rede/sala';
import { useSala } from '@/lib/rede/use-sala';
import type { Combate } from '@/lib/jogo/combate';
import { BichoDeEstimacao } from './bicho-de-estimacao';
import { CenaDaSala } from './cena-da-sala';
import { ControleDeSom } from './controle-de-som';
import styles from './jogo.module.css';
import { Joystick } from './joystick';
import { Mapa } from './mapa';
import { PainelHeroi } from './painel-heroi';
import { TelaGuilda } from './tela-guilda';
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
const TelaPortao = dynamic(() => import('./tela-portao').then((m) => m.TelaPortao), { ssr: false, loading: Abrindo });
const TelaTotem = dynamic(() => import('./tela-totem').then((m) => m.TelaTotem), { ssr: false, loading: Abrindo });
const TelaProfessor = dynamic(() => import('./tela-professor').then((m) => m.TelaProfessor), { ssr: false, loading: Abrindo });

const ESPERA_ANTES_DE_SALVAR_MS = 2500;

/**
 * Teto do adiamento, contado desde a primeira mudança ainda não gravada.
 *
 * Sem ele o adiamento não tem fim: cada passo reinicia os 2,5 s, então
 * quem joga sem parar nunca grava. É o pior caso de perda por aba
 * fechada, travada ou derrubada — dez segundos, não a sessão.
 */
const ESPERA_MAXIMA_MS = 10000;

type EstadoDoSalvamento = 'parado' | 'salvando' | 'salvo';

export function TelaJogo({ slot, sala: codigoDaSala }: { slot: number; sala?: string }) {
  const router = useRouter();
  const sala = useSala();
  const emCoop = !!codigoDaSala && sala.codigo === codigoDaSala;
  const conduzo = !emCoop || sala.papel === PAPEL_ANFITRIAO;

  const [estado, setEstado] = useState<EstadoDoJogo | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [tela, setTela] = useState<TelaAberta | null>(null);
  /** A escada ou a saída perguntando antes (`confirmaAoTocar`), depois do encostão. */
  const [confirmando, setConfirmando] = useState(false);
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
  /**
   * Golpes acertados, só pra o boneco girar a arma. O número não é exibido
   * e não entra no save — é um rastro de acontecimento, como a piscada de
   * dano, e mora aqui porque é aqui que a tela de combate reporta o turno.
   */
  const [golpes, setGolpes] = useState(0);

  const assinatura = useRef('');
  const precisaSalvar = useRef(false);
  /** Quando começou a espera atual. `0` = não há nada esperando pra gravar. */
  const esperandoDesde = useRef(0);
  const abriu = useRef(false);
  const cosmeticos = useRef<CosmeticosDoJogador | null>(null);
  const ultimoRemoto = useRef<Record<string, unknown> | null>(null);
  /**
   * A última cura do parceiro já aplicada. Começa na que já estava na sessão
   * ao montar: voltar pra esta tela não pode reaplicar uma cura antiga.
   */
  const ultimaCura = useRef(instantanea().curaRecebida?.id ?? 0);
  /** O estado já desenhado, pra quem chega de fora do React (a sessão de rede). */
  const estadoDesenhado = useRef<EstadoDoJogo | null>(null);
  /** A mochila da última sincronização — o que permite omiti-la quando não mudou. */
  const mochilaEnviada = useRef<readonly Item[] | null>(null);

  // ------------------------------------------------------- andar na sala
  //
  // O herói anda solto dentro da sala, estilo Isaac (decisão do usuário,
  // 2026-10-11), com a regra da engine (`room-walk.ts`, a mesma do app).
  // Atravessar um vão de porta é a sala vizinha pelo `mover` de sempre;
  // encostar no conteúdo é o que o aciona (`encostar`).
  //
  // Onde ele está dentro da sala não vai pro save: é caminho até a porta.

  const celulaAgora = estado ? celulaAtual(estado) : null;
  const mapaAgora = estado ? `${estado.mapMode}:${estado.masmorra.dungeon}:${estado.masmorra.difficulty}:${estado.floor}` : '';
  const salaAgora = estado ? `${mapaAgora}:${estado.pos.x},${estado.pos.y}` : '';
  const portasAgora = (['N', 'S', 'E', 'W'] as const).filter((d) => celulaAgora?.doors?.[d]).join('');
  const iconeAgora = estado && celulaAgora ? apresentacaoDe(estado).icone(celulaAgora) : '';
  const arteAgora = iconeAgora ? arteDoTipo(celulaAgora?.type) : null;
  const racaAgora = estado ? idDaRaca(estado.hero) : null;
  const emojiDaRaca = estado?.hero.raceIcon || '🙂';

  const planta = useMemo(
    () => plantaDaSala(Object.fromEntries([...portasAgora].map((d) => [d, true])), iconeAgora !== ''),
    [portasAgora, iconeAgora],
  );
  const conteudoDaSala = useMemo<Figura | null>(() => (iconeAgora ? { arte: arteAgora, emoji: iconeAgora } : null), [iconeAgora, arteAgora]);
  // Provisório: o corpo da raça do paperdoll faz o papel do boneco do mapa
  // até o Breno desenhar o de 4 direções.
  const heroiNaCena = useMemo<Figura>(() => ({ arte: racaAgora ? `/img/paperdoll/corpo/${racaAgora}.png` : null, emoji: emojiDaRaca }), [racaAgora, emojiDaRaca]);

  /**
   * Onde o herói aparece nesta sala, junto da sala a que isso pertence.
   * Trocar de sala é recalcular **durante o render** (o padrão do React pra
   * estado que depende do anterior): quem chegou da sala ao lado aparece na
   * porta por onde entrou; quem chegou de outro jeito — portão, escada,
   * totem, derrota — aparece no meio.
   */
  const [naSala, setNaSala] = useState<{ sala: string; mapa: string; x: number; y: number; chegada: Walker } | null>(null);
  if (estado && naSala?.sala !== salaAgora) {
    const dx = estado.pos.x - (naSala?.x ?? 0);
    const dy = estado.pos.y - (naSala?.y ?? 0);
    const vizinha = naSala?.mapa === mapaAgora && Math.abs(dx) + Math.abs(dy) === 1;
    const veioPor: Direction | null = vizinha ? (dx === 1 ? 'E' : dx === -1 ? 'W' : dy === 1 ? 'S' : 'N') : null;
    setNaSala({ sala: salaAgora, mapa: mapaAgora, x: estado.pos.x, y: estado.pos.y, chegada: roomArrival(veioPor) });
  }
  const chegadaNaSala = naSala?.sala === salaAgora ? naSala.chegada : roomArrival(null);

  /** Onde o herói está agora: a cena escreve aqui a cada passo, e sobrevive a ela desmontar. */
  const posicao = useRef<PosicaoNaSala>({ sala: null, walker: roomArrival(null), tocando: null });
  /** As direções seguradas no teclado e o joystick: o andar lê os dois a cada passo. */
  const teclas = useRef(new Set<Direction>());
  const joystick = useRef<Vetor>(PARADO);
  const entrada = useCallback(() => entradaCombinada(teclas.current, joystick.current), []);
  const moverJoystick = useCallback((vetor: Vetor) => {
    joystick.current = vetor;
  }, []);

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

  useEffect(() => {
    estadoDesenhado.current = estado;
  });

  /**
   * Cura que o parceiro mandou (Cura Menor, Renovação Natural). Aplicada no
   * meu herói — no estado do jogo **e** na tela aberta, que guarda cópia
   * própria (ver `curarNaTela`).
   *
   * **Não sincroniza, e de propósito.** O servidor já curou o meu perfil
   * antes de repassar (`curarPerfil`, na API), e o pacote que o parceiro
   * manda logo em seguida me devolve o herói curado. Mandar o estado daqui
   * levava junto o mapa de antes do golpe dele — o servidor aceitava, e a
   * sala que a equipe acabara de limpar voltava pros dois.
   *
   * A vida sobe por atualização funcional; o quanto curou, pro aviso, sai
   * do estado desenhado. Com a vida já cheia não há cura, e não há aviso.
   */
  useEffect(() => {
    if (!emCoop) return;
    return assinar(() => {
      const cura = instantanea().curaRecebida;
      if (!cura || cura.id === ultimaCura.current) return;
      ultimaCura.current = cura.id;

      const desenhado = estadoDesenhado.current;
      if (!desenhado) return;
      const { curou } = curarPeloParceiro(desenhado, cura.quantia);
      if (curou === 0) return;

      setEstado((atual) => (atual ? curarPeloParceiro(atual, cura.quantia).estado : atual));
      setTela((aberta) => (aberta ? curarNaTela(aberta, cura.quantia) : aberta));

      const recebida = { titulo: 'Cura do parceiro', texto: `Seu parceiro cura você em ${curou} de Vida.` };
      setRecado(recebida);
      setDiario((atual) => anotar(atual, { icone: '✨', ...recebida }));
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
    setConfirmando(false);
    sincronizar(proximo);
  }

  /**
   * Entrar na sala vizinha. Só a de monstro aciona alguma coisa na
   * entrada — a luta; o resto espera o herói encostar no que ela tem.
   * Devolve se entrou.
   */
  function entrar(atual: EstadoDoJogo, direcao: Direction): boolean {
    const movido = andar(atual, direcao);
    if (movido === atual) return false;

    // "Dê o primeiro passo" fecha aqui; as outras etapas de sala saem
    // de dentro de `interagir`, que sabe em que sala o jogador caiu.
    const passo = marcar(movido, 'move');
    if (!lutaAoEntrar(celulaAtual(passo.estado))) {
      tocar('step');
      registrarMudanca(passo.estado, null);
      recadar(passo.recado);
      return true;
    }

    const resultado = interagir(passo.estado, undefined, pet);
    tocar(resultado.som ?? 'step');
    registrarMudanca(resultado.estado, resultado.aviso);
    recadar(resultado.recado ?? passo.recado);
    setTela(resultado.tela);
    return true;
  }

  /** O que a sala tem, acionado agora: o encostão (ou o "sim" da escada e da saída). */
  function interagirAqui(atual: EstadoDoJogo) {
    const resultado = interagir(atual, undefined, pet);
    if (resultado.som) tocar(resultado.som);
    registrarMudanca(resultado.estado, resultado.aviso);
    recadar(resultado.recado);
    setTela(resultado.tela);
  }

  /**
   * O herói encostou no conteúdo da sala. A escada e a saída perguntam
   * antes, porque não têm volta; o resto aciona na hora. No co-op, quem
   * conduz avisa o parceiro antes de mexer no mapa, como ao andar.
   */
  function encostar() {
    if (!estado || !conduzo || tela) return;
    const celula = celulaAtual(estado);
    if (!celula) return;
    if (emCoop) travarParceiro();
    if (confirmaAoTocar(celula)) {
      setAviso(null);
      setConfirmando(true);
      return;
    }
    interagirAqui(estado);
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

  /**
   * O herói atravessou o vão desta porta. Devolve se a sala mudou — sem
   * sala vizinha (ou sem a vez, no co-op) a cena o põe de volta pra dentro.
   */
  function mover(direcao: Direction): boolean {
    if (!estado || !conduzo) return false;

    // Quem conduz avisa o parceiro que está andando: enquanto isso ele não
    // age, senão os dois mexem no mesmo mapa ao mesmo tempo.
    if (emCoop) travarParceiro();

    if (!vizinhaEm(estado, direcao)) return false;
    return entrar(estado, direcao);
  }

  /**
   * Pode andar agora: nada por cima da sala. As mesmas condições valem pro
   * teclado — tecla que anda com uma pergunta na frente burla a tela, e no
   * co-op mexeria no mapa do parceiro fora da vez.
   */
  const andando = !!estado && !tela && !guiaAberto && !diarioAberto && !confirmandoSaida && !confirmando && conduzo;
  const podeAndar = useRef(andando);
  useEffect(() => {
    podeAndar.current = andando;
    // Abriu algo por cima: solta as teclas, senão o herói seguiria andando
    // sozinho quando a tela fechasse com a tecla já solta.
    if (!andando) teclas.current.clear();
  }, [andando]);

  /**
   * WASD e setas andam, como `bindKeyboard()` fazia em `js/ui.js`. A tecla
   * é estado: apertar põe a direção no conjunto, soltar tira, e o andar lê
   * o conjunto a cada passo (duas juntas são diagonal).
   *
   * Com a sala livre, a tecla é do jogo mesmo de cara pra parede: seta que
   * ora anda e ora rola a página é pior que seta que não faz nada — e a
   * repetição da tecla segurada também é barrada, senão a página rolaria
   * enquanto o herói anda. Fora da exploração ela rola normalmente.
   */
  useEffect(() => {
    function aoApertar(evento: KeyboardEvent) {
      if (estaDigitando(evento.target as HTMLElement | null)) return;
      const direcao = direcaoDaTecla(evento);
      if (!direcao || !podeAndar.current) return;
      teclas.current.add(direcao);
      evento.preventDefault();
    }
    function aoSoltar(evento: KeyboardEvent) {
      const direcao = direcaoAoSoltar(evento);
      if (direcao) teclas.current.delete(direcao);
    }
    // Trocou de janela com a tecla apertada: o soltar nunca chega aqui.
    function aoSairDaJanela() {
      teclas.current.clear();
    }

    window.addEventListener('keydown', aoApertar);
    window.addEventListener('keyup', aoSoltar);
    window.addEventListener('blur', aoSairDaJanela);
    return () => {
      window.removeEventListener('keydown', aoApertar);
      window.removeEventListener('keyup', aoSoltar);
      window.removeEventListener('blur', aoSairDaJanela);
    };
  }, []);

  if (carregando) return <p>Carregando progresso…</p>;
  if (erro && !estado) return <p className={styles.erro}>{erro}</p>;
  if (!estado) return null;

  function conteudoDaTela(aberta: TelaAberta) {
    switch (aberta.tipo) {
      case 'combate':
        return (
          <TelaCombate
            combate={aberta.combate}
            lugar={aberta.combate.estado.mapMode === 'dungeon' ? aberta.combate.estado.masmorra.dungeon : 'cidade'}
            onCombate={(proximo) => {
              // Número flutuante sobre o inimigo é o que a regra já sabe
              // sobre "o herói acertou" — ler isso é melhor que inventar um
              // campo novo, e melhor que a tela deduzir do texto do log.
              // A lista zera a cada ação, então não há acerto contado duas
              // vezes.
              if (proximo.flutuantes.some((numero) => numero.alvo === 'inimigo')) setGolpes((quantos) => quantos + 1);
              seguir({ tipo: 'combate', combate: proximo }, proximo.estado);
            }}
            onEncerrar={(final) => fechar(final.estado, avisoDoFim(final))}
            // Solo, a cura não tem pra quem ir: os companheiros já a
            // receberam dentro do próprio `castPower`.
            onCuraDoParceiro={(quantia) => {
              if (emCoop) mandarCura(quantia);
            }}
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
      case 'guilda':
        return (
          <TelaGuilda
            guilda={aberta.guilda}
            onGuilda={(proxima) => {
              seguir({ tipo: 'guilda', guilda: proxima }, proxima.estado);
              if (proxima.recado) recadar(proxima.recado);
            }}
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
      case 'portao':
        return (
          <TelaPortao
            portao={aberta.portao}
            // Escolher não muda o save: só a tela. Quem muda é entrar.
            onPortao={(proximo) => setTela({ tipo: 'portao', portao: proximo })}
            onEntrar={(entrada) => {
              tocar('door');
              fechar(entrada.estado, { icone: '🌟', titulo: 'Portão da Masmorra', texto: entrada.texto });
              recadar(entrada.recado);
            }}
            onFechar={() => fechar(aberta.portao.estado)}
          />
        );
      case 'professor':
        return (
          <TelaProfessor
            professor={aberta.professor}
            onProfessor={(proximo) => seguir({ tipo: 'professor', professor: proximo }, proximo.estado)}
            onFechar={(final) => fechar(final.estado)}
          />
        );
      case 'totem':
        return (
          <TelaTotem
            totem={aberta.totem}
            onVoltar={(cidade) => {
              tocar('door');
              fechar(cidade, { icone: '🗿', titulo: 'Totem Antigo', texto: 'A luz do totem envolve você, e você reaparece na cidade.' });
            }}
            onFechar={(final) => fechar(final, { icone: '🗿', titulo: 'Totem Antigo', texto: aberta.totem.texto })}
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
            <span>
              <TextoDoJogo>{recado.texto}</TextoDoJogo>
            </span>
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
        {/* Só aqui o contador de golpes vale a pena: é a única ramificação
            que pode ter a tela de combate aberta. Nas outras o painel fica
            com o padrão e o boneco não gira — não há o que girar por. */}
        <PainelHeroi
          hero={estado.hero}
          golpes={golpes}
          onPonto={
            tela.tipo === 'mochila'
              ? (chave) => {
                  const proxima = gastarPonto(tela.mochila, chave);
                  seguir({ tipo: 'mochila', mochila: proxima }, proxima.estado);
                }
              : undefined
          }
        />
        {conteudoDaTela(tela)}
        {enfeites}
      </div>
    );
  }

  const visual = apresentacaoDe(estado);
  const narracao = narrar(estado);
  // Calculada aqui, e não `celulaAgora`: passar aquela às funções da
  // apresentação faria o React Compiler supor que ela muda depois do render
  // e desistir das memoizações lá de cima.
  const alvoDaPergunta = confirmando ? celulaAtual(estado) : null;

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
            <CenaDaSala
              sala={salaAgora}
              planta={planta}
              tema={TEMAS[estado.mapMode === 'dungeon' ? estado.masmorra.dungeon : 'cidade']}
              conteudo={conteudoDaSala}
              heroi={heroiNaCena}
              chegada={chegadaNaSala}
              posicao={posicao}
              ativo={andando}
              entrada={entrada}
              onSaida={mover}
              onEncostar={encostar}
            >
              <Joystick onVetor={moverJoystick} ativo={andando} />
            </CenaDaSala>

            {/* Tudo o que vem depois da sala, junto: no celular deitado a
                sala fica sozinha à esquerda e isto vai pra direita. */}
            <div className={styles.ladoDaCena}>
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

              {/* A escada e a saída, que não têm volta, perguntam depois do
                  encostão. "Não" só fecha: o herói continua na sala. */}
              {alvoDaPergunta && (
                <div className={styles.caixa} role="dialog" aria-label={alvoDaPergunta.type === 'stairs' ? 'Descer as escadas?' : 'Sair da masmorra?'}>
                  <span className={styles.iconeCaixa} aria-hidden>
                    {visual.icone(alvoDaPergunta) || '🚪'}
                  </span>
                  <div>
                    <p className={styles.textoCaixa}>
                      <TextoDoJogo>{visual.textoDeEntrada(alvoDaPergunta)}</TextoDoJogo>
                    </p>
                    <div className={styles.escolhas}>
                      <button type="button" className={`${styles.botao} ${styles.botaoPrincipal}`} onClick={() => interagirAqui(estado)}>
                        Sim
                      </button>
                      <button type="button" className={styles.botao} onClick={() => setConfirmando(false)}>
                        Não
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {aviso && !confirmando && (
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
                  pergunta da escada na tela — beber uma poção antes de descer
                  pro andar seguinte é justamente quando ela serve. */}
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
          </div>

          {/* O mapa do andar. A bússola que ficava aqui saiu com o andar
              solto (2026-10-11): anda-se pelo teclado ou pelo joystick, que
              aparece onde o dedo encosta na sala. */}
          <aside className={styles.navegacao} aria-label="Mapa">
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

            {/* Só aparece onde há teclado: no celular ela seria mentira, e
                lá a dica do joystick aparece na própria sala. */}
            <p className={styles.dicaDoTeclado}>Ande com WASD ou as setas. Encoste no que está na sala para interagir.</p>

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
