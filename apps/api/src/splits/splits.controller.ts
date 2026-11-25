import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BPS_DENOMINATOR } from '@raiz/shared';
import { SplitsService } from './splits.service';
import { DepositSavingsDto, ReceiveDto, SetSplitDto, SubmitDto, WithdrawDto } from './dto';
import { StellarAddressPipe } from '../common/stellar-address.pipe';

@ApiTags('splits')
@Controller('splits')
export class SplitsController {
  constructor(private readonly splits: SplitsService) {}

  // Declared before `:address` so "config" is not read as an address.
  @Get('config')
  @ApiOperation({ summary: 'Contract settings: admin, token, savings cap, paused' })
  config() {
    return this.splits.getConfig();
  }

  @Get(':address')
  @ApiOperation({ summary: 'On-chain position (savings + ratio) for an address' })
  position(@Param('address', StellarAddressPipe) address: string) {
    return this.splits.getPosition(address);
  }

  @Get(':address/ratio')
  @ApiOperation({ summary: 'Current spendable ratio (basis points)' })
  async ratio(@Param('address', StellarAddressPipe) address: string) {
    const spendableBps = await this.splits.getSplit(address);
    return { spendableBps, vaultBps: BPS_DENOMINATOR - spendableBps };
  }

  @Post('ratio/build')
  @ApiOperation({ summary: 'Build an unsigned set_split transaction' })
  async buildSetSplit(@Body() dto: SetSplitDto) {
    return { xdr: await this.splits.buildSetSplit(dto.user, dto.spendableBps) };
  }

  @Post('receive/build')
  @ApiOperation({ summary: 'Build an unsigned receive (send a split remittance) transaction' })
  async buildReceive(@Body() dto: ReceiveDto) {
    return { xdr: await this.splits.buildReceive(dto.from, dto.to, dto.amount) };
  }

  @Post('deposit/build')
  @ApiOperation({ summary: 'Build an unsigned deposit_savings (top up own savings) transaction' })
  async buildDeposit(@Body() dto: DepositSavingsDto) {
    return { xdr: await this.splits.buildDepositSavings(dto.user, dto.amount) };
  }

  @Post('withdraw/build')
  @ApiOperation({ summary: 'Build an unsigned withdraw_savings transaction' })
  async buildWithdraw(@Body() dto: WithdrawDto) {
    return { xdr: await this.splits.buildWithdrawSavings(dto.to, dto.amount) };
  }

  @Post('submit')
  @ApiOperation({ summary: 'Submit a signed Soroban transaction to the network' })
  submit(@Body() dto: SubmitDto) {
    return this.splits.submit(dto.signedXdr);
  }
}
