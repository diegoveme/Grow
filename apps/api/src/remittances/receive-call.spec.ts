import {
  Account,
  Asset,
  Contract,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  scValToNative,
} from '@stellar/stellar-sdk';
import { addressArg, i128 } from '../stellar/scval';
import { invokedContract } from './receive-call';

const sender = Keypair.random().publicKey();
const recipient = Keypair.random().publicKey();
const splitter = 'CAWZOG7IXDOBSCSPNMFVA7CUHA2UDW7I7F4WLHMELTNDG62CJDLAIWVW';

function envelopeWith(op: ReturnType<Contract['call']>) {
  return new TransactionBuilder(new Account(sender, '1'), {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(op)
    .setTimeout(30)
    .build()
    .toEnvelope();
}

describe('invokedContract', () => {
  it('decodes a receive() call', () => {
    const op = new Contract(splitter).call(
      'receive',
      addressArg(sender),
      addressArg(recipient),
      i128(1_000_000_000n),
    );
    const call = invokedContract(envelopeWith(op));
    expect(call?.contract).toBe(splitter);
    expect(call?.fn).toBe('receive');
    expect(call?.args.map((a) => scValToNative(a))).toEqual([sender, recipient, 1_000_000_000n]);
  });

  it('returns undefined for a classic operation', () => {
    const op = Operation.payment({ destination: recipient, asset: Asset.native(), amount: '1' });
    expect(invokedContract(envelopeWith(op as never))).toBeUndefined();
  });
});
