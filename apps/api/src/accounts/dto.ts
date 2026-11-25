import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { AMOUNT_REGEX, ASSET_CODES, STELLAR_ADDRESS_REGEX, type AssetCode } from '@raiz/shared';

export class PaymentBuildDto {
  @ApiProperty({ example: 'GSENDER...' })
  @Matches(STELLAR_ADDRESS_REGEX, { message: 'from must be a valid Stellar public key' })
  from!: string;

  @ApiProperty({ example: 'GRECIPIENT...' })
  @Matches(STELLAR_ADDRESS_REGEX, { message: 'to must be a valid Stellar public key' })
  to!: string;

  @ApiProperty({ example: 'USDC', enum: ASSET_CODES })
  @IsIn(ASSET_CODES)
  asset!: AssetCode;

  @ApiProperty({ example: '200.00', description: 'Amount in display units (max 7 decimals)' })
  @IsString()
  @Matches(AMOUNT_REGEX, { message: 'amount must be a decimal with up to 7 decimals' })
  amount!: string;

  @ApiProperty({ required: false, example: 'For groceries' })
  @IsOptional()
  @IsString()
  @Length(0, 28)
  /** Trimmed to 28 UTF-8 bytes (Stellar's text memo limit) when building. */
  memo?: string;
}

export class TrustlineBuildDto {
  @ApiProperty({ example: 'GACCOUNT...' })
  @Matches(STELLAR_ADDRESS_REGEX)
  account!: string;
}

export class SubmitClassicDto {
  @ApiProperty({ description: 'Signed transaction XDR (base64)' })
  @IsString()
  signedXdr!: string;
}
