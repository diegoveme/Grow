import { Module } from '@nestjs/common';
import { SplitsModule } from '../splits/splits.module';
import { StatsModule } from '../stats/stats.module';
import { KeeperService } from './keeper.service';

/** Runs due recurring remittances on a timer (off without KEEPER_SECRET). */
@Module({
  imports: [SplitsModule, StatsModule],
  providers: [KeeperService],
  exports: [KeeperService],
})
export class KeeperModule {}
