/**
 * Rotas HTTP de conta — mantém o esquema `/api/account/*` e as mensagens
 * de erro do `accounts.js` original de propósito: enquanto os dois
 * servidores puderem coexistir, o cliente (`rpg-legend/js/account.js`)
 * não precisa mudar uma linha pra falar com este Nest no lugar do
 * servidor legado. Sem class-validator: os corpos são coeridos com
 * `String(...)` igual o original fazia, e todo o formato/validação real
 * já mora em `AuthService`.
 */

import { Body, Controller, Get, Headers, HttpCode, HttpException, HttpStatus, Post } from '@nestjs/common';

import { AuthService } from './auth.service';
import { extractBearerToken } from './bearer-token';

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

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: RegisterBody) {
    const result = await this.authService.register({
      username: String(body.username ?? ''),
      email: String(body.email ?? ''),
      password: String(body.password ?? ''),
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
        return { token: result.token, user: result.user };
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginBody) {
    const result = await this.authService.login({
      username: String(body.username ?? ''),
      password: String(body.password ?? ''),
    });
    if (result.kind === 'invalid-credentials') {
      throw new HttpException({ error: 'Usuário ou senha incorretos.' }, HttpStatus.UNAUTHORIZED);
    }
    return { token: result.token, user: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Headers('authorization') authorization: string | undefined) {
    await this.authService.logout(extractBearerToken(authorization));
    return { ok: true };
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@Headers('authorization') authorization: string | undefined) {
    const result = await this.authService.me(extractBearerToken(authorization));
    if (result.kind === 'unauthenticated') {
      throw new HttpException({ error: 'Entre novamente na sua conta.' }, HttpStatus.UNAUTHORIZED);
    }
    return { user: result.user };
  }
}
