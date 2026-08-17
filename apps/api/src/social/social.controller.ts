/**
 * Rotas HTTP de amigos/chat — mesmo esquema `/api/friends[/request|/accept|
 * /decline|/remove]` e `/api/messages/:username` (GET/POST) e as mesmas
 * mensagens de erro do `accounts.js` original. Todas exigem sessão
 * válida via `AuthGuard`.
 */

import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import type { SafeUser } from '../auth/cosmetics';
import { CurrentUser } from '../auth/current-user.decorator';
import { SocialService } from './social.service';
import { comoTexto } from '../common/texto';

const FRIEND_REQUEST_ERROR_MESSAGES = {
  'target-not-found': 'Jogador não encontrado.',
  'cannot-add-self': 'Você não pode adicionar a si mesmo.',
  'already-friends': 'Vocês já são amigos.',
  'already-requested': 'Você já enviou um pedido para esse jogador.',
} as const;

const SIMPLE_FRIEND_ERROR_MESSAGES = {
  'target-not-found': 'Jogador não encontrado.',
  'no-pending-request': 'Nenhum pedido pendente desse jogador.',
} as const;

const CHAT_ERROR_MESSAGES = {
  'target-not-found': 'Jogador não encontrado.',
  'not-friends': 'Vocês precisam ser amigos para conversar.',
  'empty-message': 'Mensagem vazia.',
} as const;

@Controller()
@UseGuards(AuthGuard)
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Get('api/friends')
  async listFriends(@CurrentUser() user: SafeUser) {
    return this.socialService.listRelations(user.id);
  }

  @Post('api/friends/request')
  @HttpCode(HttpStatus.OK)
  async requestFriend(@CurrentUser() user: SafeUser, @Body() body: { username?: unknown }) {
    const result = await this.socialService.sendFriendRequest(user, comoTexto(body.username));
    if (result.kind === 'accepted') return { ok: true, accepted: true };
    if (result.kind === 'sent') return { ok: true, accepted: false };
    throw new HttpException({ error: FRIEND_REQUEST_ERROR_MESSAGES[result.kind] }, HttpStatus.BAD_REQUEST);
  }

  @Post('api/friends/accept')
  @HttpCode(HttpStatus.OK)
  async acceptFriend(@CurrentUser() user: SafeUser, @Body() body: { username?: unknown }) {
    const result = await this.socialService.acceptFriendRequest(user, comoTexto(body.username));
    if (result.kind === 'ok') return { ok: true };
    throw new HttpException({ error: SIMPLE_FRIEND_ERROR_MESSAGES[result.kind] }, HttpStatus.BAD_REQUEST);
  }

  @Post('api/friends/decline')
  @HttpCode(HttpStatus.OK)
  async declineFriend(@CurrentUser() user: SafeUser, @Body() body: { username?: unknown }) {
    const result = await this.socialService.declineFriendRequest(user.id, comoTexto(body.username));
    if (result.kind === 'ok') return { ok: true };
    throw new HttpException({ error: 'Jogador não encontrado.' }, HttpStatus.BAD_REQUEST);
  }

  @Post('api/friends/remove')
  @HttpCode(HttpStatus.OK)
  async removeFriend(@CurrentUser() user: SafeUser, @Body() body: { username?: unknown }) {
    const result = await this.socialService.removeFriend(user.id, comoTexto(body.username));
    if (result.kind === 'ok') return { ok: true };
    throw new HttpException({ error: 'Jogador não encontrado.' }, HttpStatus.BAD_REQUEST);
  }

  @Get('api/messages/:username')
  async recentMessages(
    @CurrentUser() user: SafeUser,
    @Param('username') username: string,
    @Query('before') before: string,
    @Query('limit') limit: string,
  ) {
    const result = await this.socialService.recentMessages(user.id, username, before, limit);
    if (result.kind === 'ok') return { messages: result.messages };
    // O original não distingue "não achou" de "não são amigos" aqui, de propósito.
    throw new HttpException({ error: 'Vocês precisam ser amigos para ver o histórico.' }, HttpStatus.FORBIDDEN);
  }

  @Post('api/messages/:username')
  @HttpCode(HttpStatus.OK)
  async sendMessage(@CurrentUser() user: SafeUser, @Param('username') username: string, @Body() body: { body?: unknown }) {
    const result = await this.socialService.sendChatMessage(user, username, body.body);
    if (result.kind === 'ok') return { ok: true, message: result.message };
    throw new HttpException({ error: CHAT_ERROR_MESSAGES[result.kind] }, HttpStatus.BAD_REQUEST);
  }
}
