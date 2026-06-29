/**
 * Deploy + initialize the Raíz `yield_splitter` contract on Stellar testnet.
 *
 * Usage:
 *   bun run scripts/deploy.ts
 *
 * Env (with sensible testnet defaults):
 *   STELLAR_IDENTITY        stellar CLI identity to deploy with (default "raiz")
 *   USDC_TOKEN_ID           USDC token contract id (default testnet USDC)
 *   SOROBAN_NETWORK         network passphrase alias (default "testnet")
 *
 * Requires the `stellar` CLI on PATH. The identity is created and funded via
 * friendbot if it doesn't exist yet.
 */
import { $ } from 'bun';

const NETWORK = process.env.SOROBAN_NETWORK ?? 'testnet';
const IDENTITY = process.env.STELLAR_IDENTITY ?? 'raiz';
const USDC =
  process.env.USDC_TOKEN_ID ?? 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU';
const WASM = 'target/wasm32v1-none/release/yield_splitter.wasm';

async function ensureIdentity() {
  const ids = await $`stellar keys ls`.text().catch(() => '');
  if (!ids.split(/\s+/).includes(IDENTITY)) {
    console.log(`› creating identity "${IDENTITY}" and funding via friendbot…`);
    await $`stellar keys generate --global ${IDENTITY} --network ${NETWORK} --fund`;
  }
}

async function main() {
  console.log('🌱 Raíz · deploying yield_splitter to', NETWORK);

  await ensureIdentity();
  const admin = (await $`stellar keys address ${IDENTITY}`.text()).trim();
  console.log('› admin (deployer):', admin);

  console.log('› building contract…');
  await $`stellar contract build`;

  console.log('› optimizing wasm…');
  await $`stellar contract optimize --wasm ${WASM}`.quiet().catch(() => {});

  console.log('› deploying…');
  const contractId = (
    await $`stellar contract deploy --wasm ${WASM} --source ${IDENTITY} --network ${NETWORK}`.text()
  ).trim();
  console.log('✓ deployed:', contractId);

  console.log('› initializing (admin + USDC token)…');
  await $`stellar contract invoke --id ${contractId} --source ${IDENTITY} --network ${NETWORK} -- initialize --admin ${admin} --token ${USDC}`;

  console.log('\n✅ Done. Add this to your .env:');
  console.log(`YIELD_SPLITTER_CONTRACT_ID=${contractId}`);
}

main().catch((err) => {
  console.error('✗ deploy failed:', err);
  process.exit(1);
});
