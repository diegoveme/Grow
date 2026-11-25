import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StatsService } from './stats.service';

@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  @ApiOperation({ summary: 'Public usage of the yield_splitter contract (volume, people, savings)' })
  async get() {
    const stats = await this.stats.getStats();
    if (!stats) throw new ServiceUnavailableException('YIELD_SPLITTER_CONTRACT_ID is not configured.');
    return stats;
  }
}
