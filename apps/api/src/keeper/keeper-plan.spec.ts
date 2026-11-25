import { pickDue } from './keeper-plan';

const NOW = 1_000_000;

describe('pickDue', () => {
  const due = (id: number, ago: number, runsLeft = 3) => ({ id, nextAt: NOW - ago, runsLeft });

  it('runs what is due, oldest first', () => {
    const ids = pickDue([due(1, 10), due(2, 500), { id: 3, nextAt: NOW + 60, runsLeft: 2 }], NOW, new Map(), 10);
    expect(ids).toEqual([2, 1]);
  });

  it('skips schedules still backing off after a failure', () => {
    const ids = pickDue([due(1, 10), due(2, 10)], NOW, new Map([[1, NOW + 300_000]]), 10);
    expect(ids).toEqual([2]);
  });

  it('retries once the back-off has passed', () => {
    expect(pickDue([due(1, 10)], NOW, new Map([[1, NOW - 1]]), 10)).toEqual([1]);
  });

  it('caps the work per tick', () => {
    const many = Array.from({ length: 20 }, (_, i) => due(i + 1, i));
    expect(pickDue(many, NOW, new Map(), 5)).toHaveLength(5);
  });

  it('ignores finished schedules', () => {
    expect(pickDue([due(1, 10, 0)], NOW, new Map(), 10)).toEqual([]);
  });
});
