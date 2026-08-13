/**
 * Rotas HTTP de perfil/cosméticos — mesmo esquema
 * `/api/account/profile[/catalog|/purchase]` e as mesmas mensagens de
 * erro do `accounts.js` original. Todas exigem sessão válida via
 * `AuthGuard`.
 */

import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Post, Put, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import type { SafeUser } from '../auth/cosmetics';
import { CurrentUser } from '../auth/current-user.decorator';
import { ProfileService } from './profile.service';

@Controller('api/account/profile')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('catalog')
  catalog(@CurrentUser() user: SafeUser) {
    return this.profileService.listCatalog(user.isAdmin, user.cosmetics);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  async update(@CurrentUser() user: SafeUser, @Body() body: { avatarUrl?: unknown; frame?: unknown; nameColor?: unknown; pet?: unknown }) {
    const result = await this.profileService.updateProfile(user.id, user.cosmetics, body);
    switch (result.kind) {
      case 'invalid-avatar':
        throw new HttpException({ error: 'Use uma foto PNG, JPG ou WebP válida de até 300 KB.' }, HttpStatus.BAD_REQUEST);
      case 'invalid-selection':
        throw new HttpException({ error: 'Personalização inválida.' }, HttpStatus.BAD_REQUEST);
      case 'not-unlocked':
        throw new HttpException({ error: 'Sua conta ainda não desbloqueou essa personalização.' }, HttpStatus.FORBIDDEN);
      case 'ok':
        return { user: result.user };
    }
  }

  @Post('purchase')
  @HttpCode(HttpStatus.OK)
  async purchase(@CurrentUser() user: SafeUser, @Body() body: { id?: unknown; slot?: unknown }) {
    const result = await this.profileService.purchase(user.id, body, user.isAdmin);
    switch (result.kind) {
      case 'item-not-found':
        throw new HttpException({ error: 'Item da loja não encontrado.' }, HttpStatus.NOT_FOUND);
      case 'admin-only':
        throw new HttpException({ error: 'Este item é exclusivo do administrador.' }, HttpStatus.FORBIDDEN);
      case 'invalid-slot':
        throw new HttpException({ error: 'Selecione um personagem antes de comprar.' }, HttpStatus.BAD_REQUEST);
      case 'no-character':
        throw new HttpException({ error: 'Crie um personagem e salve na nuvem antes de comprar.' }, HttpStatus.CONFLICT);
      case 'already-owned':
        throw new HttpException({ error: 'Você já possui esse item.' }, HttpStatus.CONFLICT);
      case 'insufficient-gold':
        throw new HttpException({ error: 'Ouro insuficiente para essa compra.' }, HttpStatus.CONFLICT);
      case 'purchased':
        return { ok: true, item: result.item, user: result.user, save: result.save, signature: result.signature };
    }
  }
}
