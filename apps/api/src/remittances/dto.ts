import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

const G_ADDRESS = /^G[A-Z2-7]{55}$/;

export class CreateRemittanceDto {
  @ApiProperty({ example: 'GSENDER...' })
  @Matches(G_ADDRESS)
  from!: string;

  @ApiProperty({ example: 'GRECIPIENT...' })
  @Matches(G_ADDRESS)
  to!: string;

  @ApiProperty({ example: '200.00', description: 'Amount in USDC display units' })
  @IsString()
  @Length(1, 32)
  amount!: string;

  @ApiPropertyOptional({ example: 7000, description: 'Override the recipient split (bps)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  spendableBps?: number;
}

export class PreviewDto {
  @ApiProperty({ example: '200.00' })
  @IsString()
  @Length(1, 32)
  amount!: string;

  @ApiPropertyOptional({ example: 7000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  spendableBps?: number;
}
