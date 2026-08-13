import { isUiAction, sanitizeUiActionPayload } from './ui-action';

describe('isUiAction', () => {
  it('aceita só a lista fechada de ações', () => {
    expect(isUiAction('shop')).toBe(true);
    expect(isUiAction('questboard')).toBe(true);
    expect(isUiAction('drop-tudo')).toBe(false);
    expect(isUiAction(42)).toBe(false);
    expect(isUiAction(undefined)).toBe(false);
  });
});

describe('sanitizeUiActionPayload', () => {
  it('clampa a célula alvo e normaliza o tipo de loja', () => {
    const payload = sanitizeUiActionPayload('shop', { x: 999, y: -999, kind: 'sei-la' });
    expect(payload).toEqual({ x: 11, y: -1, kind: 'shop' });

    expect(sanitizeUiActionPayload('shop', { x: 2, y: 3, kind: 'blacksmith' }).kind).toBe('blacksmith');
  });

  it('payload que não é objeto vira o padrão', () => {
    expect(sanitizeUiActionPayload('event', 'ataque')).toEqual({ x: -1, y: -1, kind: 'shop' });
  });

  it('diálogo simples: tira < > e corta ícone/título/texto', () => {
    const payload = sanitizeUiActionPayload('simple', {
      icon: 'x'.repeat(20),
      title: '<script>alerta',
      text: '<b>' + 'y'.repeat(600),
    });

    expect(payload.icon).toHaveLength(8);
    expect(payload.title).toBe('scriptalerta');
    expect(payload.text).not.toContain('<');
    expect(payload.text).toHaveLength(500);
  });

  it('não anexa campos de diálogo em ação que não é simple', () => {
    const payload = sanitizeUiActionPayload('shop', { title: 'oi', text: 'oi' });
    expect(payload).not.toHaveProperty('title');
    expect(payload).not.toHaveProperty('text');
  });

  it('NPC: limita nome/papel/serviço/ícone e no máximo 10 falas', () => {
    const payload = sanitizeUiActionPayload('npc', {
      npc: {
        name: '<b>' + 'n'.repeat(80),
        role: 'r'.repeat(80),
        service: 's'.repeat(40),
        icon: 'i'.repeat(20),
        lines: new Array(30).fill('<i>' + 'l'.repeat(400)),
        serviceUsed: 'sim',
      },
    });

    expect(payload.npc?.name).toHaveLength(50);
    expect(payload.npc?.name).not.toContain('<');
    expect(payload.npc?.role).toHaveLength(50);
    expect(payload.npc?.service).toHaveLength(20);
    expect(payload.npc?.icon).toHaveLength(8);
    expect(payload.npc?.lines).toHaveLength(10);
    expect(payload.npc?.lines[0]).toHaveLength(300);
    expect(payload.npc?.serviceUsed).toBe(true);
  });

  it('NPC sem nome cai pro rótulo padrão', () => {
    const payload = sanitizeUiActionPayload('npc', { npc: {} });
    expect(payload.npc?.name).toBe('NPC');
  });

  it('ação npc sem objeto npc não inventa um', () => {
    expect(sanitizeUiActionPayload('npc', { x: 1, y: 1 }).npc).toBeUndefined();
  });
});
