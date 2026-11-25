import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { AMOUNT_REGEX, STELLAR_ADDRESS_REGEX } from '@raiz/shared';
import { StellarAddressPipe } from '../common/stellar-address.pipe';
import { VaultService } from './vault.service';

class BuildVaultTxDto {
  @Matches(STELLAR_ADDRESS_REGEX)
  caller!: string;

  @IsString()
  @Matches(AMOUNT_REGEX, { message: 'amount must be a decimal with up to 7 decimals' })
  amount!: string;
}

@ApiTags('vault')
@Controller('vault')
export class VaultController {
  constructor(private readonly vault: VaultService) {}

  @Get('apy')
  @ApiOperation({ summary: 'Current vault APY (DeFindex, falling back to Blend)' })
  apy() {
    return this.vault.getApy();
  }

  @Get('position/:address')
  @ApiOperation({ summary: 'Vault position for a recipient' })
  position(@Param('address', StellarAddressPipe) address: string) {
    return this.vault.getPosition(address);
  }

  @Post('deposit/build')
  @ApiOperation({ summary: 'Build an unsigned DeFindex deposit transaction' })
  async deposit(@Body() dto: BuildVaultTxDto) {
    return { xdr: await this.vault.buildDeposit(dto.amount, dto.caller) };
  }

  @Post('withdraw/build')
  @ApiOperation({ summary: 'Build an unsigned DeFindex withdraw transaction' })
  async withdraw(@Body() dto: BuildVaultTxDto) {
    return { xdr: await this.vault.buildWithdraw(dto.amount, dto.caller) };
  }
}
