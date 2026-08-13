/**
 * Rotas HTTP de save na nuvem — mesmo esquema `/api/characters`,
 * `/api/save`, `/api/save/reset`, `/api/save/verify`, `/api/save/history`
 * e `/api/save/restore` do `accounts.js` original, com as mesmas
 * mensagens de erro (ver justificativa em `../auth/auth.controller.ts`).
 * Todas as rotas exigem sessão válida via `AuthGuard`.
 */

import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Post, Put, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { SafeUser } from '../auth/cosmetics';
import { SaveService } from './save.service';

@Controller()
@UseGuards(AuthGuard)
export class SaveController {
  constructor(private readonly saveService: SaveService) {}

  @Get('api/characters')
  async characters(@CurrentUser() user: SafeUser) {
    return this.saveService.listCharacters(user.id);
  }

  @Get('api/save')
  async getSave(@CurrentUser() user: SafeUser, @Query('slot') slot: string) {
    const result = await this.saveService.getSave(user.id, slot);
    if (result.kind === 'invalid-slot') throw new HttpException({ error: 'Slot inválido.' }, HttpStatus.BAD_REQUEST);
    if (result.kind === 'empty') return { save: null };
    return { save: result.save, signature: result.signature, updatedAt: result.updatedAt };
  }

  @Put('api/save')
  @HttpCode(HttpStatus.OK)
  async putSave(@CurrentUser() user: SafeUser, @Body() body: { slot?: unknown; save?: unknown; baseSignature?: unknown; source?: unknown }) {
    const result = await this.saveService.putSave(user.id, {
      slot: body.slot,
      save: body.save,
      baseSignature: body.baseSignature,
      source: body.source,
    });
    switch (result.kind) {
      case 'invalid-slot':
        throw new HttpException({ error: 'Slot inválido.' }, HttpStatus.BAD_REQUEST);
      case 'imported-backup-rejected':
        throw new HttpException({ error: 'Backups importados funcionam apenas no modo offline.' }, HttpStatus.FORBIDDEN);
      case 'invalid-save':
        throw new HttpException({ error: 'Progresso inválido.' }, HttpStatus.BAD_REQUEST);
      case 'stale-signature':
        throw new HttpException(
          { error: 'Este navegador não possui a assinatura oficial atual. Carregue o progresso da nuvem antes de salvar.' },
          HttpStatus.CONFLICT,
        );
      case 'invalid-transition':
        throw new HttpException(
          { error: 'A alteração de progresso não passou pela validação do servidor. Recupere a última versão oficial.' },
          HttpStatus.CONFLICT,
        );
      case 'ok':
        return { ok: true, signature: result.signature };
    }
  }

  @Post('api/save/reset')
  @HttpCode(HttpStatus.OK)
  async resetSave(@CurrentUser() user: SafeUser, @Body() body: { slot?: unknown }) {
    const result = await this.saveService.resetSave(user.id, body.slot);
    if (result.kind === 'invalid-slot') throw new HttpException({ error: 'Slot inválido.' }, HttpStatus.BAD_REQUEST);
    return { ok: true };
  }

  @Post('api/save/verify')
  @HttpCode(HttpStatus.OK)
  verifySave(@CurrentUser() user: SafeUser, @Body() body: { slot?: unknown; save?: unknown; signature?: unknown }) {
    const result = this.saveService.verifySave(user.id, { slot: body.slot, save: body.save, signature: body.signature });
    if (result.kind === 'invalid-slot') throw new HttpException({ error: 'Slot inválido.' }, HttpStatus.BAD_REQUEST);
    return { valid: result.valid };
  }

  @Get('api/save/history')
  async history(@CurrentUser() user: SafeUser, @Query('slot') slot: string) {
    const result = await this.saveService.getHistory(user.id, slot);
    if (result.kind === 'invalid-slot') throw new HttpException({ error: 'Slot inválido.' }, HttpStatus.BAD_REQUEST);
    return { versions: result.versions };
  }

  @Post('api/save/restore')
  @HttpCode(HttpStatus.OK)
  async restore(@CurrentUser() user: SafeUser, @Body() body: { slot?: unknown; id?: unknown }) {
    const result = await this.saveService.restoreSave(user.id, { slot: body.slot, id: body.id });
    switch (result.kind) {
      case 'invalid-slot':
        throw new HttpException({ error: 'Slot inválido.' }, HttpStatus.BAD_REQUEST);
      case 'invalid-version':
        throw new HttpException({ error: 'Versão inválida.' }, HttpStatus.BAD_REQUEST);
      case 'not-found':
        throw new HttpException({ error: 'Versão não encontrada.' }, HttpStatus.NOT_FOUND);
      case 'ok':
        return { ok: true, save: result.save, signature: result.signature };
    }
  }
}
