import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Length, Max, Min, Matches } from 'class-validator';

const G_ADDRESS = /^G[A-Z2-7]{55}$/;

export class SetSplitDto {
  @ApiProperty({ example: 'GAB...', description: 'Recipient Stellar address' })
  @Matches(G_ADDRESS, { message: 'user must be a valid Stellar public key' })
  user!: string;

  @ApiProperty({ example: 7000, description: 'Spendable share in basis points (0–10000)' })
  @IsInt()
  @Min(0)
  @Max(10000)
  spendableBps!: number;
}

export class ReceiveDto {
  @ApiProperty({ example: 'GSENDER...' })
  @Matches(G_ADDRESS)
  from!: string;

  @ApiProperty({ example: 'GRECIPIENT...' })
  @Matches(G_ADDRESS)
  to!: string;

  @ApiProperty({ example: '200.00', description: 'USDC amount in display units' })
  @IsString()
  @Length(1, 32)
  amount!: string;
}

export class WithdrawDto {
  @ApiProperty({ example: 'GRECIPIENT...' })
  @Matches(G_ADDRESS)
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
