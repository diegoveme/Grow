/**
 * Build and deploy the Grow `yield_splitter` contract. The constructor runs in
 * the same transaction as the deploy, so the contract is never left
 * uninitialized.
 *
 * Usage:
 *   bun run scripts/deploy.ts                          # testnet
 *   SOROBAN_NETWORK=mainnet STELLAR_IDENTITY=grow-admin \
 *     USER_CAP_USDC=100 CONFIRM_MAINNET=yes bun run scripts/deploy.ts
 *
 * Env:
 *   SOROBAN_NETWORK   stellar CLI network name (default "testnet")
 *   STELLAR_IDENTITY  stellar CLI identity that deploys and becomes admin
 *                     (default "raiz" on testnet; required on mainnet)
 *   USDC_TOKEN_ID     USDC SAC id (defaults to Circle USDC for the network)
 *   USER_CAP_USDC     max savings held per recipient, in USDC (default 100)
 *   CONFIRM_MAINNET   must be "yes" to deploy to mainnet
 *
 * Requires the `stellar` CLI on PATH. On testnet the identity is created and
 * funded via friendbot if it doesn't exist yet. On mainnet it must already
 * exist and hold XLM for fees.
 */
import { $ } from 'bun';

const NETWORK = process.env.SOROBAN_NETWORK ?? 'testnet';
const IS_MAINNET = ['mainnet', 'pubnet', 'public'].includes(NETWORK.toLowerCase());

const USDC_BY_NETWORK = {
  testnet: 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU',
  mainnet: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
};

const IDENTITY = process.env.STELLAR_IDENTITY ?? (IS_MAINNET ? '' : 'raiz');
const USDC = process.env.USDC_TOKEN_ID ?? USDC_BY_NETWORK[IS_MAINNET ? 'mainnet' : 'testnet'];
const USER_CAP_USDC = process.env.USER_CAP_USDC ?? '100';
const WASM = 'target/wasm32v1-none/release/yield_splitter.wasm';

/** "100.5" USDC to 7-decimal base units, without floating point. */
function toBaseUnits(amount: string): bigint {
  if (!/^\d+(\.\d{1,7})?$/.test(amount)) {
    throw new Error(`USER_CAP_USDC must be a positive decimal, got "${amount}"`);
  }
  const [whole, frac = ''] = amount.split('.');
  return BigInt(whole!) * 10_000_000n + BigInt(frac.padEnd(7, '0'));
}

async function ensureIdentity() {
  const ids = await $`stellar keys ls`.text().catch(() => '');
  if (ids.split(/\s+/).includes(IDENTITY)) return;
  if (IS_MAINNET) {
    throw new Error(`Identity "${IDENTITY}" not found. Create or import it with the stellar CLI.`);
  }
  console.log(`› creating identity "${IDENTITY}" and funding via friendbot…`);
  await $`stellar keys generate ${IDENTITY} --network ${NETWORK} --fund`;
}

async function main() {
  if (IS_MAINNET) {
    if (!IDENTITY) throw new Error('Set STELLAR_IDENTITY to deploy to mainnet.');
    if (process.env.CONFIRM_MAINNET !== 'yes') {
      throw new Error('Mainnet deploy moves real funds. Re-run with CONFIRM_MAINNET=yes.');
    }
  }
  const userCap = toBaseUnits(USER_CAP_USDC);
  if (userCap <= 0n) throw new Error('USER_CAP_USDC must be greater than zero.');

  console.log(`🌱 Grow · deploying yield_splitter to ${NETWORK}`);
  await ensureIdentity();
  const admin = (await $`stellar keys address ${IDENTITY}`.text()).trim();
  console.log('› admin (deployer):', admin);
  console.log('› USDC token:', USDC);
  console.log(`› savings cap per recipient: ${USER_CAP_USDC} USDC (${userCap} base units)`);

  console.log('› building optimized wasm…');
  await $`stellar contract build`;

  console.log('› deploying + running the constructor…');
  const contractId = (
    await $`stellar contract deploy --wasm ${WASM} --source ${IDENTITY} --network ${NETWORK} -- --admin ${admin} --token ${USDC} --user_cap ${userCap.toString()}`.text()
  ).trim();
  console.log('✓ deployed:', contractId);

  console.log('\n✅ Done. Add this to the API env:');
  console.log(`YIELD_SPLITTER_CONTRACT_ID=${contractId}`);
}

main().catch((err) => {
  console.error('✗ deploy failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
