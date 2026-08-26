/**
 * Validação/saneamento autoritativo do relay de sala multiplayer — porta
 * de `sanitizeParty`/`sanitizeHero`/`sanitizeProfile`/`publicProfiles` no
 * `server.js` original. Reaproveita `equipmentCap`/`equipmentStat`/
 * `xpForLevel`/`ATTR_KEYS` de `@rpg-legend/shared` pro cálculo de
 * HP/MP — mesma fórmula que `derivedStats()` já unificou entre cliente e
 * servidor (ver o doc comment de `hero/derived.ts`); só a parte de
 * anti-cheat propriamente dita (nível/atributos/ouro só crescem dentro
 * de um teto por submissão) é específica desse relay e não existe em
 * `packages/shared`.
 *
 * Funções puras: recebem o candidato bruto (JSON não-confiável) e o
 * estado anteriormente aceito, devolvem o estado saneado. Não fazem I/O
 * — quem chama (`RoomRegistry`) é responsável por guardar o resultado.
 */

import { ATTR_KEYS, equipmentCap, equipmentStat, xpForLevel, type Equipment } from '@rpg-legend/shared';

import { PROFILE_COLORS, PROFILE_FRAMES, PROFILE_PETS } from '../auth/cosmetics';
import { publicAvatarUrl, resumoDoAvatar } from '../social/avatar';
import { clampInt, cloneJson } from './numeric';
import { comoTexto } from '../common/texto';

const GOD_ATTR = 999;
const GOD_HP = 999999;
const GOD_MP = 999999;
const GOD_GOLD = 999999999;
const MAX_PARTY_SIZE = 2;

export interface SanitizedHeroRecord {
  hero: Record<string, unknown>;
  baseAttrs: number;
}

export function sanitizeParty(party: unknown): Record<string, unknown>[] {
  const list = Array.isArray(party) ? party : [];
  return list.slice(0, MAX_PARTY_SIZE).map((member) => {
    const clean = cloneJson((member ?? {}) as Record<string, unknown>);
    clean.maxHp = clampInt(clean.maxHp, 1, 1000);
    clean.hp = clampInt(clean.hp, 0, clean.maxHp as number);
    clean.attack = clampInt(clean.attack, 1, 250);
    clean.combatsLeft = clean.temporary ? clampInt(clean.combatsLeft, 0, 10) : clean.combatsLeft;
    return clean;
  });
}

export function sanitizeHero(candidate: unknown, previousRecord: SanitizedHeroRecord | null, adminFlag: boolean): SanitizedHeroRecord {
  const hero = cloneJson((candidate ?? {}) as Record<string, unknown>);
  const previous = previousRecord?.hero;

  if (adminFlag) {
    const attrs: Record<string, number> = { ...((hero.attrs as Record<string, number>) ?? {}) };
    for (const key of ATTR_KEYS) attrs[key] = GOD_ATTR;
    hero.attrs = attrs;
    hero.level = clampInt(hero.level, 1, 9999) || 1;
    hero.maxHp = GOD_HP;
    hero.maxMp = GOD_MP;
    hero.hp = GOD_HP;
    hero.mp = GOD_MP;
    hero.xpNext = xpForLevel(hero.level as number);
    hero.xp = clampInt(hero.xp, 0, hero.xpNext as number);
    hero.attrPoints = clampInt(hero.attrPoints, 0, 999);
    hero.gold = GOD_GOLD;
    hero.killCount = clampInt(hero.killCount, 0, 100000000);
    if (hero.derived && typeof hero.derived === 'object') {
      hero.derived = { ...(hero.derived as Record<string, unknown>), maxHp: GOD_HP, maxMp: GOD_MP };
    }
    return { hero, baseAttrs: ATTR_KEYS.length * GOD_ATTR };
  }

  const previousLevel = previous ? clampInt(previous.level, 1, 500) : 1;
  hero.level = previous ? clampInt(hero.level, previousLevel, previousLevel + 5) : 1;

  const attrs: Record<string, number> = { ...((hero.attrs as Record<string, number>) ?? {}) };
  for (const key of ATTR_KEYS) attrs[key] = clampInt(attrs[key], 1, previous ? 99 : 20);
  hero.attrs = attrs;

  const total = ATTR_KEYS.reduce((sum, key) => sum + attrs[key], 0);
  const baseline = previousRecord?.baseAttrs ? previousRecord.baseAttrs : Math.min(total, 100);
  const allowedTotal = baseline + Math.max(0, (hero.level as number) - 1) * 2;
  if (total > allowedTotal) {
    let excess = total - allowedTotal;
    for (const key of [...ATTR_KEYS].reverse()) {
      const cut = Math.min(excess, Math.max(0, attrs[key] - 1));
      attrs[key] -= cut;
      excess -= cut;
    }
  }

  const cap = equipmentCap(hero.level as number);
  const equip = (hero.equip ?? {}) as Equipment;
  const calculatedHp = 20 + (hero.level as number) * 5 + attrs.constituicao * 10 + equipmentStat(equip, 'vida', cap);
  const calculatedMp = 10 + (hero.level as number) * 2 + attrs.intelecto * 5 + equipmentStat(equip, 'mana', cap);
  hero.maxHp = calculatedHp;
  hero.maxMp = calculatedMp;
  hero.hp = clampInt(hero.hp, 0, calculatedHp);
  hero.mp = clampInt(hero.mp, 0, calculatedMp);
  hero.xpNext = xpForLevel(hero.level as number);
  hero.xp = clampInt(hero.xp, 0, (hero.xpNext as number) - 1);
  hero.attrPoints = clampInt(hero.attrPoints, 0, Math.max(0, ((hero.level as number) - 1) * 2));
  hero.gold = previous ? clampInt(hero.gold, 0, clampInt(previous.gold, 0, 100000000) + 5000) : clampInt(hero.gold, 0, 100);
  hero.killCount = previous ? clampInt(hero.killCount, clampInt(previous.killCount, 0, 1000000), clampInt(previous.killCount, 0, 1000000) + 20) : 0;
  if (hero.derived && typeof hero.derived === 'object') {
    hero.derived = { ...(hero.derived as Record<string, unknown>), maxHp: calculatedHp, maxMp: calculatedMp };
  }

  return { hero, baseAttrs: baseline };
}

