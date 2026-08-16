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

import { io, type Socket } from 'socket.io-client';

import { lerToken } from '../api/session';

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
  inventory: unknown[];
  party: Record<string, unknown>[];
  publicProfile: CosmeticosPublicos | null;
}

export interface Convite {
  de: string;
  codigo: string;
  nomeDoAnfitriao: string;
}

export type FaseDaSala = 'desligado' | 'conectando' | 'conectado' | 'esperando' | 'jogando';

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
  recado: '',
  erro: '',
};

type Ouvinte = () => void;

let socket: Socket | null = null;
let instantaneo: EstadoDaSala = VAZIO;
const ouvintes = new Set<Ouvinte>();

export function instantanea(): EstadoDaSala {
  return instantaneo;
}

export function assinar(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
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
 */
export function conectar(): void {
  if (socket) return;

  const token = lerToken();
  if (!token) {
    mudar({ erro: 'Entre na sua conta para jogar com alguém.' });
    return;
  }

  mudar({ fase: 'conectando', erro: '' });
  const conexao = io(baseUrl(), { transports: ['websocket'], forceNew: true });
  socket = conexao;

  conexao.on('connect', () => conexao.emit('auth', { token }));
  conexao.on('connect_error', () => mudar({ fase: 'desligado', erro: 'Não foi possível falar com o servidor.' }));
  conexao.on('disconnect', () => mudar({ fase: 'desligado', codigo: '', papel: null, perfis: {}, remoto: null }));

  conexao.on('authed', (dados: { username?: string }) => mudar({ fase: 'conectado', eu: dados?.username ?? '', erro: '' }));
  conexao.on('auth-error', () => mudar({ fase: 'desligado', erro: 'Sua sessão expirou. Entre de novo.' }));

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
    mudar({ perfis: { ...instantaneo.perfis, [dados.role]: dados.profile } });
  });

  conexao.on('profile-accepted', (dados: { role?: number; profile?: PerfilNaSala }) => {
    if (!dados?.profile || !dados.role) return;
    mudar({ perfis: { ...instantaneo.perfis, [dados.role]: dados.profile } });
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

  conexao.on('move-lock', () => mudar({ travado: true }));
  conexao.on('peer-left', () => mudar({ fase: 'esperando', recado: 'Seu parceiro saiu da sala.', travado: false }));

  conexao.on('role-changed', (dados: { role?: number }) =>
    mudar({ papel: (dados?.role as PapelNaSala) ?? PAPEL_ANFITRIAO, recado: 'Você assumiu a condução da aventura.' }),
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
    ? { ...instantaneo.perfis, ...(Object.fromEntries(Object.entries(perfisRecebidos).map(([papel, perfil]) => [Number(papel), perfil])) as Partial<Record<PapelNaSala, PerfilNaSala>>) }
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
  socket?.disconnect();
  socket = null;
  instantaneo = VAZIO;
  for (const ouvinte of ouvintes) ouvinte();
}

/** Sai da sala mas mantém a conexão — dá pra criar outra sem reconectar. */
export function sairDaSala(): void {
  socket?.disconnect();
  socket = null;
  instantaneo = { ...VAZIO, eu: instantaneo.eu };
  for (const ouvinte of ouvintes) ouvinte();
  conectar();
}

export function criarSala(codigo: string, opcoes: { publica: boolean; nome: string }): void {
  socket?.emit('create', { room: codigo, name: opcoes.nome, public: opcoes.publica, accountToken: lerToken() ?? '' });
}

export function entrarNaSala(codigo: string, nome: string): void {
  socket?.emit('join', { room: codigo, name: nome, accountToken: lerToken() ?? '' });
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
