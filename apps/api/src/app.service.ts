import { Injectable } from '@nestjs/common';
import { derivedStats, xpForLevel, type DerivedStats, type HeroCore } from '@rpg-legend/shared';

@Injectable()
export class AppService {
  /**
   * Semente da validação autoritativa da fase 2.
   *
   * O ponto aqui não é o endpoint — é que este cálculo usa exatamente a mesma
   * função que o cliente usou para produzir o número. Antes da migração o
   * servidor reimplementava a fórmula à mão em `sanitizeHero()`, e as duas
   * cópias já haviam divergido no teto de equipamento.
   */
  authoritativeStats(hero: HeroCore): DerivedStats & { xpNext: number } {
    return { ...derivedStats(hero), xpNext: xpForLevel(hero.level) };
  }
}
