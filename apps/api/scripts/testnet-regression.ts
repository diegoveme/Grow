/**
 * End-to-end regression against a deployed Grow API on TESTNET.
 *
 * Reads every public endpoint, builds every transaction type, then signs and
 * submits the real flows the app uses (split, remittance, savings, batch,
 * earmarked payment, recurring remittance run by the keeper, vault) with a
 * few test USDC. Refuses to run unless the API reports TESTNET.
 *
 *   API_URL=https://<api-host> bun scripts/testnet-regression.ts
 *
 * Signers are local `stellar keys` identities, read at runtime and never
 * printed: REG_SENDER (needs USDC), REG_RECIPIENT (needs a USDC trustline),
 * REG_PAYEE (any funded account; a trustline is added if missing).
 */
import { execFileSync } from 'node:child_process';
import { Keypair, Networks, TransactionBuilder } from '@stellar/stellar-sdk';

const API = `${(process.env.API_URL ?? 'http://localhost:3001').replace(/\/+$/, '')}/api`;
const SENDER = process.env.REG_SENDER ?? 'grow-vault-tester';
const RECIPIENT = process.env.REG_RECIPIENT ?? 'grow-smoke-recipient';
const PAYEE = process.env.REG_PAYEE ?? 'grow-smoke-sender';
const KEEPER_WAIT_SECS = Number(process.env.REG_KEEPER_WAIT_SECS ?? 240);

interface Row {
  step: string;
  ok: boolean;
  detail: string;
}
interface Account {
  exists: boolean;
  usdc: string | null;
  usdcTrustline: boolean;
}
interface Position {
  savings: string;
}
interface Submitted {
  hash: string;
  status: string;
}
interface Listed {
  id: number;
}
interface ScheduleView extends Listed {
  runsLeft: number;
}

