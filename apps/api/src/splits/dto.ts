import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Length, Max, Min, Matches } from 'class-validator';
import { BPS_DENOMINATOR, STELLAR_ADDRESS_REGEX } from '@raiz/shared';

export class SetSplitDto {
  @ApiProperty({ example: 'GAB...', description: 'Recipient Stellar address' })
  @Matches(STELLAR_ADDRESS_REGEX, { message: 'user must be a valid Stellar public key' })
  user!: string;

  @ApiProperty({ example: 7000, description: 'Spendable share in basis points (0–10000)' })
  @IsInt()
  @Min(0)
  @Max(BPS_DENOMINATOR)
  spendableBps!: number;
}

export class ReceiveDto {
  @ApiProperty({ example: 'GSENDER...' })
  @Matches(STELLAR_ADDRESS_REGEX)
  from!: string;

  @ApiProperty({ example: 'GRECIPIENT...' })
  @Matches(STELLAR_ADDRESS_REGEX)
  to!: string;

  @ApiProperty({ example: '200.00', description: 'USDC amount in display units' })
  @IsString()
  @Length(1, 32)
  amount!: string;
}

export class WithdrawDto {
  @ApiProperty({ example: 'GRECIPIENT...' })
  @Matches(STELLAR_ADDRESS_REGEX)
  to!: string;

  @ApiProperty({ example: '100.00' })
  @IsString()
  @Length(1, 32)
  amount!: string;
}

export class SubmitDto {
  @ApiProperty({ description: 'Signed transaction XDR (base64)' })
  @IsString()
  signedXdr!: string;
}
