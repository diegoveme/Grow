import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StellarService } from '../stellar/stellar.service';
import { PaymentBuildDto, SubmitClassicDto, TrustlineBuildDto } from './dto';

/**
 * Real on-chain money layer: balances, history, classic XLM/USDC payments,
 * USDC trustlines and friendbot funding. Transactions are built unsigned here
 * and signed in the browser wallet, then submitted back through `/submit`.
 */
@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly stellar: StellarService) {}

  @Get(':address')
  @ApiOperation({ summary: 'Balances + funding + USDC trustline status' })
  info(@Param('address') address: string) {
    return this.stellar.getAccountInfo(address);
  }

  @Get(':address/payments')
  @ApiOperation({ summary: 'Recent on-chain payments for an address' })
  payments(@Param('address') address: string, @Query('limit') limit?: string) {
    return this.stellar.getPayments(address, limit ? Number(limit) : 25);
  }

  @Post(':address/fund')
  @ApiOperation({ summary: 'Fund a testnet account via friendbot' })
  async fund(@Param('address') address: string) {
    const funded = await this.stellar.fundTestnet(address);
    return { funded };
  }

  @Post('payment/build')
  @ApiOperation({ summary: 'Build an unsigned XLM/USDC payment transaction' })
  async buildPayment(@Body() dto: PaymentBuildDto) {
    return { xdr: await this.stellar.buildPayment(dto) };
  }

  @Post('trustline/build')
  @ApiOperation({ summary: 'Build an unsigned USDC trustline (changeTrust) transaction' })
  async buildTrustline(@Body() dto: TrustlineBuildDto) {
    return { xdr: await this.stellar.buildChangeTrust(dto.account) };
  }

  @Post('submit')
  @ApiOperation({ summary: 'Submit a signed classic transaction via Horizon' })
  submit(@Body() dto: SubmitClassicDto) {
    return this.stellar.submitClassic(dto.signedXdr);
  }
}
