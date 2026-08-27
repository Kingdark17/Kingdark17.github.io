import { cosmeticsFor, defaultCosmetics, type ProfileCatalogItem } from '../auth/cosmetics';
import { signSave } from '../auth/save-signature';
import type { AccountRecord } from '../auth/users-repository';
import { ProfileService } from './profile.service';
import { resolvePurchase } from './purchase-decision';
import type { ProfilePurchaseOutcome, ProfileRepository, UpdateProfileInput } from './profile-repository';

const ADMIN_USERNAME = 'adm';
const SECRET = 'segredo-de-teste';
const USER_ID = 1;

function makeAccount(overrides: Partial<AccountRecord> = {}): AccountRecord {
  return {
    id: USER_ID,
    username: 'Jogador1',
    email: 'a@b.com',
    emailVerified: true,
    avatarUrl: '',
    profileFrame: 'none',
    nameColor: '#e8d7a5',
    pet: 'none',
    cosmetics: defaultCosmetics(),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    passwordHash: 'hash',
    passwordSalt: 'salt',
    ...overrides,
  };
}

class FakeProfileRepository implements ProfileRepository {
  users = new Map<number, AccountRecord>();
  saves = new Map<string, unknown>();

  updateProfile(userId: number, input: UpdateProfileInput): Promise<AccountRecord> {
    const current = this.users.get(userId);
    if (!current) throw new Error('usuário inexistente no fake');
    const updated: AccountRecord = { ...current, avatarUrl: input.avatarUrl, profileFrame: input.frame, nameColor: input.nameColor, pet: input.pet };
    this.users.set(userId, updated);
    return Promise.resolve(updated);
  }

  purchase(userId: number, slot: number, item: ProfileCatalogItem): Promise<ProfilePurchaseOutcome> {
    const user = this.users.get(userId) ?? null;
    const save = this.saves.get(`${userId}:${slot}`) ?? null;
    const context = user && save ? { cosmetics: cosmeticsFor(user, ADMIN_USERNAME), save } : null;
    const decision = resolvePurchase(context, item);
    if (decision.kind !== 'purchased') return Promise.resolve(decision);
    // `purchased` só sai quando havia contexto, ou seja, quando havia usuário.
    if (!user) throw new Error('compra aprovada sem usuário no fake');

    this.saves.set(`${userId}:${slot}`, decision.save);
    const updatedUser: AccountRecord = { ...user, cosmetics: decision.cosmetics };
    this.users.set(userId, updatedUser);
    return Promise.resolve({ kind: 'purchased', account: updatedUser, save: decision.save });
  }
}

function makeService() {
  const repo = new FakeProfileRepository();
  const service = new ProfileService(repo, ADMIN_USERNAME, SECRET);
  return { service, repo };
}

describe('ProfileService.listCatalog', () => {
  it('esconde itens exclusivos de admin de jogadores comuns', () => {
    const { service } = makeService();
    const { catalog } = service.listCatalog(false, defaultCosmetics());
    expect(catalog.every((item) => !item.adminOnly)).toBe(true);
  });

  it('mostra o catálogo completo pro admin', () => {
    const { service } = makeService();
    const { catalog } = service.listCatalog(true, defaultCosmetics());
    expect(catalog.some((item) => item.adminOnly)).toBe(true);
  });
});

describe('ProfileService.updateProfile', () => {
  it('rejeita avatarUrl que não é foto remota https nem data-uri válida', async () => {
    const { service } = makeService();
    const result = await service.updateProfile(USER_ID, defaultCosmetics(), { avatarUrl: 'javascript:alert(1)' });
    expect(result).toEqual({ kind: 'invalid-avatar' });
  });

  it('rejeita frame/cor/pet fora do catálogo geral', async () => {
    const { service } = makeService();
    const result = await service.updateProfile(USER_ID, defaultCosmetics(), { frame: 'inexistente' });
    expect(result).toEqual({ kind: 'invalid-selection' });
  });

  it('rejeita seleção que a conta ainda não desbloqueou', async () => {
    const { service } = makeService();
    const result = await service.updateProfile(USER_ID, defaultCosmetics(), { frame: 'gold' });
    expect(result).toEqual({ kind: 'not-unlocked' });
  });

  it('aceita e persiste uma seleção já desbloqueada', async () => {
    const { service, repo } = makeService();
    repo.users.set(USER_ID, makeAccount({ cosmetics: { frames: ['none', 'gold'], colors: ['#e8d7a5'], pets: ['none'] } }));
    const result = await service.updateProfile(USER_ID, { frames: ['none', 'gold'], colors: ['#e8d7a5'], pets: ['none'] }, { frame: 'gold' });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.user.frame).toBe('gold');
  });
});

