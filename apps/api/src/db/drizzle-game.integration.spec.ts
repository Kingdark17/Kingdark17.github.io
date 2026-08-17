/**
 * Repositórios de save, perfil/cosméticos e social contra Postgres real
 * (PGlite com o DDL do servidor original).
 *
 * O foco é o que só o banco decide: chave primária composta `(user_id,
 * slot)`, o arquivamento com janela de 15 minutos e o corte em 10
 * versões, as transações de compra e de aceite de amizade, e a busca de
 * conversa nos dois sentidos.
 */

import { DrizzleUsersRepository } from '../auth/drizzle-users-repository';
import { PROFILE_CATALOG } from '../auth/cosmetics';
import { DrizzleProfileRepository } from '../profile/drizzle-profile-repository';
import { DrizzleSaveRepository } from '../save/drizzle-save-repository';
import { DrizzleSocialRepository } from '../social/drizzle-social-repository';
import { startPglite, type PgliteHarness } from './testing/pglite-harness';

jest.setTimeout(60_000);

const MINUTO = 60 * 1000;

let harness: PgliteHarness;
let users: DrizzleUsersRepository;
let saves: DrizzleSaveRepository;
let profiles: DrizzleProfileRepository;
let social: DrizzleSocialRepository;

const ADMIN = 'ADM';

async function criarConta(username: string, email = `${username.toLowerCase()}@exemplo.com`) {
  return users.create({ username, email, passwordHash: 'hash', passwordSalt: 'salt' });
}

function saveDe(gold: number) {
  return { hero: { name: 'Aria', gold, attrs: { forca: 5 }, equip: {} }, inventory: [], party: [], floor: 1 };
}

beforeAll(async () => {
  harness = await startPglite();
  users = new DrizzleUsersRepository();
  saves = new DrizzleSaveRepository();
  profiles = new DrizzleProfileRepository(ADMIN);
  social = new DrizzleSocialRepository();
});

beforeEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.stop();
});

