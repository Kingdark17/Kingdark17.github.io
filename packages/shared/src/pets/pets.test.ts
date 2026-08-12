import { describe, expect, it } from 'vitest';

import { PET_BONUSES, PET_ICONS, petBonus, petIcon, type PetId } from './pets.js';

describe('catálogo de pets', () => {
  it('tem os 9 pets do original, cada um com ícone e bônus', () => {
    const ids = Object.keys(PET_ICONS) as PetId[];
    expect(ids).toHaveLength(9);
    for (const id of ids) expect(PET_BONUSES[id]).toBeDefined();
  });

  it('admin_dragon é o bônus mais forte, com os 4 tipos de bônus', () => {
    const b = PET_BONUSES.admin_dragon;
    expect(b).toEqual({ critico: 20, esquiva: 20, manaSave: 35, healing: 35, label: b.label });
  });
});

describe('petBonus', () => {
  it('resolve o bônus do pet ativo', () => {
    expect(petBonus('wolf')).toEqual({ esquiva: 4, label: '+4% de esquiva' });
    expect(petBonus('fairy').manaSave).toBe(5);
    expect(petBonus('fairy').healing).toBe(10);
  });

  it('devolve um bônus vazio sem pet ou com id desconhecido', () => {
    expect(petBonus(null)).toEqual({ label: '' });
    expect(petBonus(undefined)).toEqual({ label: '' });
    expect(petBonus('inexistente' as PetId)).toEqual({ label: '' });
  });
});

describe('petIcon', () => {
  it('resolve o ícone do pet ativo', () => {
    expect(petIcon('cat')).toBe('🐈');
    expect(petIcon('admin_dragon')).toBe('🐉');
  });

  it('cai pra uma pegada genérica sem pet ou com id desconhecido', () => {
    expect(petIcon(null)).toBe('🐾');
    expect(petIcon('inexistente' as PetId)).toBe('🐾');
  });
});
