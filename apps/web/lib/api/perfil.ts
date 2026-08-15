/**
 * Perfil e loja de cosméticos (`/api/account/profile[/catalog|/purchase]`).
 *
 * A compra sai do **ouro do personagem**, não de uma carteira da conta: o
 * servidor recebe o `slot`, desconta o ouro daquele save e devolve o save
 * já descontado junto de uma assinatura nova. Quem estiver com o jogo
 * aberto precisa adotar as duas coisas, senão a próxima gravação vai com
 * o ouro antigo e a assinatura velha.
 */

import type { PetId } from '@rpg-legend/shared';

import type { Usuario } from './account';
import { chamarApi } from './client';

export type TipoDeCosmetico = 'frame' | 'color' | 'pet';

export interface ItemDeCosmetico {
  id: string;
  type: TipoDeCosmetico;
  value: string;
  name: string;
  icon: string;
  price: number;
  adminOnly?: boolean;
}

export interface Cosmeticos {
  frames: string[];
  colors: string[];
  pets: string[];
}

export interface Catalogo {
  catalog: ItemDeCosmetico[];
  owned: Cosmeticos;
}

export interface PerfilEscolhido {
  avatarUrl: string;
  frame: string;
  nameColor: string;
  pet: PetId | 'none';
}

export interface CompraFeita {
  ok: true;
  item: ItemDeCosmetico;
  user: Usuario;
  save: unknown;
  signature: string;
}

export function catalogoDeCosmeticos(): Promise<Catalogo> {
  return chamarApi<Catalogo>('/api/account/profile/catalog', { autenticado: true });
}

export async function salvarPerfil(escolha: PerfilEscolhido): Promise<Usuario> {
  const resposta = await chamarApi<{ user: Usuario }>('/api/account/profile', {
    method: 'PUT',
    body: escolha,
    autenticado: true,
  });
  return resposta.user;
}

export function comprarCosmetico(id: string, slot: number): Promise<CompraFeita> {
  return chamarApi<CompraFeita>('/api/account/profile/purchase', { method: 'POST', body: { id, slot }, autenticado: true });
}
