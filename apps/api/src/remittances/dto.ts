import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { AMOUNT_REGEX, BPS_DENOMINATOR } from '@raiz/shared';

export class RecordRemittanceDto {
  @ApiProperty({
    example: 'd586bd597a768ce10dbe7d2ef1e8073b4cd523b10c7dbbcbb8dfddb7b7ee6395',
    description: 'Hash of the successful yield_splitter receive() transaction',
  })
  @Matches(/^[0-9a-fA-F]{64}$/, { message: 'txHash must be a 64-character hex hash' })
  txHash!: string;
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
