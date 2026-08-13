/**
 * Rotas de e-mail/senha — mesmos caminhos, corpos e mensagens de erro do
 * accounts.js original, porque é `rpg-legend/js/account.js` que fala com
 * elas hoje (`saveEmail`, `resendVerification`, `forgotPassword`,
 * `handleEmailLink`).
 *
 * Guardas por rota, não no controller: confirmar e-mail e redefinir senha
 * acontecem por link, sem sessão nenhuma — quem chega ali acabou de
 * perder o acesso à conta. Trocar o e-mail e reenviar confirmação exigem
 * sessão. Pedir reset e redefinir senha entram no mesmo teto por IP do
 * login/cadastro, como no original.
 */

import { Body, Controller, HttpCode, HttpException, HttpStatus, Post, Put, UseGuards } from '@nestjs/common';

import { AccountEmailService } from './account-email.service';
import { AuthGuard } from './auth.guard';
import type { SafeUser } from './cosmetics';
import { CurrentUser } from './current-user.decorator';
import { IpRateLimitGuard } from './ip-rate-limit.guard';

@Controller('api/account')
export class AccountEmailController {
  constructor(private readonly accountEmail: AccountEmailService) {}

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() body: { token?: unknown }) {
    const result = await this.accountEmail.verifyEmail(String(body.token ?? ''));
    if (result.kind === 'invalid-token') {
      throw new HttpException({ error: 'Link de confirmação inválido ou expirado.' }, HttpStatus.BAD_REQUEST);
    }
    return { ok: true };
  }

  @Post('request-password-reset')
  @UseGuards(IpRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() body: { email?: unknown }) {
    await this.accountEmail.requestPasswordReset(String(body.email ?? ''));
    // Mesma resposta com conta ou sem: a rota não pode virar um
    // verificador de quais e-mails estão cadastrados.
    return { ok: true, message: 'Se o e-mail estiver cadastrado, enviaremos um link de recuperação.' };
  }

  @Post('reset-password')
  @UseGuards(IpRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: { token?: unknown; password?: unknown }) {
    const result = await this.accountEmail.resetPassword(String(body.token ?? ''), String(body.password ?? ''));
    switch (result.kind) {
      case 'invalid-password':
        throw new HttpException({ error: 'A senha precisa ter entre 8 e 128 caracteres.' }, HttpStatus.BAD_REQUEST);
      case 'invalid-token':
        throw new HttpException({ error: 'Link de recuperação inválido ou expirado.' }, HttpStatus.BAD_REQUEST);
      case 'ok':
        return { ok: true };
    }
  }

  @Put('email')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async changeEmail(@CurrentUser() user: SafeUser, @Body() body: { email?: unknown; password?: unknown }) {
    const result = await this.accountEmail.changeEmail(user.id, String(body.email ?? ''), String(body.password ?? ''));
    switch (result.kind) {
      case 'invalid-email':
        throw new HttpException({ error: 'Informe um e-mail válido.' }, HttpStatus.BAD_REQUEST);
      case 'wrong-password':
        throw new HttpException({ error: 'Senha incorreta.' }, HttpStatus.UNAUTHORIZED);
      case 'account-not-found':
        throw new HttpException({ error: 'Entre novamente na sua conta.' }, HttpStatus.UNAUTHORIZED);
      case 'email-taken':
        throw new HttpException({ error: 'Este e-mail já pertence a outra conta.' }, HttpStatus.CONFLICT);
      case 'ok':
        return { user: result.user };
    }
  }

  @Post('resend-verification')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async resendVerification(@CurrentUser() user: SafeUser) {
    const result = await this.accountEmail.resendVerification(user);
    if (result.kind === 'no-email') {
      throw new HttpException({ error: 'Adicione um e-mail à conta primeiro.' }, HttpStatus.BAD_REQUEST);
    }
    // E-mail já confirmado responde ok, igual ao original: reenviar não
    // faz sentido, mas também não é erro do ponto de vista de quem pediu.
    return { ok: true };
  }
}
