import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { AMOUNT_REGEX, BPS_DENOMINATOR, STELLAR_ADDRESS_REGEX } from '@raiz/shared';

export class CreateRemittanceDto {
  @ApiProperty({ example: 'GSENDER...' })
  @Matches(STELLAR_ADDRESS_REGEX)
  from!: string;

  @ApiProperty({ example: 'GRECIPIENT...' })
  @Matches(STELLAR_ADDRESS_REGEX)
  to!: string;

  @ApiProperty({ example: '200.00', description: 'Amount in USDC display units' })
  @IsString()
  @Matches(AMOUNT_REGEX, { message: 'amount must be a decimal with up to 7 decimals' })
  amount!: string;

  @ApiPropertyOptional({ example: 7000, description: 'Override the recipient split (bps)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(BPS_DENOMINATOR)
  spendableBps?: number;
}

export class PreviewDto {
  @ApiProperty({ example: '200.00' })
  @IsString()
  @Matches(AMOUNT_REGEX, { message: 'amount must be a decimal with up to 7 decimals' })
  amount!: string;

  @ApiPropertyOptional({ example: 7000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(BPS_DENOMINATOR)
  spendableBps?: number;
}
