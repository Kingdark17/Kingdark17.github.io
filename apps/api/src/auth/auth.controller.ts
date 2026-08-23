/**
 * Rotas HTTP de conta — mantém o esquema `/api/account/*` e as mensagens
 * de erro do `accounts.js` original de propósito: enquanto os dois
 * servidores puderem coexistir, o cliente (`rpg-legend/js/account.js`)
 * não precisa mudar uma linha pra falar com este Nest no lugar do
 * servidor legado. Sem class-validator: os corpos são coeridos com
 * `String(...)` igual o original fazia, e todo o formato/validação real
 * já mora em `AuthService`.
 */

import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { IpRateLimitGuard } from './ip-rate-limit.guard';
import { NOME_DO_COOKIE, extrairTokenDaSessao, opcoesDeRemocao, opcoesDoCookie } from './session-cookie';
import { comoTexto } from '../common/texto';

interface RegisterBody {
  username?: unknown;
  email?: unknown;
  password?: unknown;
}

interface LoginBody {
  username?: unknown;
  password?: unknown;
}

@Controller('api/account')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * O token continua saindo no corpo além de virar cookie. Não é descuido:
   * o evento `auth` do socket e qualquer cliente que não seja navegador
   * ainda mandam token na mão, e cortar isso agora quebraria os dois. Quem
   * é navegador passa a ignorar o campo e deixar o cookie trabalhar — é o
   * front que para de guardar, não a API que para de emitir.
   */
  private entregarSessao(res: Response, token: string) {
    res.cookie(NOME_DO_COOKIE, token, opcoesDoCookie());
  }

  @Post('register')
  @UseGuards(IpRateLimitGuard)
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: RegisterBody, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register({
      username: comoTexto(body.username),
      email: comoTexto(body.email),
      password: comoTexto(body.password),
    });
    switch (result.kind) {
      case 'invalid-username':
        throw new HttpException({ error: 'Use de 3 a 24 letras, números ou _ no nome.' }, HttpStatus.BAD_REQUEST);
      case 'invalid-email':
        throw new HttpException({ error: 'Informe um e-mail válido.' }, HttpStatus.BAD_REQUEST);
      case 'invalid-password':
        throw new HttpException({ error: 'A senha precisa ter entre 8 e 128 caracteres.' }, HttpStatus.BAD_REQUEST);
      case 'username-or-email-taken':
        throw new HttpException({ error: 'Esse nome de usuário ou e-mail já está sendo usado.' }, HttpStatus.CONFLICT);
      case 'registered':
        this.entregarSessao(res, result.token);
        return { token: result.token, user: result.user };
    }
  }

  @Post('login')
  @UseGuards(IpRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginBody, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login({
      username: comoTexto(body.username),
      password: comoTexto(body.password),
    });
    if (result.kind === 'invalid-credentials') {
      throw new HttpException({ error: 'Usuário ou senha incorretos.' }, HttpStatus.UNAUTHORIZED);
    }
    this.entregarSessao(res, result.token);
    return { token: result.token, user: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(extrairTokenDaSessao(req));
    // O cookie cai mesmo se a sessão no banco já tinha expirado: o jogador
    // pediu pra sair, e sair não pode depender de a sessão ainda existir.
    res.clearCookie(NOME_DO_COOKIE, opcoesDeRemocao());
    return { ok: true };
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@Req() req: Request) {
    const result = await this.authService.me(extrairTokenDaSessao(req));
    if (result.kind === 'unauthenticated') {
      throw new HttpException({ error: 'Entre novamente na sua conta.' }, HttpStatus.UNAUTHORIZED);
    }
    return { user: result.user };
  }
}
