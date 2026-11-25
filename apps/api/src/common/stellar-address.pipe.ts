import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isStellarAddress } from '@raiz/shared';

/** Rejects route/query params that aren't a Stellar public key (G...). */
@Injectable()
export class StellarAddressPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !isStellarAddress(value)) {
      throw new BadRequestException('Expected a valid Stellar public key (G...).');
    }
    return value;
  }
}