const rows: Row[] = [];
const short = (hash: string) => `${hash.slice(0, 10)}…`;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function keypair(identity: string): Keypair {
  const secret = execFileSync('stellar', ['keys', 'show', identity], { encoding: 'utf8' }).trim();
  return Keypair.fromSecret(secret);
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 180)}`);
  return (text ? JSON.parse(text) : null) as T;
}
const get = <T>(path: string) => call<T>('GET', path);
const post = <T>(path: string, body: unknown) => call<T>('POST', path, body);

async function step(name: string, fn: () => Promise<string>): Promise<void> {
  try {
    rows.push({ step: name, ok: true, detail: await fn() });
  } catch (err) {
    rows.push({ step: name, ok: false, detail: err instanceof Error ? err.message : String(err) });
  }
}

/** Build with the API, sign locally, submit through the API. */
async function sendTx(
  kind: 'soroban' | 'classic',
  build: () => Promise<{ xdr: string }>,
  signer: Keypair,
): Promise<string> {
  const { xdr } = await build();
  const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
  tx.sign(signer);
  const path = kind === 'soroban' ? '/splits/submit' : '/accounts/submit';
  const res = await post<Submitted>(path, { signedXdr: tx.toXDR() });
  if (res.status !== 'SUCCESS') throw new Error(`status ${res.status} (${res.hash})`);
  return res.hash;
}

const savings = async (address: string) =>
  Number((await get<Position>(`/splits/${address}`)).savings);
const usdc = async (address: string) => Number((await get<Account>(`/accounts/${address}`)).usdc ?? 0);
const newest = <T extends Listed>(items: T[]) => items.reduce((a, b) => (b.id > a.id ? b : a));

async function main(): Promise<void> {
  const health = await get<{ network: string; keeper?: { enabled: boolean } }>('/health');
  if (health.network !== 'TESTNET') {
    throw new Error(`API reports ${health.network}; this script only runs on TESTNET.`);
  }
  const a = keypair(SENDER);
  const b = keypair(RECIPIENT);
  const c = keypair(PAYEE);
  const [A, B, C] = [a.publicKey(), b.publicKey(), c.publicKey()];
  console.log(`API ${API}\nsender ${A}\nrecipient ${B}\npayee ${C}\n`);

  // ── Reads ────────────────────────────────────────────────────────────
  await step('health', async () => `TESTNET, keeper ${health.keeper?.enabled ? 'on' : 'off'}`);
  await step('splits/config', async () => JSON.stringify(await get('/splits/config')));
  await step('stats', async () => {
    const s = await get<{ remittances: number; volume: string }>('/stats');
    return `${s.remittances} remittances, ${s.volume} USDC`;
  });
  await step('vault/apy', async () => JSON.stringify(await get('/vault/apy')));
  await step('accounts/:id', async () => `sender USDC ${await usdc(A)}`);
  await step('accounts/:id/payments', async () => `${(await get<unknown[]>(`/accounts/${A}/payments?limit=5`)).length} rows`);
  await step('splits/:id + ratio', async () => {
    const r = await get<{ spendableBps: number }>(`/splits/${B}/ratio`);
    return `recipient savings ${await savings(B)}, spendable ${r.spendableBps} bps`;
  });
  await step('schedules + pledges lists', async () => {
    const s = await get<unknown[]>(`/splits/schedules?address=${A}`);
    const p = await get<unknown[]>(`/splits/pledges?address=${B}`);
    return `${s.length} schedules, ${p.length} pledges`;
  });
  await step('anchor/info', async () => JSON.stringify(await get('/anchor/info')).slice(0, 80));
  await step('remittances/preview', async () => JSON.stringify(await post('/remittances/preview', { amount: '10' })));
  await step('vault/position/:id', async () => JSON.stringify(await get(`/vault/position/${A}`)).slice(0, 100));

  // ── Builds only (not submitted) ──────────────────────────────────────
  const built = async (path: string, body: unknown) => {
    const { xdr } = await post<{ xdr: string }>(path, body);
    return `xdr ${xdr.length} chars`;
  };
  await step('build payment (XLM + memo)', () =>
    built('/accounts/payment/build', { from: A, to: B, asset: 'XLM', amount: '1', memo: 'regression' }),
  );
  await step('build test USDC swap', () => built('/accounts/test-usdc/build', { account: A, xlm: '5' }));
  await step('build vault withdraw', () => built('/vault/withdraw/build', { caller: A, amount: '0.01' }));
  await step('unknown schedule gives a readable 4xx', async () => {
    try {
      await post('/splits/schedules/999999/cancel/build', { caller: A });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/^4\d\d /.test(msg)) return msg.slice(0, 90);
      throw err;
    }
    throw new Error('expected a 4xx');
  });

  // ── Real flows ───────────────────────────────────────────────────────
  await step('payee USDC trustline', async () => {
    if ((await get<Account>(`/accounts/${C}`)).usdcTrustline) return 'already there';
    return short(await sendTx('classic', () => post('/accounts/trustline/build', { account: C }), c));
  });
  await step('set split 70/30 (recipient)', async () =>
    short(await sendTx('soroban', () => post('/splits/ratio/build', { user: B, spendableBps: 7000 }), b)),
  );
  await step('remittance 1 USDC, split on-chain', async () => {
    const before = await savings(B);
    const hash = await sendTx('soroban', () => post('/splits/receive/build', { from: A, to: B, amount: '1' }), a);
    const gained = Number(((await savings(B)) - before).toFixed(7));
    if (gained !== 0.3) throw new Error(`savings grew ${gained}, expected 0.3 (${hash})`);
    return `${short(hash)} savings +0.3`;
  });
  await step('withdraw 0.1 savings', async () =>
    short(await sendTx('soroban', () => post('/splits/withdraw/build', { to: B, amount: '0.1' }), b)),
  );
  await step('deposit 0.05 into savings', async () =>
    short(await sendTx('soroban', () => post('/splits/deposit/build', { user: B, amount: '0.05' }), b)),
  );
  await step('pay 0.05 from savings', async () =>
    short(await sendTx('soroban', () => post('/splits/pay/build', { user: B, to: C, amount: '0.05' }), b)),
  );
  await step('batch to 2 people', async () =>
    short(
      await sendTx(
        'soroban',
        () => post('/splits/batch/build', { from: A, payments: [{ to: B, amount: '0.1' }, { to: C, amount: '0.1' }] }),
        a,
      ),
    ),
  );
  await step('earmark 0.5 and release to payee', async () => {
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
    await sendTx('soroban', () => post('/splits/pledges/build', { from: A, beneficiary: B, payee: C, amount: '0.5', expiresAt }), a);
    const pledge = newest(await get<Listed[]>(`/splits/pledges?address=${B}`));
    const before = await usdc(C);
    const hash = await sendTx('soroban', () => post(`/splits/pledges/${pledge.id}/release/build`, { caller: B }), b);
    const gained = Number(((await usdc(C)) - before).toFixed(7));
    if (gained !== 0.5) throw new Error(`payee got ${gained}, expected 0.5 (${hash})`);
    return `pledge #${pledge.id} ${short(hash)} payee +0.5`;
  });
  await step('vault deposit 0.5', async () =>
    short(await sendTx('soroban', () => post('/vault/deposit/build', { caller: A, amount: '0.5' }), a)),
  );

  // Recurring: approve + create, then the keeper on the server runs both payments.
  await step('recurring 2 x 0.1, run by the keeper', async () => {
    if (!health.keeper?.enabled) throw new Error('keeper is off on this API');
    const plan = { from: A, amount: '0.1', intervalSecs: 60, runs: 2 };
    await sendTx('soroban', () => post('/splits/schedules/approve/build', plan), a);
    await sendTx('soroban', () => post('/splits/schedules/build', { ...plan, to: B }), a);
    const created = newest(await get<ScheduleView[]>(`/splits/schedules?address=${A}`));
    const started = Date.now();
    while (Date.now() - started < KEEPER_WAIT_SECS * 1000) {
      await pause(15_000);
      const open = await get<ScheduleView[]>(`/splits/schedules?address=${A}`);
      const mine = open.find((s) => s.id === created.id);
      if (!mine || mine.runsLeft === 0) {
        return `schedule #${created.id} done in ${Math.round((Date.now() - started) / 1000)} s`;
      }
    }
    throw new Error(`schedule #${created.id} still open after ${KEEPER_WAIT_SECS} s`);
  });

  await step('stats moved', async () => {
    const s = await get<{ remittances: number }>('/stats');
    return `${s.remittances} remittances now`;
  });
}

main()
  .catch((err) => rows.push({ step: 'setup', ok: false, detail: String(err) }))
  .finally(() => {
    for (const r of rows) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.step.padEnd(40)} ${r.detail}`);
    const failed = rows.filter((r) => !r.ok).length;
    console.log(`\n${rows.length - failed}/${rows.length} passed`);
    process.exitCode = failed ? 1 : 0;
  });
