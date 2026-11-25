import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RateLimitMiddleware } from './common/rate-limit';
import { DatabaseModule } from './database/database.module';
import { StellarModule } from './stellar/stellar.module';
import { AccountsModule } from './accounts/accounts.module';
import { AnchorModule } from './anchor/anchor.module';
import { SplitsModule } from './splits/splits.module';
import { VaultModule } from './vault/vault.module';
import { RemittancesModule } from './remittances/remittances.module';
import { StatsModule } from './stats/stats.module';
import { KeeperModule } from './keeper/keeper.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    DatabaseModule,
    StellarModule,
    AccountsModule,
    AnchorModule,
    SplitsModule,
    VaultModule,
    RemittancesModule,
    StatsModule,
    KeeperModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Every POST builds, submits or records something; GETs stay unlimited.
    consumer.apply(RateLimitMiddleware).forRoutes({ path: '*path', method: RequestMethod.POST });
  }
}
