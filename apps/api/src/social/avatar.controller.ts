/**
 * `GET /api/users/:username/avatar` — a foto de perfil como imagem de
 * verdade, pro navegador guardar em cache. Ver `avatar.ts` pro porquê.
 *
 * **Rota pública, de propósito.** Um `<img src>` não manda o `Bearer` do
 * localStorage, então exigir sessão aqui obrigaria a buscar cada foto por
 * `fetch` e transformar em blob — muito código pra proteger o que já é
 * visível pra qualquer amigo e pra qualquer sala pública. Decidido com o
 * dono do projeto em 2026-08-16.
 *
 * O `Cache-Control` que o handler escreve **substitui** o `no-store` que
 * o `NoStoreInterceptor` põe em toda resposta de `/api/*` — o
 * interceptador roda antes, e `setHeader` sobrescreve. É intencional:
 * foto de perfil não é progresso de jogo. Sem `?v=` não há cache longo,
 * porque aí não haveria como saber que a foto mudou.
 */

import { Controller, Get, HttpException, HttpStatus, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

import { SocialService } from './social.service';

/** Um ano — o endereço muda junto com a foto, então nunca fica velho. */
const CACHE_LONGO = 'public, max-age=31536000, immutable';
const SEM_CACHE = 'no-cache';

@Controller('api/users')
export class AvatarController {
  constructor(private readonly socialService: SocialService) {}

  @Get(':username/avatar')
  async avatar(@Param('username') username: string, @Query('v') versao: string | undefined, @Res() res: Response): Promise<void> {
    const foto = await this.socialService.findAvatar(username);
    if (!foto) throw new HttpException({ error: 'Foto não encontrada.' }, HttpStatus.NOT_FOUND);

    res.setHeader('Content-Type', foto.mime);
    res.setHeader('Content-Length', foto.bytes.length);
    res.setHeader('Cache-Control', versao ? CACHE_LONGO : SEM_CACHE);
    res.end(foto.bytes);
  }
}
