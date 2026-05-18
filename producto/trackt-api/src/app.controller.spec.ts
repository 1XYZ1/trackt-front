import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseService } from './supabase.service';
import { AuthGuard } from './auth/auth.guard';

describe('AppController', () => {
  let appController: AppController;

  const supabaseMock = {
    getClient: jest.fn(),
    getAdminClient: jest.fn(),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: SupabaseService, useValue: supabaseMock },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return greeting message', () => {
      expect(appController.getHello()).toEqual({
        message: 'Hello World from Trackt API!',
      });
    });
  });
});
