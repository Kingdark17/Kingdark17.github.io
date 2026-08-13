import { Test } from '@nestjs/testing';

import { ProfileController } from './profile.controller';
import { ProfileModule } from './profile.module';
import { ProfileService } from './profile.service';

describe('ProfileModule', () => {
  it('resolve ProfileController e ProfileService sem exigir DATABASE_URL', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ProfileModule] }).compile();

    expect(moduleRef.get(ProfileController)).toBeInstanceOf(ProfileController);
    expect(moduleRef.get(ProfileService)).toBeInstanceOf(ProfileService);
  });
});