/**
 * Cosméticos da conta que o parceiro pode ver — o `accountProfile()` que
 * o cliente antigo embutia em `profiles[papel].publicProfile` pra montar
 * o cartão de perfil público dentro da sala.
 *
 * O saneamento do porte descartava isso (só `name`/`hero`/`inventory`/
 * `party` sobreviviam), então o parceiro aparecia sem rosto. Aqui volta,
 * com os valores presos às listas do catálogo: moldura, cor e pet que não
 * existem viram o padrão, em vez de virar CSS arbitrário na tela do outro.
 */
export interface PublicCosmetics {
  username: string;
  avatarUrl: string;
  frame: string;
  nameColor: string;
  pet: string;
}

const MAX_AVATAR_LENGTH = 400_000;
const AVATAR_PATTERN = /^(https:\/\/|data:image\/(png|jpeg|webp);base64,)/i;

export function sanitizeCosmetics(candidate: unknown): PublicCosmetics | null {
  if (!candidate || typeof candidate !== 'object') return null;
  const source = candidate as Record<string, unknown>;

  const avatarUrl = comoTexto(source.avatarUrl);
  const frame = comoTexto(source.frame, 'none');
  const nameColor = comoTexto(source.nameColor, '#e8d7a5').toLowerCase();
  const pet = comoTexto(source.pet, 'none');

  const username = comoTexto(source.username).slice(0, 24);
  const aceita = AVATAR_PATTERN.test(avatarUrl) && avatarUrl.length <= MAX_AVATAR_LENGTH;

  return {
    username,
    // `publicProfiles()` é recalculado a cada `state`, e `state` sai a
    // cada ação — a foto em base64 ia junto, o jogo todo, nos dois
    // sentidos. Vira endereço pro endpoint, que o parceiro busca uma vez
    // e guarda em cache. Link externo passa direto.
    //
    // O endereço sai do `username` que o próprio cliente mandou, que é o
    // mesmo que ele já usa pro nome no cartão: mentir aqui mostra a foto
    // de outra pessoa, exatamente como mentir ali já mostrava o nome de
    // outra pessoa. Não é buraco novo, e a foto é pública de qualquer
    // jeito (ver `social/avatar.controller.ts`).
    avatarUrl: aceita ? publicAvatarUrl(username, resumoDoAvatar(avatarUrl)) : '',
    frame: (PROFILE_FRAMES as readonly string[]).includes(frame) ? frame : 'none',
    nameColor: (PROFILE_COLORS as readonly string[]).includes(nameColor) ? nameColor : '#e8d7a5',
    pet: (PROFILE_PETS as readonly string[]).includes(pet) ? pet : 'none',
  };
}

