import { Test } from '@nestjs/testing';

import { SocialController } from './social.controller';
import { SocialModule } from './social.module';
import { SocialService } from './social.service';

describe('SocialModule', () => {
  it('resolve SocialController e SocialService sem exigir DATABASE_URL', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [SocialModule] }).compile();

    expect(moduleRef.get(SocialController)).toBeInstanceOf(SocialController);
    expect(moduleRef.get(SocialService)).toBeInstanceOf(SocialService);
  });
});
