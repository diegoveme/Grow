import { Address, xdr } from '@stellar/stellar-sdk';

/** `yield_splitter` error codes (packages/contracts/.../src/lib.rs `Error`). */
const SPLITTER_ERRORS: Record<number, string> = {
  1: 'The Grow contract is not initialized.',
  2: 'The split must be between 0% and 100%.',
  3: 'The amount must be greater than zero.',
  4: "You don't have that much in savings.",
  5: 'This would put the recipient over the beta savings cap.',
  6: 'New deposits are paused right now. Withdrawals still work.',
  7: 'The savings cap must be greater than zero.',
  8: 'That recurring remittance does not exist (it may have finished or been cancelled).',
  9: 'That recurring remittance is not due yet.',
  10: 'Recurring remittances need a positive amount, an interval of at least a minute and 1 to 120 runs.',
  11: 'A batch needs between 1 and 10 payments.',
};

/** Stellar Asset Contract (USDC) error codes worth explaining to a user. */
const TOKEN_ERRORS: Record<number, string> = {
  6: "The recipient account doesn't exist on the network yet.",
  10: 'Not enough USDC in the sending wallet.',
  11: 'This USDC balance is frozen by the issuer.',
  // The token reports the same code for the sender and the recipient.
  13: "One of the accounts hasn't added USDC yet (missing trustline).",
};

export interface ContractFailure {
  contract?: string;
  code: number;
}

/**
 * Pull the contract errors out of a simulation's diagnostic events. A failing
 * token transfer shows up both on the token (root cause) and on the caller,
 * so all of them are returned, innermost first.
 */
export function contractFailures(events: xdr.DiagnosticEvent[] | undefined): ContractFailure[] {
  const failures: ContractFailure[] = [];
  for (const diagnostic of events ?? []) {
    try {
      const event = diagnostic.event();
      const topics = event.body().v0().topics();
      const [kind, value] = topics;
      if (!kind || !value) continue;
      if (kind.switch() !== xdr.ScValType.scvSymbol() || kind.sym().toString() !== 'error') {
        continue;
      }
      if (value.switch() !== xdr.ScValType.scvError()) continue;
      const error = value.error();
      if (error.switch() !== xdr.ScErrorType.sceContract()) continue;
      const id = event.contractId();
      failures.push({
        contract: id ? Address.contract(id as unknown as Buffer).toString() : undefined,
        code: error.contractCode(),
      });
    } catch {
      /* not a contract error event */
    }
  }
  return failures;
}

/**
 * Turn a failed simulation into a message a user can act on. Token errors win
 * over the splitter's, since they are the root cause of a failed transfer.
 */
export function describeFailure(
  failures: ContractFailure[],
  rawError: string,
  ids: { splitter?: string; token?: string },
): string {
  const tokenFailure = failures.find((f) => f.contract && f.contract === ids.token);
  if (tokenFailure && TOKEN_ERRORS[tokenFailure.code]) return TOKEN_ERRORS[tokenFailure.code]!;

  const splitterFailure = failures.find((f) => f.contract && f.contract === ids.splitter);
  if (splitterFailure && SPLITTER_ERRORS[splitterFailure.code]) {
    return SPLITTER_ERRORS[splitterFailure.code]!;
  }

  const code = /Error\(Contract, #(\d+)\)/.exec(rawError)?.[1];
  if (code) return `The contract rejected this transaction (error #${code}).`;
  return `The network rejected this transaction: ${rawError.split('\n')[0]?.slice(0, 160)}`;
}
