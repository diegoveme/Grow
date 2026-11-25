/** Which recurring remittances the keeper should run on this tick. Pure. */

export interface DueCandidate {
  id: number;
  /** When the next run is allowed (epoch ms). */
  nextAt: number;
  runsLeft: number;
}

/**
 * Ids that are due now, oldest-due first, skipping any still backing off
 * after a failed attempt, and at most `max` per tick so one tick can't burn
 * the keeper's fee budget.
 */
export function pickDue(
  candidates: DueCandidate[],
  now: number,
  retryAfter: ReadonlyMap<number, number>,
  max: number,
): number[] {
  return candidates
    .filter((c) => c.runsLeft > 0 && c.nextAt <= now && (retryAfter.get(c.id) ?? 0) <= now)
    .sort((a, b) => a.nextAt - b.nextAt)
    .slice(0, max)
    .map((c) => c.id);
}
