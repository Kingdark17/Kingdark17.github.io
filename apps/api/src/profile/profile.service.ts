/**
 * Orquestração de perfil/cosméticos — porta de `/api/account/profile`
 * (PUT), `/api/account/profile/catalog` (GET) e
 * `/api/account/profile/purchase` (POST) do `accounts.js` original.
 */

import {
  PROFILE_CATALOG,
  PROFILE_COLORS,
  PROFILE_FRAMES,
  PROFILE_PETS,
  safeUser,
  type Cosmetics,
  type ProfileCatalogItem,
  type SafeUser,
} from '../auth/cosmetics';
import { isValidSlot } from '../auth/validation';
import { signSave, type JsonValue } from '../auth/save-signature';
import { ArmazenamentoNulo, caminhoDaFoto, type ArmazenamentoDeArquivos } from '../arquivos/armazenamento';
import { decodeAvatar } from '../social/avatar';
import type { ProfileRepository } from './profile-repository';
import { comoTexto } from '../common/texto';

const REMOTE_PHOTO_PATTERN = /^https:\/\//i;
const UPLOADED_PHOTO_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i;
const MAX_REMOTE_PHOTO_LENGTH = 500;
const MAX_UPLOADED_PHOTO_LENGTH = 400000;

const ALL_FRAMES: readonly string[] = PROFILE_FRAMES;
const ALL_COLORS: readonly string[] = PROFILE_COLORS;
const ALL_PETS: readonly string[] = PROFILE_PETS;

export type UpdateProfileResult =
  { kind: 'invalid-avatar' } | { kind: 'invalid-selection' } | { kind: 'not-unlocked' } | { kind: 'ok'; user: SafeUser };

export type PurchaseResult =
  | { kind: 'item-not-found' }
  | { kind: 'admin-only' }
  | { kind: 'invalid-slot' }
  | { kind: 'no-character' }
  | { kind: 'already-owned' }
  | { kind: 'insufficient-gold' }
  | { kind: 'purchased'; item: ProfileCatalogItem; user: SafeUser; save: unknown; signature: string };

export class ProfileService {
  constructor(
    private readonly repo: ProfileRepository,
    private readonly adminUsername: string,
    private readonly signingSecret: string,
    private readonly armazenamento: ArmazenamentoDeArquivos = new ArmazenamentoNulo(),
  ) {}

  listCatalog(isAdmin: boolean, cosmetics: Cosmetics): { catalog: ProfileCatalogItem[]; owned: Cosmetics } {
    return { catalog: PROFILE_CATALOG.filter((item) => !item.adminOnly || isAdmin), owned: cosmetics };
  }

  async updateProfile(
    userId: number,
    currentCosmetics: Cosmetics,
    input: { avatarUrl?: unknown; frame?: unknown; nameColor?: unknown; pet?: unknown },
  ): Promise<UpdateProfileResult> {
    const avatarUrl = comoTexto(input.avatarUrl).trim();
    const frame = comoTexto(input.frame, 'none');
    const nameColor = comoTexto(input.nameColor, '#e8d7a5').toLowerCase();
    const pet = comoTexto(input.pet, 'none');

    const remotePhoto = REMOTE_PHOTO_PATTERN.test(avatarUrl) && avatarUrl.length <= MAX_REMOTE_PHOTO_LENGTH;
    const uploadedPhoto = UPLOADED_PHOTO_PATTERN.test(avatarUrl) && avatarUrl.length <= MAX_UPLOADED_PHOTO_LENGTH;
    if (avatarUrl && !remotePhoto && !uploadedPhoto) return { kind: 'invalid-avatar' };

    if (!ALL_FRAMES.includes(frame) || !ALL_COLORS.includes(nameColor) || !ALL_PETS.includes(pet)) {
      return { kind: 'invalid-selection' };
    }
    if (!currentCosmetics.frames.includes(frame) || !currentCosmetics.colors.includes(nameColor) || !currentCosmetics.pets.includes(pet)) {
      return { kind: 'not-unlocked' };
    }

    const guardado = uploadedPhoto ? await this.subirFoto(userId, avatarUrl) : avatarUrl;

    const account = await this.repo.updateProfile(userId, { avatarUrl: guardado, frame, nameColor, pet });
    return { kind: 'ok', user: safeUser(account, this.adminUsername) };
  }

  /**
   * A foto sai do JSON e vira objeto no Storage — e o que fica no banco é
   * um `https://` de menos de cem caracteres.
   *
   * Isso funciona sem tocar em mais nada porque o resto do código já sabe
   * lidar com link externo: `REMOTE_PHOTO_PATTERN` aceita, a lista de
   * amigos devolve no campo `url`, e o navegador busca direto. O `data:`
   * era o caso especial, não o link.
   *
   * **Falha volta pro banco em vez de recusar a troca.** Storage fora do
   * ar, chave errada ou balde inexistente devolvem o `data:` original, e
   * aí a foto é guardada como sempre foi. A pessoa não perde a ação por
   * causa de infraestrutura, e a rota `/api/users/:username/avatar`
   * continua servindo esse caso. Mesmo acordo do depósito de salas.
   */
  private async subirFoto(userId: number, dataUrl: string): Promise<string> {
    const foto = decodeAvatar(dataUrl);
    if (!foto) return dataUrl;

    try {
      const caminho = caminhoDaFoto(userId, foto.bytes, foto.mime);
      const endereco = await this.armazenamento.guardar(caminho, foto.bytes, foto.mime);
      await this.limparFotosAntigas(userId, caminho);
      return endereco;
    } catch {
      return dataUrl;
    }
  }

  /**
   * O nome do objeto é o hash do conteúdo, então trocar de foto **cria**
   * um objeto novo em vez de substituir. Sem esta varrida, cada troca
   * deixaria até 400 KB pra trás pra sempre.
   *
   * Roda depois de o novo já estar no ar: se falhar, sobra lixo — nunca
   * fica a pessoa sem foto.
   */
  private async limparFotosAntigas(userId: number, manter: string): Promise<void> {
    const antigos = await this.armazenamento.listar(`${userId}/`);
    await Promise.all(antigos.filter((caminho) => caminho !== manter).map((caminho) => this.armazenamento.apagar(caminho)));
  }

  async purchase(userId: number, input: { id?: unknown; slot?: unknown }, isAdmin: boolean): Promise<PurchaseResult> {
    const item = PROFILE_CATALOG.find((entry) => entry.id === comoTexto(input.id));
    if (!item) return { kind: 'item-not-found' };
    if (item.adminOnly && !isAdmin) return { kind: 'admin-only' };
    const slot = Number(input.slot);
    if (!isValidSlot(slot)) return { kind: 'invalid-slot' };

    const outcome = await this.repo.purchase(userId, slot, item);
    if (outcome.kind !== 'purchased') return outcome;

    return {
      kind: 'purchased',
      item,
      user: safeUser(outcome.account, this.adminUsername),
      save: outcome.save,
      signature: signSave(userId, slot, outcome.save as JsonValue, this.signingSecret),
    };
  }
}
