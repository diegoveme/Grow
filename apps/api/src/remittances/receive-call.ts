import { Address, xdr } from '@stellar/stellar-sdk';

/** A contract call decoded from a transaction envelope. */
export interface ContractCall {
  contract: string;
  fn: string;
  args: xdr.ScVal[];
}

/** The contract call inside a single-operation Soroban transaction, if any. */
export function invokedContract(
  envelope: xdr.TransactionEnvelope,
): ContractCall | undefined {
  try {
    const inner =
      envelope.switch() === xdr.EnvelopeType.envelopeTypeTxFeeBump()
        ? envelope.feeBump().tx().innerTx().v1().tx()
        : envelope.v1().tx();
    const [op] = inner.operations();
    if (!op || op.body().switch() !== xdr.OperationType.invokeHostFunction()) return undefined;
    const fn = op.body().invokeHostFunctionOp().hostFunction();
    if (fn.switch() !== xdr.HostFunctionType.hostFunctionTypeInvokeContract()) return undefined;
    const invoke = fn.invokeContract();
    return {
      contract: Address.fromScAddress(invoke.contractAddress()).toString(),
      fn: invoke.functionName().toString(),
      args: invoke.args(),
    };
  } catch {
    return undefined;
  }
}
