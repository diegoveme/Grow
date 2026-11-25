import { MEMO_TEXT_MAX_BYTES, truncateUtf8 } from './memo';

describe('truncateUtf8', () => {
  it('keeps short ASCII memos untouched', () => {
    expect(truncateUtf8('SHIP-S97KF8')).toBe('SHIP-S97KF8');
  });

  it('cuts by bytes, not characters', () => {
    // 28 characters, but "ñ" and "á" take 2 bytes each in UTF-8.
    const memo = 'Para la mañana de mamá, gracias';
    const cut = truncateUtf8(memo);
    expect(Buffer.byteLength(cut, 'utf8')).toBeLessThanOrEqual(MEMO_TEXT_MAX_BYTES);
    expect(memo.startsWith(cut)).toBe(true);
  });

  it('never splits a multi-byte character', () => {
    const cut = truncateUtf8('🌱🌱🌱🌱🌱🌱🌱🌱', 10); // 4 bytes each
    expect(cut).toBe('🌱🌱');
  });
});
