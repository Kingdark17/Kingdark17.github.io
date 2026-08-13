import { Controller, Get } from '@nestjs/common';
import type { HeroCore } from '@rpg-legend/shared';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Rota de fumaça da fase 0: confirma que a engine compartilhada roda dentro
   * do Nest (que é CommonJS) e devolve os mesmos números que o Next calculou.
   * Vira POST com DTO validado na fase 2.
   */
  @Get('smoke/derived')
  smokeDerived() {
    const hero: HeroCore = {
      level: 3,
      attrs: {
        forca: 14,
        destreza: 12,
        constituicao: 15,
        intelecto: 8,
        sabedoria: 10,
        carisma: 11,
      },
      equip: {
        arma: { stats: { ataque: 6, critico: 2 } },
        armadura: { stats: { defesa: 4, vida: 20 } },
        acessorio: { stats: { mana: 10, esquiva: 3 } },
      },
    };

    return this.appService.authoritativeStats(hero);
  }
}
