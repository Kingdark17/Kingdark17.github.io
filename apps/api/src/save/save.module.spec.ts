import { Test } from '@nestjs/testing';

import { SaveController } from './save.controller';
import { SaveModule } from './save.module';
import { SaveService } from './save.service';

describe('SaveModule', () => {
  it('resolve SaveController e SaveService sem exigir DATABASE_URL', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [SaveModule] }).compile();

    expect(moduleRef.get(SaveController)).toBeInstanceOf(SaveController);
    expect(moduleRef.get(SaveService)).toBeInstanceOf(SaveService);
  });
});
