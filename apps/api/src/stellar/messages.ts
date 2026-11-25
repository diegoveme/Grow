/** User-facing messages that depend on the active network. */

export function unfundedMessage(isTestnet: boolean): string {
  return isTestnet
    ? 'Your account is not funded yet. Use “Fund testnet XLM” first.'
    : 'Your account is not activated yet. Send it some XLM first.';
}
