import { Test, type TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('engine compartilhada', () => {
    it('calcula os derivados com @rpg-legend/shared dentro do Nest', () => {
      const stats = appController.smokeDerived();

      // Mesmos números que packages/shared/src/hero/derived.test.ts fixa:
      // 20 + 3*5 + 15*10 + 20 (vida do equipamento, abaixo do teto de 650)
      expect(stats.maxHp).toBe(205);
      // 10 + 3*2 + 8*5 + 10
      expect(stats.maxMp).toBe(66);
      // 40 + (3-1)*35
      expect(stats.xpNext).toBe(110);
    });
  });
});
