/**
 * Pets cosméticos do perfil, com pequenos bônus de combate. Porta de
 * `js/pets.js`, só o catálogo e os dois lookups puros — `render()`/
 * `love()`/`setFace()` do original animam o widget do perfil via DOM
 * (`document.getElementById`, `requestAnimationFrame`, `setTimeout`);
 * ficam de fora.
 *
 * `bonus()` no original lia `RPG.Account.currentUser()` (um global) pra
 * saber qual pet o jogador tem; aqui `petBonus()` recebe o id do pet
 * direto — quem chama já sabe qual é o usuário atual, o motor não precisa
 * alcançar uma conta global pra isso.
 *
 * `esquiva`/`critico` já têm pra onde ir (`ResolveAttackOptions.petCriticoBonus`/
 * `MonsterHitOptions.petEsquivaBonus`, em `combat/*`, que já recebem esses
 * valores por parâmetro). `manaSave`/`healing` ainda não têm nenhum ponto de
 * consumo portado — ficam prontos no catálogo, do mesmo jeito que
 * `blessing`/`barter`/`recruit` ficaram prontos antes de `city.js` chegar.
 */

export type PetId = 'chicken' | 'cat' | 'fox' | 'owl' | 'slime' | 'wolf' | 'fairy' | 'baby_dragon' | 'admin_dragon';

export interface PetBonus {
  esquiva?: number;
  critico?: number;
  manaSave?: number;
  healing?: number;
  label: string;
}

/** Igual a `js/pets.js`'s `icons`. */
export const PET_ICONS: Record<PetId, string> = {
  chicken: '🐔',
  cat: '🐈',
  fox: '🦊',
  owl: '🦉',
  slime: '🟢',
  wolf: '🐺',
  fairy: '🧚',
  baby_dragon: '🐲',
  admin_dragon: '🐉',
};

/** Igual a `js/pets.js`'s `bonuses`. */
export const PET_BONUSES: Record<PetId, PetBonus> = {
  chicken: { esquiva: 3, label: '+3% de esquiva' },
  cat: { critico: 3, label: '+3% de crítico' },
  fox: { esquiva: 2, critico: 2, label: '+2% de esquiva e crítico' },
  owl: { manaSave: 5, label: '5% de chance de poupar mana' },
  slime: { healing: 5, label: '+5% de cura recebida' },
  wolf: { esquiva: 4, label: '+4% de esquiva' },
  fairy: { healing: 10, manaSave: 5, label: '+10% de cura e 5% de economia de mana' },
  baby_dragon: { critico: 6, esquiva: 3, label: '+6% de crítico e +3% de esquiva' },
  admin_dragon: { critico: 20, esquiva: 20, manaSave: 35, healing: 35, label: '+20% crítico e esquiva, +35% cura e economia de mana' },
};

const NO_BONUS: PetBonus = { label: '' };

/** Bônus do pet ativo, ou um bônus vazio quando não há pet (ou o id é desconhecido). */
export function petBonus(pet: PetId | null | undefined): PetBonus {
  return (pet && PET_BONUSES[pet]) || NO_BONUS;
}

/** Ícone do pet, com fallback pra uma pegada genérica quando o id é desconhecido. */
export function petIcon(pet: PetId | null | undefined): string {
  return (pet && PET_ICONS[pet]) || '🐾';
}
