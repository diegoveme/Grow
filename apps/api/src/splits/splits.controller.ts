import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SplitsService } from './splits.service';
import { ReceiveDto, SetSplitDto, SubmitDto, WithdrawDto } from './dto';

@ApiTags('splits')
@Controller('splits')
export class SplitsController {
  constructor(private readonly splits: SplitsService) {}

  @Get(':address')
  @ApiOperation({ summary: 'On-chain position (balances + ratio) for an address' })
  position(@Param('address') address: string) {
    return this.splits.getPosition(address);
  }

  @Get(':address/ratio')
  @ApiOperation({ summary: 'Current spendable ratio (basis points)' })
  async ratio(@Param('address') address: string) {
    const spendableBps = await this.splits.getSplit(address);
    return { spendableBps, vaultBps: 10000 - spendableBps };
  }

  @Post('ratio/build')
  @ApiOperation({ summary: 'Build an unsigned set_split transaction' })
  async buildSetSplit(@Body() dto: SetSplitDto) {
    return { xdr: await this.splits.buildSetSplit(dto.user, dto.spendableBps) };
  }

  @Post('receive/build')
  @ApiOperation({ summary: 'Build an unsigned receive (split a remittance) transaction' })
  async buildReceive(@Body() dto: ReceiveDto) {
    return { xdr: await this.splits.buildReceive(dto.from, dto.to, dto.amount) };
  }

  @Post('deposit-vault/build')
  @ApiOperation({ summary: 'Build an unsigned deposit_vault transaction' })
  async buildDepositVault(@Body() dto: { to: string }) {
    return { xdr: await this.splits.buildDepositVault(dto.to) };
  }

  @Post('withdraw/build')
  @ApiOperation({ summary: 'Build an unsigned withdraw transaction' })
  async buildWithdraw(@Body() dto: WithdrawDto) {
    return { xdr: await this.splits.buildWithdraw(dto.to, dto.amount) };
  }

  @Post('submit')
  @ApiOperation({ summary: 'Submit a signed transaction to the network' })
  submit(@Body() dto: SubmitDto) {
    return this.splits.submit(dto.signedXdr);
  }
}
