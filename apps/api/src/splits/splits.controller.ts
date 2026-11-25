import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BPS_DENOMINATOR } from '@raiz/shared';
import { SplitsService } from './splits.service';
import {
  CreateScheduleDto,
  DepositSavingsDto,
  ScheduleCallerDto,
  ScheduleTermsDto,
  SendBatchDto,
  PayFromSavingsDto,
  ReceiveDto,
  SetSplitDto,
  SubmitDto,
  WithdrawDto,
} from './dto';
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

  @Post('batch/build')
  @ApiOperation({ summary: 'Build an unsigned send_batch: several recipients, one signature' })
  async buildBatch(@Body() dto: SendBatchDto) {
    return { xdr: await this.splits.buildSendBatch(dto.from, dto.payments) };
  }

  @Post('schedules/approve/build')
  @ApiOperation({ summary: 'Build the token approve() a recurring remittance needs (amount x runs)' })
  async buildScheduleAllowance(@Body() dto: ScheduleTermsDto) {
    const xdr = await this.splits.buildScheduleAllowance(
      dto.from,
      dto.amount,
      dto.runs,
      dto.intervalSecs,
    );
    return { xdr };
  }

  @Post('schedules/build')
  @ApiOperation({ summary: 'Build an unsigned create_schedule (recurring remittance)' })
  async buildCreateSchedule(@Body() dto: CreateScheduleDto) {
    const xdr = await this.splits.buildCreateSchedule(
      dto.from,
      dto.to,
      dto.amount,
      dto.intervalSecs,
      dto.runs,
    );
    return { xdr };
  }

  @Get('schedules/:id')
  @ApiOperation({ summary: 'A recurring remittance by id' })
  async schedule(@Param('id', ParseIntPipe) id: number) {
    const schedule = await this.splits.getSchedule(id);
    if (!schedule) throw new NotFoundException(`Schedule ${id} not found or finished.`);
    return schedule;
  }

  @Post('schedules/:id/run/build')
  @ApiOperation({ summary: 'Build an unsigned run_schedule for a due recurring remittance' })
  async buildRunSchedule(@Param('id', ParseIntPipe) id: number, @Body() dto: ScheduleCallerDto) {
    return { xdr: await this.splits.buildRunSchedule(dto.caller, id) };
  }

  @Post('schedules/:id/cancel/build')
  @ApiOperation({ summary: 'Build an unsigned cancel_schedule (sender only)' })
  async buildCancelSchedule(@Param('id', ParseIntPipe) id: number, @Body() dto: ScheduleCallerDto) {
    return { xdr: await this.splits.buildCancelSchedule(dto.caller, id) };
  }

  @Post('deposit/build')
  @ApiOperation({ summary: 'Build an unsigned deposit_savings (top up own savings) transaction' })
  async buildDeposit(@Body() dto: DepositSavingsDto) {
    return { xdr: await this.splits.buildDepositSavings(dto.user, dto.amount) };
  }

  @Post('pay/build')
  @ApiOperation({ summary: 'Build an unsigned pay_from_savings (pay a third party) transaction' })
  async buildPay(@Body() dto: PayFromSavingsDto) {
    return { xdr: await this.splits.buildPayFromSavings(dto.user, dto.to, dto.amount) };
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
