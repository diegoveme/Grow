import { Global, Module } from '@nestjs/common';
import { HorizonService } from './horizon.service';
import { SorobanService } from './soroban.service';

/** Network clients shared by every feature module. */
@Global()
@Module({
  providers: [SorobanService, HorizonService],
  exports: [SorobanService, HorizonService],
})
export class StellarModule {}
