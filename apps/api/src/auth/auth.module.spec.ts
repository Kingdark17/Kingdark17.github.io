import { Test } from '@nestjs/testing';

import { AuthController } from './auth.controller';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';

describe('AuthModule', () => {
  it('resolve AuthController e AuthService sem exigir DATABASE_URL', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AuthModule] }).compile();

    expect(moduleRef.get(AuthController)).toBeInstanceOf(AuthController);
    expect(moduleRef.get(AuthService)).toBeInstanceOf(AuthService);
  });
});
