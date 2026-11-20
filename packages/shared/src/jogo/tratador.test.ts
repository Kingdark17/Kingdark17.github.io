import { describe, expect, it } from 'vitest';

import { animalDomado } from '../combat/animais.js';
import { PLANTA_DA_CIDADE, PONTOS_DA_CIDADE } from '../city/mapa-da-cidade.js';
import { statusDaEspecie } from '../monsters/generate.js';
import { seededRng } from '../rng.js';
import { entrarNoPonto } from './cidade.js';
import { andarDeForca, entrarNaCidade, type EstadoNaCidade } from './estado.js';
import { saveSorteado } from './heroi-sorteado.js';
import { monsterLevel } from '../monsters/generate.js';
import { abrirTratador, andarDoFilhote, andarDoNivel, comprarFilhote, FILHOTES, precoDoFilhote, REGRAS_DO_TRATADOR } from './tratador.js';

// O tratador de animais (o fim do Caçador, 2026-11-18).

const AGORA = () => 1_700_000_000_000;

function cidade(classId: string, o: { level?: number; gold?: number } = {}): EstadoNaCidade {
  const save = saveSorteado('Aria', seededRng(4));
  const base = entrarNaCidade({ ...save, hero: { ...save.hero, classId, className: classId, level: o.level ?? 10, gold: o.gold ?? 5000 } });
  return base;
}

describe('o tratador de animais', () => {
  it('o andar do filhote: o do nível do herói (o monsterLevel ao contrário), ou o de agora se for maior', () => {
    for (let nivel = 1; nivel <= 120; nivel++) {
      const andar = andarDoNivel(nivel);
      expect(monsterLevel(andar)).toBeGreaterThanOrEqual(nivel);
      if (andar > 1) expect(monsterLevel(andar - 1)).toBeLessThan(nivel);
    }
    expect(andarDoNivel(9)).toBe(10);
    expect(andarDoNivel(70)).toBe(78);
    const estado = cidade('cacador');
    expect(andarDoFilhote(estado)).toBe(Math.max(andarDeForca(estado), andarDoNivel(estado.hero.level)));
    expect(andarDoFilhote(estado)).toBe(11);
    expect(andarDoFilhote({ ...estado, floor: 60 })).toBe(andarDeForca({ ...estado, floor: 60 }));
  });

  it('o filhote: a vida e o dano de um bicho da espécie no andar do filhote, a 70%', () => {
    expect(statusDaEspecie('lobo_sombras', 1)).toEqual(statusDaEspecie('lobo_sombras', 1, 'normal'));
    expect(statusDaEspecie('lobo_sombras', 30).maxHp).toBeGreaterThan(statusDaEspecie('lobo_sombras', 1).maxHp);
    expect(statusDaEspecie('lobo_sombras', 10, 'pesadelo').dmg).toBeGreaterThan(statusDaEspecie('lobo_sombras', 10).dmg);
    const estado = cidade('cacador');
    const tratador = abrirTratador(estado);
    expect(tratador.preco).toBe(REGRAS_DO_TRATADOR.precoPorNivel * 10);
    expect(tratador.filhotes.map((f) => f.especie)).toEqual(FILHOTES);
    const s = statusDaEspecie('aranha', andarDoFilhote(estado), estado.dificuldade);
    const esperado = animalDomado({ speciesId: 'aranha', maxHp: s.maxHp, dmg: s.dmg }, 'x');
    expect(tratador.filhotes[1]).toEqual({ especie: 'aranha', nome: 'Aranha Gigante', icone: '🕷️', vida: esperado.maxHp, dano: esperado.attack });
    expect(tratador.cheio).toBe(false);
  });

  it('comprar: o ouro sai e o filhote entra na equipe; sem ouro ou com 4 animais, não', () => {
    const estado = cidade('cacador', { level: 4, gold: 1000 });
    const comprou = comprarFilhote(abrirTratador(estado), 'morcego', seededRng(2), AGORA);
    expect(comprou.estado.hero.gold).toBe(1000 - precoDoFilhote({ level: 4 }));
    expect(comprou.estado.party.at(-1)).toMatchObject({ especie: 'morcego', animal: { id: comprou.comprou, nivel: 1, batalhas: 0 } });
    expect(comprou.log).toEqual(['Você paga 200 de ouro e leva o bichinho: Morcego Vampírico.']);
    const pobre = comprarFilhote(abrirTratador(cidade('cacador', { level: 4, gold: 50 })), 'lobo_sombras', seededRng(2), AGORA);
    expect(pobre.log).toEqual(['Faltam 150 de ouro.']);
    const a = animalDomado({ speciesId: 'aranha', maxHp: 300, dmg: 20 }, 'z');
    const cheio = { ...estado, party: [a, a], hero: { ...estado.hero, animais: [a, a] } };
    expect(abrirTratador(cheio).cheio).toBe(true);
    expect(comprarFilhote(abrirTratador(cheio), 'aranha', seededRng(2), AGORA).log).toEqual(['Você já tem 4 animais.']);
    expect(comprarFilhote(abrirTratador(estado), 'goblin', seededRng(2), AGORA).log).toEqual([]);
  });

  it('o prédio fica ao lado do ferreiro, sólido, com a porta pro caminho; só o Caçador do app entra', () => {
    expect(PLANTA_DA_CIDADE[10]?.[20]).toBe('#');
    expect(PLANTA_DA_CIDADE[12]?.[20]).toBe('.');
    expect(PONTOS_DA_CIDADE.filter((p) => p.id === 'tratador').map((p) => [p.col, p.row])).toEqual([[20, 11], [21, 11]]);
    const noApp = entrarNoPonto(cidade('cacador'), 'tratador', seededRng(1), null, AGORA, true);
    expect(noApp.tela?.tipo).toBe('tratador');
    const outro = entrarNoPonto(cidade('guerreiro'), 'tratador', seededRng(1), null, AGORA, true);
    expect(outro.tela).toBeNull();
    expect(outro.aviso?.texto).toBe('O tratador acena da porta: só o Caçador cuida de animais.');
    const noSite = entrarNoPonto(cidade('cacador'), 'tratador', seededRng(1), null, AGORA, false);
    expect(noSite.tela).toBeNull();
    expect(noSite.aviso?.titulo).toBe('Tratador de Animais');
  });
});
