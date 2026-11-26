import { scheduleAllowance } from './allowance';

const NOW = 1_000_000;
const WEEK = 7 * 86_400;

describe('scheduleAllowance', () => {
  it('covers a single new schedule', () => {
    const r = scheduleAllowance([{ amount: 100n, runs: 4, intervalSecs: WEEK, nextAt: NOW }], NOW);
    expect(r).toEqual({ amount: 400n, lastRunAt: NOW + 3 * WEEK });
  });

  it('adds what open schedules still need, so a new approve does not starve them', () => {
    const r = scheduleAllowance(
      [
        { amount: 50n, runs: 2, intervalSecs: WEEK, nextAt: NOW + WEEK }, // open, 2 runs left
        { amount: 100n, runs: 3, intervalSecs: 60, nextAt: NOW }, // the new one
      ],
      NOW,
    );
    expect(r.amount).toBe(400n);
    expect(r.lastRunAt).toBe(NOW + 2 * WEEK);
  });

  it('treats an overdue run as due now and skips finished or empty plans', () => {
    const r = scheduleAllowance(
      [
        { amount: 10n, runs: 1, intervalSecs: WEEK, nextAt: NOW - 500 },
        { amount: 99n, runs: 0, intervalSecs: WEEK, nextAt: NOW },
        { amount: 0n, runs: 5, intervalSecs: WEEK, nextAt: NOW },
      ],
      NOW,
    );
    expect(r).toEqual({ amount: 10n, lastRunAt: NOW });
  });
});
