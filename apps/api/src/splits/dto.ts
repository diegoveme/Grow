import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsInt,
  IsString,
  Max,
  Min,
  Matches,
  ValidateNested,
} from 'class-validator';
import { AMOUNT_REGEX, BPS_DENOMINATOR, STELLAR_ADDRESS_REGEX } from '@raiz/shared';

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
  @Matches(AMOUNT_REGEX, { message: 'amount must be a decimal with up to 7 decimals' })
  amount!: string;
}

export class WithdrawDto {
  @ApiProperty({ example: 'GRECIPIENT...' })
  @Matches(STELLAR_ADDRESS_REGEX)
  to!: string;

  @ApiProperty({ example: '100.00' })
  @IsString()
  @Matches(AMOUNT_REGEX, { message: 'amount must be a decimal with up to 7 decimals' })
  amount!: string;
}

export class DepositSavingsDto {
  @ApiProperty({ example: 'GRECIPIENT...', description: 'Recipient adding to their own savings' })
  @Matches(STELLAR_ADDRESS_REGEX)
  user!: string;

  @ApiProperty({ example: '25.00' })
  @IsString()
  @Matches(AMOUNT_REGEX, { message: 'amount must be a decimal with up to 7 decimals' })
  amount!: string;
}

export class PayFromSavingsDto {
  @ApiProperty({ example: 'GRECIPIENT...', description: 'Recipient paying out of their savings' })
  @Matches(STELLAR_ADDRESS_REGEX)
  user!: string;

  @ApiProperty({ example: 'GSCHOOL...', description: 'Who gets paid' })
  @Matches(STELLAR_ADDRESS_REGEX)
  to!: string;

  @ApiProperty({ example: '25.00' })
  @IsString()
  @Matches(AMOUNT_REGEX, { message: 'amount must be a decimal with up to 7 decimals' })
  amount!: string;
}

export class BatchPaymentDto {
  @ApiProperty({ example: 'GMOM...' })
  @Matches(STELLAR_ADDRESS_REGEX)
  to!: string;

  @ApiProperty({ example: '50.00' })
  @IsString()
  @Matches(AMOUNT_REGEX, { message: 'amount must be a decimal with up to 7 decimals' })
  amount!: string;
}

export class SendBatchDto {
  @ApiProperty({ example: 'GSENDER...' })
  @Matches(STELLAR_ADDRESS_REGEX)
  from!: string;

  @ApiProperty({ type: [BatchPaymentDto], description: '1 to 10 payments, each split by its recipient' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => BatchPaymentDto)
  payments!: BatchPaymentDto[];
}

export class ScheduleTermsDto {
  @ApiProperty({ example: 'GSENDER...' })
  @Matches(STELLAR_ADDRESS_REGEX)
  from!: string;

  @ApiProperty({ example: '50.00', description: 'USDC per run' })
  @IsString()
  @Matches(AMOUNT_REGEX, { message: 'amount must be a decimal with up to 7 decimals' })
  amount!: string;

  @ApiProperty({ example: 2592000, description: 'Seconds between runs (min 60)' })
  @IsInt()
  @Min(60)
  @Max(92 * 86_400)
  intervalSecs!: number;

  @ApiProperty({ example: 6, description: 'Number of runs (1 to 120)' })
  @IsInt()
  @Min(1)
  @Max(120)
  runs!: number;
}

export class CreateScheduleDto extends ScheduleTermsDto {
  @ApiProperty({ example: 'GMOM...' })
  @Matches(STELLAR_ADDRESS_REGEX)
  to!: string;
}

export class ScheduleCallerDto {
  @ApiProperty({ example: 'GANYONE...', description: 'Account that signs and pays the fee' })
  @Matches(STELLAR_ADDRESS_REGEX)
  caller!: string;
}

export class CreatePledgeDto {
  @ApiProperty({ example: 'GSENDER...' })
  @Matches(STELLAR_ADDRESS_REGEX)
  from!: string;

  @ApiProperty({ example: 'GMOM...', description: 'Who decides when to pay it' })
  @Matches(STELLAR_ADDRESS_REGEX)
  beneficiary!: string;

  @ApiProperty({ example: 'GSCHOOL...', description: 'Who gets paid' })
  @Matches(STELLAR_ADDRESS_REGEX)
  payee!: string;

  @ApiProperty({ example: '120.00' })
  @IsString()
  @Matches(AMOUNT_REGEX, { message: 'amount must be a decimal with up to 7 decimals' })
  amount!: string;

  @ApiProperty({ example: '2026-12-31T23:59:59Z', description: 'Release allowed until this time' })
  @IsISO8601()
  expiresAt!: string;
}

export class SubmitDto {
  @ApiProperty({ description: 'Signed transaction XDR (base64)' })
  @IsString()
  signedXdr!: string;
}