describe('ProfileService.purchase', () => {
  it('rejeita item inexistente no catálogo', async () => {
    const { service } = makeService();
    const result = await service.purchase(USER_ID, { id: 'item-fantasma', slot: 1 }, false);
    expect(result).toEqual({ kind: 'item-not-found' });
  });

  it('rejeita item exclusivo de admin pra jogador comum', async () => {
    const { service } = makeService();
    const result = await service.purchase(USER_ID, { id: 'frame_rgb', slot: 1 }, false);
    expect(result).toEqual({ kind: 'admin-only' });
  });

  it('rejeita slot inválido', async () => {
    const { service } = makeService();
    const result = await service.purchase(USER_ID, { id: 'frame_bronze', slot: 0 }, false);
    expect(result).toEqual({ kind: 'invalid-slot' });
  });

  it('rejeita quando não há personagem salvo no slot', async () => {
    const { service, repo } = makeService();
    repo.users.set(USER_ID, makeAccount());
    const result = await service.purchase(USER_ID, { id: 'frame_bronze', slot: 1 }, false);
    expect(result).toEqual({ kind: 'no-character' });
  });

  it('rejeita quando o item já foi comprado', async () => {
    const { service, repo } = makeService();
    repo.users.set(USER_ID, makeAccount({ cosmetics: { frames: ['none', 'bronze'], colors: ['#e8d7a5'], pets: ['none'] } }));
    repo.saves.set(`${USER_ID}:1`, { hero: { gold: 500 } });
    const result = await service.purchase(USER_ID, { id: 'frame_bronze', slot: 1 }, false);
    expect(result).toEqual({ kind: 'already-owned' });
  });

  it('rejeita quando não há ouro suficiente', async () => {
    const { service, repo } = makeService();
    repo.users.set(USER_ID, makeAccount());
    repo.saves.set(`${USER_ID}:1`, { hero: { gold: 10 } });
    const result = await service.purchase(USER_ID, { id: 'frame_bronze', slot: 1 }, false);
    expect(result).toEqual({ kind: 'insufficient-gold' });
  });

  it('completa a compra: desconta ouro, desbloqueia o item e devolve assinatura válida', async () => {
    const { service, repo } = makeService();
    repo.users.set(USER_ID, makeAccount());
    repo.saves.set(`${USER_ID}:1`, { hero: { gold: 500 } });

    const result = await service.purchase(USER_ID, { id: 'frame_bronze', slot: 1 }, false);
    expect(result.kind).toBe('purchased');
    if (result.kind !== 'purchased') return;

    expect(result.item.id).toBe('frame_bronze');
    expect(result.user.cosmetics.frames).toContain('bronze');
    expect(result.save).toMatchObject({ hero: { gold: 400 } });
    expect(result.signature).toBe(signSave(USER_ID, 1, result.save as never, SECRET));
  });

  it('bloqueia recompra de item exclusivo de admin — a conta admin já o desbloqueia automaticamente via cosmeticsFor', async () => {
    const { service, repo } = makeService();
    repo.users.set(USER_ID, makeAccount({ username: 'ADM' }));
    repo.saves.set(`${USER_ID}:1`, { hero: { gold: 0 } });

    const result = await service.purchase(USER_ID, { id: 'frame_rgb', slot: 1 }, true);
    expect(result).toEqual({ kind: 'already-owned' });
  });
});

/**
 * A foto sai do Postgres e vira objeto no Storage.
 *
 * O que prende o comportamento não é "chamou o `guardar`", e sim **o que
 * fica gravado na coluna**: era o `data:` inteiro, de até 400 KB, e passa
 * a ser um `https://` curto. É a coluna que a lista de amigos lê.
 */