describe('DrizzleSaveRepository', () => {
  it('grava e lê por slot, com slots independentes', async () => {
    const conta = await criarConta('Aria');
    const agora = new Date();

    await saves.store(conta.id, 1, saveDe(10), false, agora);
    await saves.store(conta.id, 3, saveDe(30), false, agora);

    expect((await saves.getSlot(conta.id, 1))?.data).toMatchObject({ hero: { gold: 10 } });
    expect((await saves.getSlot(conta.id, 3))?.data).toMatchObject({ hero: { gold: 30 } });
    expect(await saves.getSlot(conta.id, 2)).toBeNull();

    const lista = await saves.listHeads(conta.id);
    expect(lista.map((linha) => linha.slot).sort()).toEqual([1, 3]);
  });

  it('a lista de personagens traz o resumo, não o save inteiro', async () => {
    const conta = await criarConta('Aria');
    const mapa = Array.from({ length: 60 }, (_, i) => ({ id: i, tipo: 'normal', visto: false }));
    await saves.store(
      conta.id,
      1,
      {
        hero: { name: 'Aria', raceIcon: '🧝', className: 'Mago', classIcon: '🔮', level: 7, gold: 999, equip: {} },
        inventory: [],
        party: [],
        floor: 4,
        map: mapa,
      },
      false,
      new Date(),
    );

    const [linha] = await saves.listHeads(conta.id);

    // Os seis campos do card chegam...
    expect(linha.data).toEqual({ hero: { name: 'Aria', raceIcon: '🧝', className: 'Mago', classIcon: '🔮', level: 7 }, floor: 4 });
    // ...e o resto some dentro do Postgres, que é o ponto: o mapa e o
    // inventário não têm por que sair do banco pra desenhar um card.
    const cru = JSON.stringify(linha.data);
    expect(cru).not.toContain('map');
    expect(cru).not.toContain('999');
  });

  it('gravar de novo no mesmo slot sobrescreve, não duplica linha', async () => {
    const conta = await criarConta('Aria');
    const agora = new Date();

    await saves.store(conta.id, 1, saveDe(10), false, agora);
    await saves.store(conta.id, 1, saveDe(99), false, new Date(agora.getTime() + MINUTO));

    expect(await saves.listHeads(conta.id)).toHaveLength(1);
    expect((await saves.getSlot(conta.id, 1))?.data).toMatchObject({ hero: { gold: 99 } });
  });

  it('arquiva o estado anterior e respeita a janela de 15 minutos', async () => {
    const conta = await criarConta('Aria');
    const inicio = new Date();

    await saves.store(conta.id, 1, saveDe(1), false, inicio);
    // Primeira edição sempre arquiva: ainda não existe histórico recente.
    await saves.store(conta.id, 1, saveDe(2), false, new Date(inicio.getTime() + MINUTO));
    expect(await saves.listHistory(conta.id, 1)).toHaveLength(1);

    // Dentro dos 15 minutos do snapshot anterior: não arquiva de novo.
    await saves.store(conta.id, 1, saveDe(3), false, new Date(inicio.getTime() + 2 * MINUTO));
    expect(await saves.listHistory(conta.id, 1)).toHaveLength(1);

    // Passada a janela, arquiva.
    await saves.store(conta.id, 1, saveDe(4), false, new Date(inicio.getTime() + 20 * MINUTO));
    expect(await saves.listHistory(conta.id, 1)).toHaveLength(2);
  });

  it('forceHistory arquiva mesmo dentro da janela', async () => {
    const conta = await criarConta('Aria');
    const inicio = new Date();

    await saves.store(conta.id, 1, saveDe(1), false, inicio);
    await saves.store(conta.id, 1, saveDe(2), false, new Date(inicio.getTime() + MINUTO));
    await saves.store(conta.id, 1, saveDe(3), true, new Date(inicio.getTime() + 2 * MINUTO));

    expect(await saves.listHistory(conta.id, 1)).toHaveLength(2);
  });

  it('guarda no máximo 10 versões, descartando as mais velhas', async () => {
    const conta = await criarConta('Aria');
    const inicio = new Date();
    await saves.store(conta.id, 1, saveDe(0), false, inicio);

    for (let i = 1; i <= 14; i += 1) {
      await saves.store(conta.id, 1, saveDe(i), true, new Date(inicio.getTime() + i * MINUTO));
    }

    const historico = await saves.listHistory(conta.id, 1);
    expect(historico).toHaveLength(10);
    // Mais recente primeiro.
    expect(historico[0].createdAt.getTime()).toBeGreaterThanOrEqual(historico[9].createdAt.getTime());
  });

  it('recupera uma versão do histórico pelo id, e só do dono', async () => {
    const aria = await criarConta('Aria');
    const bree = await criarConta('Bree');
    const inicio = new Date();

    await saves.store(aria.id, 1, saveDe(1), false, inicio);
    await saves.store(aria.id, 1, saveDe(2), false, new Date(inicio.getTime() + MINUTO));

    const [versao] = await saves.listHistory(aria.id, 1);
    expect(await saves.getHistoryEntry(aria.id, 1, versao.id)).toMatchObject({ hero: { gold: 1 } });
    expect(await saves.getHistoryEntry(bree.id, 1, versao.id)).toBeNull();
  });

  it('reset apaga só o slot pedido', async () => {
    const conta = await criarConta('Aria');
    const agora = new Date();
    await saves.store(conta.id, 1, saveDe(1), false, agora);
    await saves.store(conta.id, 2, saveDe(2), false, agora);

    await saves.resetSlot(conta.id, 1);

    expect(await saves.getSlot(conta.id, 1)).toBeNull();
    expect(await saves.getSlot(conta.id, 2)).not.toBeNull();
  });
});

describe('DrizzleProfileRepository', () => {
  const molduraBronze = PROFILE_CATALOG.find((item) => item.id === 'frame_bronze')!;

  it('atualiza o perfil e devolve a conta já atualizada', async () => {
    const conta = await criarConta('Aria');

    const atualizada = await profiles.updateProfile(conta.id, {
      avatarUrl: 'data:image/webp;base64,zzz',
      frame: 'none',
      nameColor: '#ffffff',
      pet: 'none',
    });

    expect(atualizada.avatarUrl).toBe('data:image/webp;base64,zzz');
    expect(atualizada.nameColor).toBe('#ffffff');
  });

  it('compra desconta o ouro do save e libera o cosmético, na mesma transação', async () => {
    const conta = await criarConta('Aria');
    await saves.store(conta.id, 1, saveDe(500), false, new Date());

    const resultado = await profiles.purchase(conta.id, 1, molduraBronze);

    expect(resultado.kind).toBe('purchased');
    if (resultado.kind !== 'purchased') return;
    expect(resultado.save).toMatchObject({ hero: { gold: 400 } });
    expect((resultado.account.cosmetics as { frames: string[] }).frames).toContain('bronze');
    expect((await saves.getSlot(conta.id, 1))?.data).toMatchObject({ hero: { gold: 400 } });
  });

  it('sem ouro suficiente não compra e não mexe no save', async () => {
    const conta = await criarConta('Aria');
    await saves.store(conta.id, 1, saveDe(10), false, new Date());

    const resultado = await profiles.purchase(conta.id, 1, molduraBronze);

    expect(resultado.kind).toBe('insufficient-gold');
    expect((await saves.getSlot(conta.id, 1))?.data).toMatchObject({ hero: { gold: 10 } });
  });

  it('comprar duas vezes não cobra de novo', async () => {
    const conta = await criarConta('Aria');
    await saves.store(conta.id, 1, saveDe(500), false, new Date());

    await profiles.purchase(conta.id, 1, molduraBronze);
    const segunda = await profiles.purchase(conta.id, 1, molduraBronze);

    expect(segunda.kind).toBe('already-owned');
    expect((await saves.getSlot(conta.id, 1))?.data).toMatchObject({ hero: { gold: 400 } });
  });
});

