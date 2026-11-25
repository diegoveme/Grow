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

/** A number or bigint as a u64 ScVal. */
export function u64(value: number | bigint): xdr.ScVal {
  return nativeToScVal(BigInt(value), { type: 'u64' });
}

/**
 * A #[contracttype] struct as an ScVal map. Soroban requires map keys in
 * sorted order, so fields are sorted by name here.
 */
export function struct(fields: Record<string, xdr.ScVal>): xdr.ScVal {
  return xdr.ScVal.scvMap(
    Object.keys(fields)
      .sort()
      .map(
        (key) =>
          new xdr.ScMapEntry({ key: nativeToScVal(key, { type: 'symbol' }), val: fields[key]! }),
      ),
  );
}

/** A list of ScVals as an ScVal vec. */
export function vec(items: xdr.ScVal[]): xdr.ScVal {
  return xdr.ScVal.scvVec(items);
}
