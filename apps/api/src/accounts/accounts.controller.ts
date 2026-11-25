import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { StellarAddressPipe } from '../common/stellar-address.pipe';
import { PaymentBuildDto, SubmitClassicDto, TestUsdcDto, TrustlineBuildDto } from './dto';

/**
 * Real on-chain money layer: balances, history, classic XLM/USDC payments,
 * USDC trustlines and friendbot funding. Transactions are built unsigned here
 * and signed in the browser wallet, then submitted back through `/submit`.
 */
@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get(':address')
  @ApiOperation({ summary: 'Balances + funding + USDC trustline status' })
  info(@Param('address', StellarAddressPipe) address: string) {
    return this.accounts.getAccountInfo(address);
  }

  @Get(':address/payments')
  @ApiOperation({ summary: 'Recent on-chain payments for an address' })
  payments(@Param('address', StellarAddressPipe) address: string, @Query('limit') limit?: string) {
    const n = Number(limit);
    return this.accounts.getPayments(address, Number.isInteger(n) && n > 0 ? n : 25);
  }

  @Post(':address/fund')
  @ApiOperation({ summary: 'Fund a testnet account via friendbot' })
  async fund(@Param('address', StellarAddressPipe) address: string) {
    const funded = await this.accounts.fundTestnet(address);
    return { funded };
  }

  @Post('payment/build')
  @ApiOperation({ summary: 'Build an unsigned XLM/USDC payment transaction' })
  async buildPayment(@Body() dto: PaymentBuildDto) {
    return { xdr: await this.accounts.buildPayment(dto) };
  }

  @Post('trustline/build')
  @ApiOperation({ summary: 'Build an unsigned USDC trustline (changeTrust) transaction' })
  async buildTrustline(@Body() dto: TrustlineBuildDto) {
    return { xdr: await this.accounts.buildChangeTrust(dto.account) };
  }

  @Post('test-usdc/build')
  @ApiOperation({ summary: 'Testnet: build an XLM to USDC swap so the account can try Grow' })
  buildTestUsdc(@Body() dto: TestUsdcDto) {
    return this.accounts.buildTestUsdc(dto.account, dto.xlm);
  }

  @Post('submit')
  @ApiOperation({ summary: 'Submit a signed classic transaction via Horizon' })
  submit(@Body() dto: SubmitClassicDto) {
    return this.accounts.submit(dto.signedXdr);
  }
}