describe('DrizzleSocialRepository', () => {
  it('pedido de amizade vira amizade nos dois sentidos ao aceitar', async () => {
    const aria = await criarConta('Aria');
    const bree = await criarConta('Bree');

    expect(await social.createFriendRequest(aria.id, bree.id)).toBe('created');
    expect(await social.hasPendingRequest(aria.id, bree.id)).toBe(true);
    expect(await social.areFriends(aria.id, bree.id)).toBe(false);

    await social.acceptFriendRequest(aria.id, bree.id);

    expect(await social.areFriends(aria.id, bree.id)).toBe(true);
    expect(await social.areFriends(bree.id, aria.id)).toBe(true);
    expect(await social.hasPendingRequest(aria.id, bree.id)).toBe(false);
  });

  it('pedido repetido devolve duplicate em vez de estourar', async () => {
    const aria = await criarConta('Aria');
    const bree = await criarConta('Bree');

    await social.createFriendRequest(aria.id, bree.id);
    expect(await social.createFriendRequest(aria.id, bree.id)).toBe('duplicate');
  });

  it('listRelations separa amigos, recebidos e enviados', async () => {
    const aria = await criarConta('Aria');
    const bree = await criarConta('Bree');
    const caio = await criarConta('Caio');
    const dora = await criarConta('Dora');

    await social.createFriendRequest(aria.id, bree.id);
    await social.acceptFriendRequest(aria.id, bree.id);
    await social.createFriendRequest(caio.id, aria.id);
    await social.createFriendRequest(aria.id, dora.id);

    const relacoes = await social.listRelations(aria.id);

    expect(relacoes.friends.map((linha) => linha.username)).toEqual(['Bree']);
    expect(relacoes.incoming.map((linha) => linha.username)).toEqual(['Caio']);
    expect(relacoes.outgoing.map((linha) => linha.username)).toEqual(['Dora']);
  });

  it('desfazer amizade some dos dois lados', async () => {
    const aria = await criarConta('Aria');
    const bree = await criarConta('Bree');
    await social.createFriendRequest(aria.id, bree.id);
    await social.acceptFriendRequest(aria.id, bree.id);

    await social.deleteFriendship(aria.id, bree.id);

    expect(await social.areFriends(aria.id, bree.id)).toBe(false);
    expect(await social.areFriends(bree.id, aria.id)).toBe(false);
  });

  it('conversa é achada nos dois sentidos, mais recente primeiro', async () => {
    const aria = await criarConta('Aria');
    const bree = await criarConta('Bree');

    await social.recordMessage(aria.id, bree.id, 'oi');
    await social.recordMessage(bree.id, aria.id, 'oi de volta');

    const daAria = await social.recentMessages(aria.id, bree.id, undefined, 50);
    const daBree = await social.recentMessages(bree.id, aria.id, undefined, 50);

    expect(daAria.map((mensagem) => mensagem.body)).toEqual(['oi', 'oi de volta']);
    expect(daAria.map((mensagem) => mensagem.fromMe)).toEqual([true, false]);
    expect(daBree.map((mensagem) => mensagem.fromMe)).toEqual([false, true]);
  });

  it('conversa de outro par não vaza', async () => {
    const aria = await criarConta('Aria');
    const bree = await criarConta('Bree');
    const caio = await criarConta('Caio');

    await social.recordMessage(aria.id, bree.id, 'para bree');
    await social.recordMessage(aria.id, caio.id, 'para caio');

    const comBree = await social.recentMessages(aria.id, bree.id, undefined, 50);
    expect(comBree.map((mensagem) => mensagem.body)).toEqual(['para bree']);
  });

  it('acha usuário por nome sem diferenciar maiúscula', async () => {
    await criarConta('Aria');
    expect((await social.findUserByUsername('ARIA'))?.username).toBe('Aria');
    expect(await social.findUserByUsername('ninguem')).toBeNull();
  });
});
