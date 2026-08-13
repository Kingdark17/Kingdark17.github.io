import { ResendEmailSender, type ResendConfig } from './email-sender';

function fakeFetch(response: { ok: boolean; status?: number; text?: string }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return {
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 422),
      text: async () => response.text ?? '',
    } as Response;
  }) as typeof fetch;
  return { impl, calls };
}

const CONFIGURED: ResendConfig = { apiKey: 'chave-de-teste', from: 'rpg@exemplo.com' };

describe('ResendEmailSender', () => {
  it('monta a requisição do Resend com from/to/subject/html', async () => {
    const { impl, calls } = fakeFetch({ ok: true });
    const sender = new ResendEmailSender(() => CONFIGURED, impl);

    expect(await sender.send('aria@exemplo.com', 'Assunto', '<p>corpo</p>')).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.resend.com/emails');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer chave-de-teste');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      from: 'rpg@exemplo.com',
      to: ['aria@exemplo.com'],
      subject: 'Assunto',
      html: '<p>corpo</p>',
    });
  });

  it('sem chave ou sem remetente não tenta enviar e devolve false', async () => {
    const semChave = fakeFetch({ ok: true });
    expect(await new ResendEmailSender(() => ({ from: 'rpg@exemplo.com' }), semChave.impl).send('a@b.co', 's', 'h')).toBe(false);
    expect(semChave.calls).toEqual([]);

    const semRemetente = fakeFetch({ ok: true });
    expect(await new ResendEmailSender(() => ({ apiKey: 'x' }), semRemetente.impl).send('a@b.co', 's', 'h')).toBe(false);
    expect(semRemetente.calls).toEqual([]);
  });

  it('resposta de erro do provedor vira false, não exceção', async () => {
    const { impl } = fakeFetch({ ok: false, status: 422, text: 'domínio não verificado' });
    const sender = new ResendEmailSender(() => CONFIGURED, impl);

    await expect(sender.send('a@b.co', 's', 'h')).resolves.toBe(false);
  });

  it('erro de rede vira false, não derruba quem chamou', async () => {
    const impl = (async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    }) as unknown as typeof fetch;
    const sender = new ResendEmailSender(() => CONFIGURED, impl);

    await expect(sender.send('a@b.co', 's', 'h')).resolves.toBe(false);
  });

  it('lê a configuração a cada envio, não uma vez no construtor', async () => {
    const { impl, calls } = fakeFetch({ ok: true });
    let config: ResendConfig = {};
    const sender = new ResendEmailSender(() => config, impl);

    expect(await sender.send('a@b.co', 's', 'h')).toBe(false);
    config = CONFIGURED;
    expect(await sender.send('a@b.co', 's', 'h')).toBe(true);
    expect(calls).toHaveLength(1);
  });
});
