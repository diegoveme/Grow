import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RemittancesService } from './remittances.service';
import { PreviewDto, RecordRemittanceDto } from './dto';
import { StellarAddressPipe } from '../common/stellar-address.pipe';

@ApiTags('remittances')
@Controller('remittances')
export class RemittancesController {
  constructor(private readonly remittances: RemittancesService) {}

  @Post('preview')
  @ApiOperation({ summary: 'Preview the spendable/savings split for an amount' })
  preview(@Body() dto: PreviewDto) {
    return this.remittances.preview(dto.amount, dto.spendableBps);
  }

  @Post()
  @ApiOperation({
    summary: 'Record a remittance from its on-chain receive() transaction hash',
  })
  record(@Body() dto: RecordRemittanceDto) {
    return this.remittances.record(dto.txHash);
  }

  @Get()
  @ApiOperation({ summary: 'Remittances sent or received by an address' })
  list(@Query('address', StellarAddressPipe) address: string) {
    return this.remittances.list(address);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a remittance by id' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.remittances.get(id);
  }
}
