import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StellarModule } from './stellar/stellar.module';
import { AnchorModule } from './anchor/anchor.module';
import { SplitsModule } from './splits/splits.module';
import { VaultModule } from './vault/vault.module';
import { RemittancesModule } from './remittances/remittances.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    StellarModule,
    AnchorModule,
    SplitsModule,
    VaultModule,
    RemittancesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
