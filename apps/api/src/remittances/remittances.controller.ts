import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RemittanceStatus } from '@raiz/shared';
import { RemittancesService } from './remittances.service';
import { CreateRemittanceDto, PreviewDto } from './dto';

@ApiTags('remittances')
@Controller('remittances')
export class RemittancesController {
  constructor(private readonly remittances: RemittancesService) {}

  @Post('preview')
  @ApiOperation({ summary: 'Preview the spendable/vault split for an amount' })
  preview(@Body() dto: PreviewDto) {
    return this.remittances.preview(dto.amount, dto.spendableBps);
  }

  @Post()
  @ApiOperation({ summary: 'Record a new remittance' })
  create(@Body() dto: CreateRemittanceDto) {
    return this.remittances.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List remittances, optionally filtered by address' })
  list(@Query('address') address?: string) {
    return this.remittances.list(address);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a remittance by id' })
  get(@Param('id') id: string) {
    return this.remittances.get(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update a remittance status (and tx hash)' })
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: RemittanceStatus; txHash?: string },
  ) {
    return this.remittances.updateStatus(id, body.status, body.txHash);
  }
}
