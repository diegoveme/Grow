import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseService } from './database/database.service';
import { KeeperService } from './keeper/keeper.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'network' ? 'TESTNET' : { yieldSplitter: undefined },
          },
        },
        { provide: DatabaseService, useValue: { enabled: false } },
        { provide: KeeperService, useValue: { getStatus: () => ({ enabled: false }) } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('reports ok status', () => {
      expect(appController.health().status).toBe('ok');
    });
  });
});
