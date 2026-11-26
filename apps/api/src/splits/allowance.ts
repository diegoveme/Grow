/** One recurring pull the contract will make from a sender. */
export interface PullPlan {
  /** Per-run amount, in stroops. */
  amount: bigint;
  /** Runs still to make. */
  runs: number;
  intervalSecs: number;
  /** Unix seconds of the next run (now for a new schedule). */
  nextAt: number;
}

/**
 * The allowance a sender must grant the contract so that every open schedule
 * plus a new one can still run. SEP-41 `approve` replaces the allowance
 * instead of adding to it, so approving only the new schedule would starve
 * the ones already running.
 */
export function scheduleAllowance(
  plans: PullPlan[],
  nowSecs: number,
): { amount: bigint; lastRunAt: number } {
  let amount = 0n;
  let lastRunAt = nowSecs;
  for (const plan of plans) {
    if (plan.runs <= 0 || plan.amount <= 0n) continue;
    amount += plan.amount * BigInt(plan.runs);
    const lastRun = Math.max(plan.nextAt, nowSecs) + plan.intervalSecs * (plan.runs - 1);
    lastRunAt = Math.max(lastRunAt, lastRun);
  }
  return { amount, lastRunAt };
}
