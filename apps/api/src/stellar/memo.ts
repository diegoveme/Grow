/** Stellar text memos hold at most 28 bytes. */
export const MEMO_TEXT_MAX_BYTES = 28;

/**
 * Cut text to at most `maxBytes` of UTF-8 without splitting a character.
 * Accents and emoji take more than one byte each, so slicing by characters
 * can still overflow the memo limit.
 */
export function truncateUtf8(text: string, maxBytes = MEMO_TEXT_MAX_BYTES): string {
  let out = '';
  for (const ch of text) {
    if (Buffer.byteLength(out + ch, 'utf8') > maxBytes) break;
    out += ch;
  }
  return out;
}