describe('ProfileService.updateProfile — foto no Storage', () => {
  const FOTO = 'data:image/png;base64,aGVsbG8=';

  class ArmazenamentoDeMentira {
    guardados: { caminho: string; bytes: Buffer }[] = [];
    apagados: string[] = [];
    existentes: string[] = [];
    quebrado = false;

    guardar(caminho: string, bytes: Buffer): Promise<string> {
      if (this.quebrado) return Promise.reject(new Error('Storage fora do ar'));
      this.guardados.push({ caminho, bytes });
      return Promise.resolve(this.endereco(caminho));
    }

    apagar(caminho: string): Promise<void> {
      this.apagados.push(caminho);
      return Promise.resolve();
    }

    listar(prefixo: string): Promise<string[]> {
      return Promise.resolve(this.existentes.filter((caminho) => caminho.startsWith(prefixo)));
    }

    endereco(caminho: string): string {
      return `https://projeto.supabase.co/storage/v1/object/public/avatares/${caminho}`;
    }
  }

  function comArmazenamento() {
    const repo = new FakeProfileRepository();
    const armazenamento = new ArmazenamentoDeMentira();
    repo.users.set(USER_ID, makeAccount());
    return { repo, armazenamento, service: new ProfileService(repo, ADMIN_USERNAME, SECRET, armazenamento) };
  }

  it('grava o endereço no banco, não os bytes', async () => {
    const { service, repo, armazenamento } = comArmazenamento();

    await service.updateProfile(USER_ID, defaultCosmetics(), { avatarUrl: FOTO });

    expect(armazenamento.guardados).toHaveLength(1);
    expect(repo.users.get(USER_ID)?.avatarUrl).toBe(armazenamento.endereco(armazenamento.guardados[0].caminho));
    expect(repo.users.get(USER_ID)?.avatarUrl).not.toContain('base64');
  });

  /**
   * Nome por hash faz troca de foto **criar** objeto, não substituir. Sem
   * a varrida, cada troca deixaria até 400 KB pra trás pra sempre.
   */
  it('apaga a foto anterior da pessoa, e só a dela', async () => {
    const { service, armazenamento } = comArmazenamento();
    armazenamento.existentes = ['1/antiga.png', '2/de-outra-pessoa.png'];

    await service.updateProfile(USER_ID, defaultCosmetics(), { avatarUrl: FOTO });

    expect(armazenamento.apagados).toEqual(['1/antiga.png']);
  });

  it('não apaga a que acabou de subir', async () => {
    const { service, armazenamento } = comArmazenamento();
    await service.updateProfile(USER_ID, defaultCosmetics(), { avatarUrl: FOTO });

    armazenamento.existentes = [armazenamento.guardados[0].caminho];
    armazenamento.apagados = [];
    await service.updateProfile(USER_ID, defaultCosmetics(), { avatarUrl: FOTO });

    expect(armazenamento.apagados).toEqual([]);
  });

  /**
   * Infraestrutura fora do ar não pode custar a ação que a pessoa pediu:
   * volta a guardar no banco, como antes do Storage existir, e a rota
   * `/api/users/:username/avatar` continua servindo esse caso.
   */
  it('Storage fora do ar guarda no banco em vez de recusar a troca', async () => {
    const { service, repo, armazenamento } = comArmazenamento();
    armazenamento.quebrado = true;

    const result = await service.updateProfile(USER_ID, defaultCosmetics(), { avatarUrl: FOTO });

    expect(result.kind).toBe('ok');
    expect(repo.users.get(USER_ID)?.avatarUrl).toBe(FOTO);
  });

  it('sem armazenamento configurado, o comportamento é o de sempre', async () => {
    const repo = new FakeProfileRepository();
    repo.users.set(USER_ID, makeAccount());
    const service = new ProfileService(repo, ADMIN_USERNAME, SECRET);

    await service.updateProfile(USER_ID, defaultCosmetics(), { avatarUrl: FOTO });

    expect(repo.users.get(USER_ID)?.avatarUrl).toBe(FOTO);
  });

  /** Link que a pessoa digitou não é nosso: passa direto, sem subir nada. */
  it('link externo não vai parar no Storage', async () => {
    const { service, repo, armazenamento } = comArmazenamento();

    await service.updateProfile(USER_ID, defaultCosmetics(), { avatarUrl: 'https://outro.site/foto.png' });

    expect(armazenamento.guardados).toEqual([]);
    expect(repo.users.get(USER_ID)?.avatarUrl).toBe('https://outro.site/foto.png');
  });

  it('foto inválida continua sendo recusada antes de tocar no Storage', async () => {
    const { service, armazenamento } = comArmazenamento();

    const result = await service.updateProfile(USER_ID, defaultCosmetics(), { avatarUrl: 'javascript:alert(1)' });

    expect(result.kind).toBe('invalid-avatar');
    expect(armazenamento.guardados).toEqual([]);
  });
});
