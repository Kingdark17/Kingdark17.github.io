/**
 * Sessão de tempo real: conexão socket.io, sala co-op, convites e o
 * estado que chega do parceiro.
 *
 * **Mora fora do React de propósito**, igual à engine. A conexão é uma
 * só por aba e sobrevive a navegação entre páginas; um provider React
 * teria o ciclo de vida errado pra isso (o StrictMode monta duas vezes em
 * dev e conectaria duas vezes). Quem quiser ler assina com
 * `useSyncExternalStore` — ver `use-sala.ts`.
 *
 * O instantâneo é imutável: cada mudança troca o objeto inteiro, que é o
 * que `useSyncExternalStore` precisa pra decidir se re-renderiza.
 *
 * Papéis: 1 cria a sala e conduz a exploração; 2 acompanha. Se o papel 1
 * cai, o servidor promove quem ficou e manda `role-changed` — sem isso a
 * sala travava (ver `room-registry.ts`).
 */

import type { Socket } from 'socket.io-client';

import { urlDaApi } from '../api/client';
import { Descompressor, suportaDeflate, type PacoteComprimido } from './descomprimir';

export type PapelNaSala = 1 | 2;

export const PAPEL_ANFITRIAO: PapelNaSala = 1;
export const PAPEL_CONVIDADO: PapelNaSala = 2;

/** Cosméticos do parceiro, saneados pelo servidor (`sanitizeCosmetics`). */
export interface CosmeticosPublicos {
  username: string;
  avatarUrl: string;
  frame: string;
  nameColor: string;
  pet: string;
}

export interface PerfilNaSala {
  name: string;
  hero: Record<string, unknown>;
  /**
   * **Ausente quer dizer "não mudou"**, nunca "esvaziou" — a mesma regra
   * que a subida já usa (`instantaneoDaSala`). O servidor só reenvia a
   * mochila quando ela é outra; eram 11,5 KB de um pacote de 20,3 KB,
   * ecoados a cada ação de jogo sem novidade nenhuma.
   *
   * Quem preserva a anterior é `comMochilaPreservada`, aqui na fronteira,
   * pra que ninguém mais no front precise saber disso. O perfil do
   * parceiro nunca tem mochila, por outro motivo (a tela dele não lê).
   */
  inventory?: unknown[];
  party: Record<string, unknown>[];
  publicProfile: CosmeticosPublicos | null;
}

export interface Convite {
  de: string;
  codigo: string;
  nomeDoAnfitriao: string;
}

/** Mensagem que chegou enquanto a página estava aberta. */
export interface MensagemRecebida {
  de: string;
  id: string;
  corpo: string;
  quando: string;
}

/**
 * `reconectando` é a queda com sala guardada: a conexão caiu, mas a
 * sessão sabe onde estava e vai voltar sozinha. `desligado` é o fim de
 * verdade — sem sala, ou porque a pessoa saiu.
 */
export type FaseDaSala = 'desligado' | 'conectando' | 'reconectando' | 'conectado' | 'esperando' | 'jogando';

export interface EstadoDaSala {
  fase: FaseDaSala;
  /** Nome de usuário confirmado pelo servidor no `auth`. */
  eu: string;
  codigo: string;
  papel: PapelNaSala | null;
  perfis: Partial<Record<PapelNaSala, PerfilNaSala>>;
  /** Último estado autoritativo recebido — o mapa/posição que valem. */
  remoto: Record<string, unknown> | null;
  turno: number;
  /** True enquanto o anfitrião está andando: o convidado não age. */
  travado: boolean;
  convite: Convite | null;
  /** Última mensagem de amigo empurrada pelo servidor. */
  mensagem: MensagemRecebida | null;
  recado: string;
  erro: string;
}

const VAZIO: EstadoDaSala = {
  fase: 'desligado',
  eu: '',
  codigo: '',
  papel: null,
  perfis: {},
  remoto: null,
  turno: 1,
  travado: false,
  convite: null,
  mensagem: null,
  recado: '',
  erro: '',
};

