import { sharesForAmount, withSlippage } from './vault-math';

const ONE = 10_000_000n;

describe('vault math', () => {
  it('takes 1% off for the minimum accepted', () => {
    expect(withSlippage(1_000_000_000n, 100n)).toBe(990_000_000n);
  });

  it('converts a USDC amount to shares at the current price, rounding up', () => {
    // 1 share = 1.0005146 USDC (the testnet vault's real price).
    const price = 10_005_146n;
    const shares = sharesForAmount(100n * ONE, price, ONE, 1_000n * ONE);
    expect((shares * price) / ONE).toBeGreaterThanOrEqual(100n * ONE);
    expect(((shares - 1n) * price) / ONE).toBeLessThan(100n * ONE);
  });

  it('burns everything when the request is about the whole position', () => {
    const held = 50n * ONE;
    expect(sharesForAmount(50n * ONE, ONE, ONE, held)).toBe(held);
    expect(sharesForAmount(60n * ONE, ONE, ONE, held)).toBe(held);
  });

  it('rejects nonsense input', () => {
    expect(() => sharesForAmount(0n, ONE, ONE, ONE)).toThrow();
    expect(() => sharesForAmount(ONE, 0n, ONE, ONE)).toThrow();
  });
});
