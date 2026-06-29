import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { STELLAR_ADDRESS_REGEX } from '@raiz/shared';
import { AnchorService } from './anchor.service';

class ChallengeDto {
  @Matches(STELLAR_ADDRESS_REGEX)
  account!: string;
}

class TokenDto {
  @IsString()
  signedXdr!: string;
}

class InteractiveDto {
  @Matches(STELLAR_ADDRESS_REGEX)
  account!: string;

  @IsOptional()
  @IsString()
  assetCode?: string;
}

@ApiTags('anchor')
@Controller('anchor')
export class AnchorController {
  constructor(private readonly anchor: AnchorService) {}

  @Get('info')
  @ApiOperation({ summary: 'Anchor endpoints, signing key and supported currencies' })
  info() {
    return this.anchor.info();
  }

  @Post('sep10/challenge')
  @ApiOperation({ summary: 'SEP-10: get the challenge transaction to sign' })
  challenge(@Body() dto: ChallengeDto) {
    return this.anchor.challenge(dto.account);
  }

  @Post('sep10/token')
  @ApiOperation({ summary: 'SEP-10: exchange the signed challenge for a JWT' })
  token(@Body() dto: TokenDto) {
    return this.anchor.token(dto.signedXdr);
  }

  @Post('sep24/deposit')
  @ApiOperation({ summary: 'SEP-24: start an interactive deposit' })
  async deposit(@Headers('authorization') auth: string, @Body() dto: InteractiveDto) {
    const info = await this.anchor.info();
    return this.anchor.deposit(bearer(auth), dto.assetCode ?? info.testAsset, dto.account);
  }

  @Post('sep24/withdraw')
  @ApiOperation({ summary: 'SEP-24: start an interactive withdrawal' })
  async withdraw(@Headers('authorization') auth: string, @Body() dto: InteractiveDto) {
    const info = await this.anchor.info();
    return this.anchor.withdraw(bearer(auth), dto.assetCode ?? info.testAsset, dto.account);
  }

  @Get('sep24/transaction')
  @ApiOperation({ summary: 'SEP-24: poll a transaction status by id' })
  transaction(@Headers('authorization') auth: string, @Query('id') id: string) {
    return this.anchor.transaction(bearer(auth), id);
  }
}

function bearer(authHeader?: string): string {
  return (authHeader ?? '').replace(/^Bearer\s+/i, '');
}
