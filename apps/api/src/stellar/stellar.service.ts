import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Account,
  Address,
  Contract,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';
import type { AppConfig } from '../config/configuration';

/** A throwaway account used only to assemble read-only simulations. */
const SIMULATION_SOURCE = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private readonly rpcServer: rpc.Server;
  readonly networkPassphrase: string;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const rpcUrl = this.config.get('sorobanRpcUrl', { infer: true });
    this.networkPassphrase = this.config.get('networkPassphrase', { infer: true });
    this.rpcServer = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  }

  get server(): rpc.Server {
    return this.rpcServer;
  }

  /** Convert a Stellar address string into an ScVal address argument. */
  addressArg(address: string): xdr.ScVal {
    return new Address(address).toScVal();
  }

  /** Convert a JS value (e.g. bigint amount) into an ScVal of the given type. */
  i128(value: bigint | number | string): xdr.ScVal {
    return nativeToScVal(BigInt(value), { type: 'i128' });
  }

  /** Convert a number into a u32 ScVal. */
  u32(value: number): xdr.ScVal {
    return nativeToScVal(value, { type: 'u32' });
  }

  /**
   * Simulate a read-only contract call and return the decoded native value.
   * No signing or submission — pure view access via the Soroban RPC.
   */
  async readContract<T = unknown>(
    contractId: string,
    method: string,
    args: xdr.ScVal[] = [],
  ): Promise<T> {
    const contract = new Contract(contractId);
    const source = new Account(SIMULATION_SOURCE, '0');
    const tx = new TransactionBuilder(source, {
      fee: '100',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const sim = await this.rpcServer.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`Simulation failed for ${method}: ${sim.error}`);
    }
    const retval = sim.result?.retval;
    if (!retval) {
      throw new Error(`No return value for ${method}`);
    }
    return scValToNative(retval) as T;
  }

  /**
   * Build an unsigned transaction that invokes a contract method, prepared
   * (simulated + footprint-populated) so the client only needs to sign it.
   * Returns base64 XDR.
   */
  async buildInvocation(
    sourceAddress: string,
    contractId: string,
    method: string,
    args: xdr.ScVal[] = [],
  ): Promise<string> {
    const account = await this.rpcServer.getAccount(sourceAddress);
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(account, {
      fee: '1000000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(120)
      .build();
    const prepared = await this.rpcServer.prepareTransaction(tx);
    return prepared.toXDR();
  }

  /** Submit a signed transaction (base64 XDR) and return the hash once applied. */
  async submit(signedXdr: string): Promise<{ hash: string; status: string }> {
    const tx = TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase);
    const sent = await this.rpcServer.sendTransaction(tx);
    if (sent.status === 'ERROR') {
      throw new Error(`Submit failed: ${JSON.stringify(sent.errorResult)}`);
    }
    // Poll until the transaction is out of pending.
    let result = await this.rpcServer.getTransaction(sent.hash);
    for (let i = 0; i < 15 && result.status === 'NOT_FOUND'; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      result = await this.rpcServer.getTransaction(sent.hash);
    }
    return { hash: sent.hash, status: result.status };
  }

  /** Fund a testnet account via friendbot (no-op on public network). */
  async fundTestnet(address: string): Promise<boolean> {
    if (this.networkPassphrase !== Networks.TESTNET) return false;
    try {
      const res = await fetch(`https://friendbot.stellar.org/?addr=${address}`);
      return res.ok;
    } catch (err) {
      this.logger.warn(`friendbot failed for ${address}: ${String(err)}`);
      return false;
    }
  }
}
