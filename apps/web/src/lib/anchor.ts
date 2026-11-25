import { api } from "./api";
import { config } from "./config";

/** SEP-24 statuses after which polling stops without success. */
const FAILED_STATUSES = ["error", "refunded", "expired", "no_market", "too_small", "too_large"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Validate a SEP-10 challenge before the wallet signs it: never sign a server
 * transaction blindly. Asserts it is a real auth challenge: right network, the
 * anchor's signing key as source, sequence 0, and a `<home_domain> auth`
 * manage_data op whose source is this user. Throws if anything is off.
 */
export async function assertValidChallenge(
  xdr: string,
  networkPassphrase: string,
  account: string,
): Promise<void> {
  if (networkPassphrase !== config.networkPassphrase) {
    throw new Error("Anchor challenge is for the wrong network.");
  }
  const info = await api.anchorInfo();
  const { TransactionBuilder } = await import("@stellar/stellar-sdk");
  const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase) as {
    source: string;
    sequence: string;
    timeBounds?: unknown;
    operations: { type: string; source?: string; name?: string }[];
  };
  if (info.signingKey && tx.source !== info.signingKey) {
    throw new Error("Challenge is not from the anchor's signing key.");
  }
  if (tx.sequence !== "0") throw new Error("Challenge sequence must be 0.");
  if (!tx.timeBounds) throw new Error("Challenge has no time bounds.");
  const first = tx.operations[0];
  if (
    !first ||
    first.type !== "manageData" ||
    first.source !== account ||
    first.name !== `${info.homeDomain} auth`
  ) {
    throw new Error("Not a valid SEP-10 auth challenge.");
  }
}

/** SEP-10: fetch, validate and sign the challenge, then exchange it for a JWT. */
export async function authenticate(
  account: string,
  sign: (xdr: string) => Promise<string>,
): Promise<string> {
  const { transaction, networkPassphrase } = await api.anchorChallenge(account);
  await assertValidChallenge(transaction, networkPassphrase, account);
  const { token } = await api.anchorToken(await sign(transaction));
  return token;
}

/** SEP-24: start an interactive flow and return its (https-only) URL and id. */
export async function startInteractive(
  kind: "deposit" | "withdraw",
  token: string,
  account: string,
  asset: string,
): Promise<{ url: string; id: string }> {
  const { url, id } = await api.anchorInteractive(kind, token, account, asset);
  if (new URL(url).protocol !== "https:") throw new Error("Anchor returned a non-https URL.");
  return { url, id };
}

export type PollOutcome =
  | { kind: "completed"; hash: string | null }
  | { kind: "failed"; status: string }
  | { kind: "timeout" };

/**
 * Poll a SEP-24 transaction until it settles, reporting each status. Network
 * hiccups are retried; a completed transaction returns its on-chain hash if
 * the anchor reports one.
 */
export async function waitForAnchor(
  token: string,
  id: string,
  onStatus: (status: string) => void,
  { tries = 150, intervalMs = 2500 } = {},
): Promise<PollOutcome> {
  for (let i = 0; i < tries; i++) {
    await sleep(intervalMs);
    try {
      const { transaction } = await api.anchorTransaction(token, id);
      const status = String(transaction.status ?? "");
      onStatus(status);
      if (status === "completed") {
        const hash = transaction.stellar_transaction_id;
        const valid = typeof hash === "string" && /^[0-9a-f]{64}$/i.test(hash);
        return { kind: "completed", hash: valid ? hash : null };
      }
      if (FAILED_STATUSES.includes(status)) return { kind: "failed", status };
    } catch {
      /* keep polling */
    }
  }
  return { kind: "timeout" };
}
