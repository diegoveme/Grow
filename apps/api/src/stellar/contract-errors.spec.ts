import { describeFailure } from './contract-errors';

const ids = { splitter: 'CSPLITTER', token: 'CTOKEN' };

describe('describeFailure', () => {
  it('explains yield_splitter errors', () => {
    const msg = describeFailure([{ contract: 'CSPLITTER', code: 5 }], '', ids);
    expect(msg).toMatch(/savings cap/);
  });

  it('prefers the token error, which is the root cause of a failed transfer', () => {
    const msg = describeFailure(
      [
        { contract: 'CTOKEN', code: 10 },
        { contract: 'CSPLITTER', code: 3 },
      ],
      '',
      ids,
    );
    expect(msg).toBe('Not enough USDC in the sending wallet.');
  });

  it('does not confuse a token code with a splitter code', () => {
    // Token #6 is "account missing"; splitter #6 is "paused".
    const msg = describeFailure([{ contract: 'CTOKEN', code: 6 }], '', ids);
    expect(msg).not.toMatch(/paused/i);
  });

  it('falls back to the raw contract code when it has no events', () => {
    const msg = describeFailure([], 'HostError: Error(Contract, #42)\nEvent log...', ids);
    expect(msg).toBe('The contract rejected this transaction (error #42).');
  });
});
