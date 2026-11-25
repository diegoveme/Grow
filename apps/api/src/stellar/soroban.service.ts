import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Account,
  Contract,
  Networks,
  TransactionBuilder,
  scValToNative,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';
import type { AppConfig } from '../config/configuration';
import { contractFailures, describeFailure } from './contract-errors';
import { unfundedMessage } from './messages';

/** A throwaway account used only to assemble read-only simulations. */
const SIMULATION_SOURCE = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

/**
 * Soroban RPC client: read-only contract calls, unsigned invocation building
 * and submission of signed transactions. Knows nothing about Grow's domain.
 */
@Injectable()
export class SorobanService {
  private readonly logger = new Logger(SorobanService.name);
  private readonly rpcServer: rpc.Server;
  readonly networkPassphrase: string;
  private readonly isTestnet: boolean;
  private readonly contractIds: { splitter?: string; token?: string };

  constructor(config: ConfigService<AppConfig, true>) {
    const rpcUrl = config.get('sorobanRpcUrl', { infer: true });
    this.rpcServer = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
    this.networkPassphrase = config.get('networkPassphrase', { infer: true });
    this.isTestnet = this.networkPassphrase === Networks.TESTNET;
    const contracts = config.get('contracts', { infer: true });
    this.contractIds = { splitter: contracts.yieldSplitter, token: contracts.usdcToken };
  }

  get server(): rpc.Server {
    return this.rpcServer;
  }

  /**
   * Simulate a read-only contract call and return the decoded native value.
   * No signing or submission, pure view access via the Soroban RPC.
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

    const sim = await this.rpcServer.simulateTransaction(tx).catch((err: unknown) => {
      throw new ServiceUnavailableException(`Soroban RPC unavailable: ${String(err)}`);
    });
    if (rpc.Api.isSimulationError(sim)) {
      this.logger.warn(`read ${method} failed: ${sim.error.split('\n')[0]}`);
      throw new ServiceUnavailableException(`Could not read ${method} from the contract.`);
    }
    const retval = sim.result?.retval;
    if (!retval) {
      throw new ServiceUnavailableException(`The contract returned nothing for ${method}.`);
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
    const account = await this.rpcServer.getAccount(sourceAddress).catch((err: unknown) => {
      if (/not found/i.test(String(err))) {
        throw new BadRequestException(unfundedMessage(this.isTestnet));
      }
      throw err;
    });
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(account, {
      fee: '1000000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(120)
      .build();

    // Simulate ourselves (instead of prepareTransaction) so a contract error
    // reaches the user as a readable message rather than a 500.
    const sim = await this.rpcServer.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      const failures = contractFailures(sim.events);
      this.logger.warn(`simulate ${method} failed: ${sim.error.split('\n')[0]}`);
      throw new BadRequestException(describeFailure(failures, sim.error, this.contractIds));
    }
    return rpc.assembleTransaction(tx, sim).build().toXDR();
  }

  /**
   * Submit a signed Soroban transaction (base64 XDR) and wait for it to land.
   * Throws if the network rejects it or it fails on-chain; returns status
   * `SUCCESS`, or `NOT_FOUND` if it is still pending after ~30s.
   */
  async submit(signedXdr: string): Promise<{ hash: string; status: string }> {
    const tx = TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase);
    const sent = await this.rpcServer.sendTransaction(tx);
    if (sent.status === 'ERROR') {
      const code = sent.errorResult?.result().switch().name ?? 'unknown';
      throw new BadRequestException(`The network rejected the transaction (${code}).`);
    }
    if (sent.status === 'TRY_AGAIN_LATER') {
      throw new ServiceUnavailableException('The network is busy. Try again in a few seconds.');
    }
    let result = await this.rpcServer.getTransaction(sent.hash);
    for (let i = 0; i < 30 && result.status === 'NOT_FOUND'; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      result = await this.rpcServer.getTransaction(sent.hash);
    }
    if (result.status === 'FAILED') {
      throw new BadRequestException(`The transaction failed on-chain (${sent.hash}).`);
    }
    return { hash: sent.hash, status: result.status };
  }
}