type Ouvinte = () => void;

let socket: Socket | null = null;
/** Segura chamadas de `conectar()` durante o `import()` do cliente socket. */
let ligando = false;

/**
 * Onde eu estava quando a conexão caiu.
 *
 * Fica fora do instantâneo de propósito: é memória da sessão, não estado
 * de tela. Enquanto isto tem valor, uma reconexão volta pra sala sozinha —
 * é o que faz um deploy da API (ou um túnel que piscou) deixar de acabar
 * com a partida. Antes, **qualquer** queda apagava `codigo` e `papel`, e
 * os dois jogadores caíam pra "conectado" sem sala, tendo que redigitar o
 * código.
 *
 * Zerado só quando a pessoa sai de propósito (`sairDaSala`,
 * `desconectar`) — aí não há o que retomar.
 */
let ondeEuEstava: { codigo: string; nome: string; publica: boolean } | null = null;
let instantaneo: EstadoDaSala = VAZIO;
const ouvintes = new Set<Ouvinte>();

export function instantanea(): EstadoDaSala {
  return instantaneo;
}

export function assinar(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/**
 * A foto do parceiro chega como caminho da API, não como base64 — o
 * relay para de repetir a imagem inteira a cada ação (ver
 * `sanitize.ts`). Como a API mora em outro domínio, o caminho vira
 * absoluto antes de chegar num `<img>`.
 */
function comFotoAbsoluta(perfil: PerfilNaSala): PerfilNaSala {
  const cosmeticos = perfil.publicProfile;
  if (!cosmeticos?.avatarUrl.startsWith('/')) return perfil;
  return { ...perfil, publicProfile: { ...cosmeticos, avatarUrl: urlDaApi(cosmeticos.avatarUrl) } };
}

/**
 * Perfil sem `inventory` mantém a mochila que já estava guardada.
 *
 * **É aqui que a regra mora, e só aqui.** Nada mais no front lê a mochila
 * de um perfil de sala — o cartão do parceiro lê nome, nível, classe e
 * cosméticos, e quem devolve a mochila pro jogo é `aplicarRemoto`, a partir
 * do que esta função guardou. Deixar o instantâneo completo poupa todo o
 * resto de conhecer o acordo.
 *
 * Substituir o objeto inteiro seria perder a mochila em silêncio, e ela
 * voltaria vazia pro servidor na sincronização seguinte — perda de verdade,
 * não de tela. É a mesma armadilha que `sanitizeProfile` documenta do lado
 * de lá; o remédio tinha que existir dos dois.
 *
 * Pura e exportada de propósito: é a regra que, errada, apaga mochila, e
 * dentro do módulo do socket ela não teria como ser testada.
 */
export function preservarMochila(
  anteriores: Partial<Record<PapelNaSala, PerfilNaSala>>,
  papel: number,
  recebido: PerfilNaSala,
): PerfilNaSala {
  // `undefined` é "não mudou"; `[]` é esvaziar de verdade, e passa reto.
  if (recebido.inventory !== undefined) return recebido;
  const anterior = anteriores[papel as PapelNaSala];
  if (anterior?.inventory === undefined) return recebido;
  return { ...recebido, inventory: anterior.inventory };
}

function guardarPerfil(papel: number, perfil: PerfilNaSala): Partial<Record<PapelNaSala, PerfilNaSala>> {
  return { ...instantaneo.perfis, [papel]: preservarMochila(instantaneo.perfis, papel, comFotoAbsoluta(perfil)) };
}

function mudar(mudanca: Partial<EstadoDaSala>): void {
  instantaneo = { ...instantaneo, ...mudanca };
  for (const ouvinte of ouvintes) ouvinte();
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';
}

/**
 * Conecta e autentica. Chamar de novo com a conexão de pé não faz nada —
 * a tela pode chamar à vontade sem contar quantas vezes montou.
 *
 * O cliente socket.io entra por `import()` dinâmico: são ~45 KB de JS que
 * só fazem sentido pra quem vai abrir uma sala ou ficar de olho no chat.
 * Quem só joga sozinho nunca baixa esse pedaço.
 */
export function conectar(): void {
  if (socket || ligando) return;

  // Antes dava pra recusar aqui mesmo, lendo o token do `localStorage`.
  // Com a sessão em cookie `httpOnly` o JavaScript não enxerga mais nada,
  // então quem decide se a identidade vale é o servidor: a conexão abre e
  // um `auth-error` volta se não houver sessão.
  ligando = true;
  mudar({ fase: 'conectando', erro: '' });
  void import('socket.io-client')
    // `withCredentials` é o que faz o navegador anexar o cookie ao
    // handshake. Sem isso a conexão sobe anônima e o `auth` sempre falha.
    //
    // `auth: { z: 1 }` anuncia que sabemos inflar o pacote da sala. Vai no
    // handshake, e não num evento depois, porque o servidor decide no
    // `handleConnection` — mensagem posterior chegaria tarde demais pro
    // `welcome`. Navegador sem `deflate-raw` não anuncia e recebe cru.
    .then(({ io }) =>
      ligar(
        io(baseUrl(), {
          transports: ['websocket'],
          forceNew: true,
          withCredentials: true,
          ...(suportaDeflate() ? { auth: { z: 1 } } : {}),
        }),
      ),
    )
    .catch(() => mudar({ fase: 'desligado', erro: 'Não foi possível carregar o modo online.' }))
    .finally(() => {
      ligando = false;
    });
}

function ligar(conexao: Socket): void {
  socket = conexao;

  // Corpo vazio de propósito: a prova de identidade é o cookie que o
  // navegador anexou ao handshake, e o gateway lê de lá. O campo `token`
  // do evento continua existindo pro cliente antigo, que ainda o manda.
  conexao.on('connect', () => conexao.emit('auth', {}));
  conexao.on('connect_error', () => mudar({ fase: 'desligado', erro: 'Não foi possível falar com o servidor.' }));

  // A queda **não** apaga mais a sala. `perfis` e `remoto` saem porque
  // ficaram velhos (o servidor não guarda perfil entre reinícios, de
  // propósito), mas o código e o papel ficam pra `authed` poder voltar.
  conexao.on('disconnect', () =>
    mudar(
      ondeEuEstava
        ? { fase: 'reconectando', perfis: {}, remoto: null, recado: 'Conexão caiu. Voltando para a sala…' }
        : { fase: 'desligado', codigo: '', papel: null, perfis: {}, remoto: null },
    ),
  );

  conexao.on('authed', (dados: { username?: string }) => {
    mudar({ fase: 'conectado', eu: dados?.username ?? '', erro: '' });
    // Uma mensagem só: quem decide entre entrar e recriar é o servidor,
    // que é quem sabe se a sala sobreviveu. Ver `handleRejoin`.
    if (ondeEuEstava) {
      conexao.emit('rejoin', { room: ondeEuEstava.codigo, name: ondeEuEstava.nome, public: ondeEuEstava.publica });
    }
  });
  // Cobre os dois casos agora: sessão vencida e nunca ter entrado. O
  // segundo era barrado antes de conectar, quando dava pra ler o token.
  conexao.on('auth-error', () => mudar({ fase: 'desligado', erro: 'Entre na sua conta para jogar com alguém.' }));

  conexao.on('created', (dados: { room?: string }) =>
    mudar({ fase: 'esperando', codigo: dados?.room ?? '', papel: PAPEL_ANFITRIAO, erro: '' }),
  );

  // `hello` chega pra quem já estava na sala quando alguém entra, e é
  // também o aviso de que o convidado entrou de verdade.
  conexao.on('hello', (dados: { room?: string; name?: string; role?: number }) => {
    const souEu = instantaneo.papel === null;
    mudar({
      fase: 'esperando',
      codigo: dados?.room ?? instantaneo.codigo,
      papel: souEu ? ((dados?.role as PapelNaSala) ?? PAPEL_CONVIDADO) : instantaneo.papel,
      recado: souEu ? 'Você entrou na sala.' : `${dados?.name ?? 'Alguém'} entrou na sala.`,
      erro: '',
    });
  });

  conexao.on('profile', (dados: { role?: number; profile?: PerfilNaSala }) => {
    if (!dados?.profile || !dados.role) return;
    mudar({ perfis: guardarPerfil(dados.role, dados.profile) });
  });

  conexao.on('profile-accepted', (dados: { role?: number; profile?: PerfilNaSala }) => {
    if (!dados?.profile || !dados.role) return;
    mudar({ perfis: guardarPerfil(dados.role, dados.profile) });
  });

  // `welcome` é o anfitrião abrindo a aventura; `state` é sincronização
  // no meio do jogo. Os dois trazem o estado que vale.
  conexao.on('welcome', (dados: { state?: Record<string, unknown>; profiles?: Record<string, PerfilNaSala>; turn?: number }) =>
    adotarRemoto(dados, 'jogando'),
  );
  conexao.on('state', (dados: { state?: Record<string, unknown>; profiles?: Record<string, PerfilNaSala>; turn?: number }) =>
    adotarRemoto(dados, 'jogando'),
  );

  // Eco da própria sincronização: o servidor devolve o que aceitou. Não
  // muda de fase — quem abre a aventura é o `welcome` do parceiro.
  conexao.on('authoritative', (dados: { state?: Record<string, unknown>; turn?: number }) => adotarRemoto(dados, null));

  // Os três de cima, comprimidos. O servidor só manda `z` pra quem anunciou
  // `auth: { z: 1 }`, então aqui ou chega comprimido ou chega cru — nunca
  // os dois pro mesmo evento. Ver `descomprimir.ts`.
  const descompressor = suportaDeflate() ? new Descompressor() : null;
  conexao.on('z', (pacote: PacoteComprimido) => {
    if (!descompressor || !pacote?.e) return;
    void descompressor.ler(pacote).then((json) => {
      if (json === null) return;
      const dados = JSON.parse(json) as { state?: Record<string, unknown>; profiles?: Record<string, PerfilNaSala>; turn?: number };
      adotarRemoto(dados, pacote.e === 'authoritative' ? null : 'jogando');
    });
  });

  conexao.on('move-lock', () => mudar({ travado: true }));
  conexao.on('peer-left', () => mudar({ fase: 'esperando', recado: 'Seu parceiro saiu da sala.', travado: false }));

  conexao.on('role-changed', (dados: { role?: number }) =>
    mudar({ papel: (dados?.role as PapelNaSala) ?? PAPEL_ANFITRIAO, recado: 'Você assumiu a condução da aventura.' }),
  );

  // Mensagem de amigo. O servidor empurra pra quem está online, inclusive
  // quando ela foi enviada por REST — é a mesma `SocialService`.
  conexao.on('chat', (dados: { from?: string; id?: string; body?: string; createdAt?: string }) =>
    mudar({
      mensagem: { de: dados?.from ?? '', id: String(dados?.id ?? ''), corpo: dados?.body ?? '', quando: dados?.createdAt ?? '' },
    }),
  );

  conexao.on('room-invite', (dados: { from?: string; code?: string; hostName?: string }) =>
    mudar({ convite: { de: dados?.from ?? '', codigo: dados?.code ?? '', nomeDoAnfitriao: dados?.hostName ?? '' } }),
  );
  conexao.on('room-invite-sent', (dados: { to?: string }) => mudar({ recado: `Convite enviado para ${dados?.to ?? ''}.` }));
  conexao.on('room-invite-error', (dados: { message?: string }) => mudar({ erro: dados?.message ?? 'Não deu para convidar.' }));
  conexao.on('room-invite-response', (dados: { from?: string; accepted?: boolean }) =>
    mudar({ recado: dados?.accepted ? `${dados.from} aceitou o convite.` : `${dados?.from ?? 'O convidado'} recusou o convite.` }),
  );

  conexao.on('error', (dados: { message?: string }) => mudar({ erro: dados?.message ?? 'Erro no servidor.' }));
}

function adotarRemoto(
  dados: { state?: Record<string, unknown>; profiles?: Record<string, PerfilNaSala>; turn?: number } | undefined,
  fase: FaseDaSala | null,
): void {
  if (!dados?.state) return;

  const perfisRecebidos = (dados.state.profiles ?? dados.profiles) as Record<string, PerfilNaSala> | undefined;
  const perfis = perfisRecebidos
    ? {
        ...instantaneo.perfis,
        ...(Object.fromEntries(
          Object.entries(perfisRecebidos).map(([papel, perfil]) => [
            Number(papel),
            preservarMochila(instantaneo.perfis, Number(papel), comFotoAbsoluta(perfil)),
          ]),
        ) as Partial<Record<PapelNaSala, PerfilNaSala>>),
      }
    : instantaneo.perfis;

  mudar({
    ...(fase ? { fase } : {}),
    remoto: dados.state,
    perfis,
    turno: dados.turn ?? instantaneo.turno,
    travado: false,
  });
}

export function desconectar(): void {
  // Sair de propósito zera a memória: não há o que retomar, e sem isto a
  // próxima conexão voltaria sozinha pra uma sala que a pessoa fechou.
  ondeEuEstava = null;
  socket?.disconnect();
  socket = null;
  instantaneo = VAZIO;
  for (const ouvinte of ouvintes) ouvinte();
}

/** Sai da sala mas mantém a conexão — dá pra criar outra sem reconectar. */
export function sairDaSala(): void {
  ondeEuEstava = null;
  socket?.disconnect();
  socket = null;
  instantaneo = { ...VAZIO, eu: instantaneo.eu };
  for (const ouvinte of ouvintes) ouvinte();
  conectar();
}

// Sem `accountToken`: ele servia pro gateway checar se quem cria a sala é
// ADM, e essa checagem passou a sair do cookie do handshake.
export function criarSala(codigo: string, opcoes: { publica: boolean; nome: string }): void {
  ondeEuEstava = { codigo, nome: opcoes.nome, publica: opcoes.publica };
  socket?.emit('create', { room: codigo, name: opcoes.nome, public: opcoes.publica });
}

export function entrarNaSala(codigo: string, nome: string): void {
  ondeEuEstava = { codigo, nome, publica: false };
  socket?.emit('join', { room: codigo, name: nome });
}

export function mandarPerfil(perfil: unknown): void {
  if (!instantaneo.codigo) return;
  socket?.emit('profile', { room: instantaneo.codigo, profile: perfil });
}

/** Só o papel 1: abre a aventura pro parceiro com o estado atual. */
export function abrirAventura(estado: unknown, turno: number): void {
  if (!instantaneo.codigo) return;
  socket?.emit('welcome', { room: instantaneo.codigo, state: estado, turn: turno });
  mudar({ fase: 'jogando' });
}

export function mandarEstado(estado: unknown, turno: number): void {
  if (!instantaneo.codigo) return;
  socket?.emit('state', { room: instantaneo.codigo, state: estado, turn: turno });
}

export function travarParceiro(): void {
  if (!instantaneo.codigo) return;
  socket?.emit('move-lock', { room: instantaneo.codigo });
}

export function convidar(paraQuem: string, codigo: string, nomeDoAnfitriao: string): void {
  socket?.emit('room-invite', { to: paraQuem, code: codigo, hostName: nomeDoAnfitriao });
}

export function responderConvite(convite: Convite, aceito: boolean): void {
  socket?.emit('room-invite-response', { to: convite.de, code: convite.codigo, accepted: aceito });
  mudar({ convite: null });
}

export function limparRecados(): void {
  mudar({ recado: '', erro: '' });
}