export interface SanitizedProfile {
  name: string;
  hero: Record<string, unknown>;
  inventory: unknown[];
  party: Record<string, unknown>[];
  baseAttrs: number;
  publicProfile: PublicCosmetics | null;
}

export function sanitizeProfile(profile: unknown, previous: SanitizedProfile | null, adminFlag: boolean): SanitizedProfile {
  const source = (profile ?? {}) as Record<string, unknown>;
  const result = sanitizeHero(source.hero, previous, adminFlag);
  return {
    name: (comoTexto(source.name) || 'Aventureiro').slice(0, 20),
    hero: result.hero,
    // Mochila ausente = **não mudou**, e a já aceita continua valendo —
    // mesmo acordo do `publicProfile` logo abaixo, e pela mesma razão: ela
    // é o pedaço grande do pacote (10,5 KB num save com 76 itens) e não
    // muda quando o jogador só anda ou luta. Assim ela atravessa a rede
    // quando de fato muda, e não a cada ação.
    //
    // Mochila **vazia** é diferente de ausente: `[]` é um array, e é
    // aceito como esvaziar de verdade. Só o que não é array conta como
    // "sem novidade".
    inventory: Array.isArray(source.inventory) ? cloneJson(source.inventory).slice(0, 120) : (previous?.inventory ?? []),
    party: sanitizeParty(source.party),
    baseAttrs: result.baseAttrs,
    // Sem cosmético novo, o já aceito continua valendo: assim o avatar
    // atravessa a rede uma vez, no `profile`, e não a cada ação de jogo.
    publicProfile: sanitizeCosmetics(source.publicProfile) ?? previous?.publicProfile ?? null,
  };
}

export interface PublicProfile {
  name: string;
  hero: Record<string, unknown>;
  inventory: unknown[];
  party: Record<string, unknown>[];
  publicProfile: PublicCosmetics | null;
}

export function toPublicProfile(profile: SanitizedProfile): PublicProfile {
  return {
    name: profile.name,
    hero: profile.hero,
    inventory: profile.inventory,
    party: profile.party,
    publicProfile: profile.publicProfile,
  };
}

/**
 * O próprio perfil **sem a mochila** — ausência quer dizer "não mudou",
 * exatamente como já quer dizer na subida (ver `sanitizeProfile`).
 *
 * A regra existia só num sentido. O cliente já omite a mochila quando ela
 * não mudou (`instantaneoDaSala`, no front), mas o servidor devolvia o
 * perfil próprio inteiro a cada ação: medido num save de andar 8 com 76
 * itens, eram 11,5 KB de um pacote de 20,3 KB — **57%**, e ida e volta, o
 * jogo todo. O recorte por papel tirou a mochila *do parceiro*; a que
 * sobrou viajando é a sua própria, ecoada de volta sem ter mudado.
 *
 * Quem decide se ela vai é `RoomRegistry`, que sabe o que já mandou pra
 * cada conexão — ver `profilesForMember`.
 */
export type OwnProfile = PublicProfile | Omit<PublicProfile, 'inventory'>;

export function toOwnProfile(profile: SanitizedProfile, comMochila: boolean): OwnProfile {
  const { inventory, ...semMochila } = toPublicProfile(profile);
  return comMochila ? { ...semMochila, inventory } : semMochila;
}

/**
 * O perfil do **parceiro**, com só o que a tela do outro jogador de fato lê:
 * nome, cosméticos e o herói (dele saem nível e classe no cartão).
 *
 * Sai a mochila e sai o grupo. Não é economia teórica — medido num save com
 * 76 itens, a mochila sozinha era 10,5 KB de um pacote de 14 KB, e esse
 * pacote sai **a cada ação de jogo**. Nada em `apps/web` lê `inventory` nem
 * `party` de um perfil de sala que não seja o próprio: o único leitor é
 * `aplicarRemoto`, e ele usa `perfis[meuPapel]`.
 *
 * Por isso o recorte é **por destinatário**, e não global — ver
 * `RoomRegistry.profilesForRole`. Mandar o enxuto pra todo mundo apagaria a
 * mochila de quem recebesse o próprio perfil sem ela.
 */
export interface PeerProfile {
  name: string;
  hero: Record<string, unknown>;
  publicProfile: PublicCosmetics | null;
}

export function toPeerProfile(profile: SanitizedProfile): PeerProfile {
  return {
    name: profile.name,
    hero: profile.hero,
    publicProfile: profile.publicProfile,
  };
}
