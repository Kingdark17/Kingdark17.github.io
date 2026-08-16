/**
 * A foto de perfil como recurso próprio, em vez de base64 dentro do JSON.
 *
 * O banco guarda `avatar_url` em duas formas (ver `profile.service.ts`):
 * um `https://` que o jogador digitou, ou um `data:image/...;base64,...`
 * de até 400 KB vindo da compressão no navegador. O segundo caso era o
 * problema: `/api/friends` devolve amigos + pedidos recebidos + pedidos
 * enviados, cada um com a foto inteira embutida, e a resposta é
 * `no-store` — abrir `/amigos` e depois `/multiplayer` baixava tudo duas
 * vezes.
 *
 * Agora a lista devolve só um endereço, e a foto vem por
 * `GET /api/users/:username/avatar?v=...` (ver `avatar.controller.ts`).
 * O `v` é a impressão digital do conteúdo: trocar de foto muda o endereço,
 * então dá pra mandar o navegador guardar pra sempre sem nunca servir
 * foto velha.
 */

import { createHash } from 'node:crypto';

/** Prefixo aceito por `UPLOADED_PHOTO_PATTERN` no `profile.service.ts`. */
const PREFIXO_DE_UPLOAD = 'data:image/';

const UPLOAD = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/i;

export interface AvatarDecodificado {
  mime: string;
  bytes: Buffer;
}

/** True quando a foto está guardada como `data:` e não como link externo. */
export function isUploadedAvatar(avatarUrl: string): boolean {
  return avatarUrl.startsWith(PREFIXO_DE_UPLOAD);
}

/**
 * Chave de cache, não segurança: 12 hex de SHA-256 do próprio `data:` URL.
 * Só precisa mudar quando a foto muda.
 */
export function avatarVersion(avatarUrl: string): string {
  return createHash('sha256').update(avatarUrl).digest('hex').slice(0, 12);
}

/**
 * O que vai na lista de amigos no lugar da foto. Link externo passa
 * inteiro (o navegador já sabe buscar e guardar); upload vira caminho
 * pro endpoint. Vazio continua vazio — quem não tem foto aparece com a
 * inicial do nome.
 *
 * O caminho é **relativo**: o front prefixa com a base da API
 * (`lib/api/amigos.ts`), que é outro domínio do front.
 */
export function publicAvatarUrl(username: string, avatarUrl: string): string {
  if (!avatarUrl || !isUploadedAvatar(avatarUrl)) return avatarUrl;
  return `/api/users/${encodeURIComponent(username)}/avatar?v=${avatarVersion(avatarUrl)}`;
}

/** Devolve `null` pra link externo, foto ausente ou base64 corrompido. */
export function decodeAvatar(avatarUrl: string): AvatarDecodificado | null {
  const casou = UPLOAD.exec(avatarUrl);
  if (!casou) return null;

  const bytes = Buffer.from(casou[2], 'base64');
  if (bytes.length === 0) return null;
  return { mime: casou[1].toLowerCase(), bytes };
}
