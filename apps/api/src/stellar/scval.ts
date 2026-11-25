import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk';

/** Contract-call argument builders (JS value to ScVal). */

/** A Stellar address (G... or C...) as an ScVal argument. */
export function addressArg(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

/** A bigint-like amount as an i128 ScVal. */
export function i128(value: bigint | number | string): xdr.ScVal {
  return nativeToScVal(BigInt(value), { type: 'i128' });
}

/** A number as a u32 ScVal. */
export function u32(value: number): xdr.ScVal {
  return nativeToScVal(value, { type: 'u32' });
}
