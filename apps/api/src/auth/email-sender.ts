/**
 * Envio de e-mail transacional pelo Resend — porta do `sendEmail()` do
 * accounts.js original, com o mesmo comportamento quando falta
 * configuração: avisa no log e devolve `false`, sem derrubar a operação
 * que pediu o envio. Confirmar e-mail e redefinir senha são melhor-esforço
 * por natureza; o token já foi gravado no banco de qualquer jeito.
 *
 * A config é lida a cada chamada (não no construtor) porque é assim que o
 * original se comporta: dá pra configurar `RESEND_API_KEY`/`EMAIL_FROM` e
 * o envio passar a funcionar sem reiniciar o processo. `fetch` entra
 * injetável só pra o teste não sair pra internet.
 *
 * VERIFICADO PONTA A PONTA em 22/08/2026, com o domínio rpglegend.com.br já
 * verificado no Resend: `scripts/envia-teste.mjs` instancia esta mesma classe
 * e manda e-mail de verdade — o Resend aceitou. Os testes unitários cobrem o
 * formato do payload e o tratamento de erro; o script cobre o caminho real,
 * e é o que rodar de novo se alguém mexer no envio.
 */

import { Logger } from '@nestjs/common';

export interface EmailSender {
  /** `true` só quando o provedor aceitou. Nunca lança. */
  send(to: string, subject: string, html: string): Promise<boolean>;
}

export interface ResendConfig {
  apiKey?: string;
  from?: string;
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export function resendConfigFromEnv(): ResendConfig {
  return { apiKey: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM };
}

export class ResendEmailSender implements EmailSender {
  private readonly logger = new Logger(ResendEmailSender.name);

  constructor(
    private readonly readConfig: () => ResendConfig = resendConfigFromEnv,
    private readonly fetchImpl: typeof fetch = (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
  ) {}

  async send(to: string, subject: string, html: string): Promise<boolean> {
    const { apiKey, from } = this.readConfig();
    if (!apiKey || !from) {
      this.logger.warn('E-mail não enviado: configure RESEND_API_KEY e EMAIL_FROM.');
      return false;
    }

    try {
      const response = await this.fetchImpl(RESEND_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, html }),
      });
      if (!response.ok) {
        this.logger.error(`Falha no envio de e-mail: ${response.status} ${await response.text()}`);
        return false;
      }
      return true;
    } catch (err) {
      // O original deixava a exceção subir e virar 500 na rota. Aqui não:
      // provedor de e-mail fora do ar não pode reprovar um cadastro.
      this.logger.error('Erro de rede ao enviar e-mail', err as Error);
      return false;
    }
  }
}
