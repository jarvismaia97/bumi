import { describe, expect, it } from 'vitest';
import { MAX_HINTS } from '@/game/hints';
import { mergeProgress, type LocalProgress, type RemoteProgressState } from './progressMerge';

function local(overrides: Partial<LocalProgress> = {}): LocalProgress {
  return {
    solvedMap: {},
    solvedDateMap: {},
    hints: 3,
    hintsEarned: 3,
    hintsSpent: 0,
    dailyCompletedDate: null,
    dailyCompletionDates: [],
    dailyDurations: {},
    dailyHints: {},
    streakFreezes: [],
    levelMedals: {},
    ...overrides,
  };
}

function remote(overrides: Partial<RemoteProgressState> = {}): RemoteProgressState {
  return {
    progress: { hints: 3, dailyCompletedDate: null, dailyCompletionDates: [] },
    solvedLevelIdxs: [],
    solvedLevelDates: {},
    levelMedals: {},
    ...overrides,
  };
}

describe('merging solved levels', () => {
  it('keeps levels solved on either side', () => {
    const merged = mergeProgress(local({ solvedMap: { 1: true } }), remote({ solvedLevelIdxs: [2] }));
    expect(merged.solvedMap).toEqual({ 1: true, 2: true });
  });

  it('reports only the levels the server has not been told about', () => {
    const merged = mergeProgress(local({ solvedMap: { 1: true, 2: true } }), remote({ solvedLevelIdxs: [2] }));
    expect(merged.newlyLocalSolved).toEqual([1]);
  });

  it('never unsolves a level that only the server knows about', () => {
    // The offline-first case: a fresh install must not wipe the account's history.
    const merged = mergeProgress(local(), remote({ solvedLevelIdxs: [0, 1, 2] }));
    expect(Object.keys(merged.solvedMap)).toHaveLength(3);
  });
});

describe('merging medals', () => {
  it('keeps the better medal from either side', () => {
    const merged = mergeProgress(
      local({ levelMedals: { 1: 'gold', 2: 'bronze' } }),
      remote({ levelMedals: { 1: 'silver', 2: 'gold' } }),
    );
    expect(merged.levelMedals).toEqual({ 1: 'gold', 2: 'gold' });
  });

  it('never downgrades a medal the server already holds', () => {
    const merged = mergeProgress(local({ levelMedals: { 1: 'bronze' } }), remote({ levelMedals: { 1: 'gold' } }));
    expect(merged.levelMedals[1]).toBe('gold');
    expect(merged.newlyLocalMedals).toEqual({});
  });
});

/** A server row with the counters on it, which is what the current API answers with. */
function remoteHints(hintsEarned: number, hintsSpent: number): RemoteProgressState {
  return remote({
    progress: {
      hints: Math.min(MAX_HINTS, Math.max(0, hintsEarned - hintsSpent)),
      hintsEarned,
      hintsSpent,
      dailyCompletedDate: null,
      dailyCompletionDates: [],
    },
  });
}

describe('merging hints', () => {
  it('leaves a spent hint spent, however long the other device holds the old balance', () => {
    // The failure the counters exist for. Device A has ten and spends four; device B still holds
    // ten and posts it, so the server's `greatest` on a balance answered ten and A's own
    // `Math.max(6, 10)` handed the four back — every merge, for as long as the two kept meeting.
    const spender = local({ hints: 6, hintsEarned: 10, hintsSpent: 4 });
    const server = remoteHints(10, 0);

    const merged = mergeProgress(spender, server);
    expect(merged.hints).toBe(6);
    expect(merged.hintsEarned).toBe(10);
    expect(merged.hintsSpent).toBe(4);

    // And it stays gone once the server has been told: merging the same board again is the loop
    // the resurrection lived in.
    expect(mergeProgress(merged, remoteHints(10, 4)).hints).toBe(6);
  });

  it('never takes back a hint earned on another device', () => {
    // The rollback that last-write-wins would have caused: this phone has been offline since the
    // tablet finished the month, and its own idea of the balance is older, not smaller.
    const offline = local({ hints: 3, hintsEarned: 3, hintsSpent: 0 });
    const merged = mergeProgress(offline, remoteHints(9, 1));
    expect(merged.hintsEarned).toBe(9);
    expect(merged.hintsSpent).toBe(1);
    expect(merged.hints).toBe(8);
  });

  it('keeps the larger spend when two devices each spent while apart', () => {
    // Neither side can say which spend came first, and the counters do not need to: the player
    // ends on the smaller balance, which is the direction to be wrong in about a currency.
    const merged = mergeProgress(local({ hints: 8, hintsEarned: 10, hintsSpent: 2 }), remoteHints(10, 5));
    expect(merged.hintsSpent).toBe(5);
    expect(merged.hints).toBe(5);
  });

  it('is the same board whichever side runs the merge, and does not move when run twice', () => {
    const a = { hints: 6, hintsEarned: 12, hintsSpent: 6 };
    const b = { earned: 15, spent: 3 };

    const once = mergeProgress(local(a), remoteHints(b.earned, b.spent));
    expect([once.hintsEarned, once.hintsSpent]).toEqual([15, 6]);
    // Merging the answer back into itself is what every later sync does.
    const twice = mergeProgress(once, remoteHints(once.hintsEarned, once.hintsSpent));
    expect([twice.hintsEarned, twice.hintsSpent]).toEqual([15, 6]);
  });

  it('clamps the derived balance at the cap without touching the counters', () => {
    // The cap is on the balance and only ever on the balance, so a pair that outran it reads as
    // full rather than as an error, and the counters keep saying what actually happened.
    const merged = mergeProgress(local({ hintsEarned: 40, hintsSpent: 0 }), remoteHints(40, 0));
    expect(merged.hints).toBe(MAX_HINTS);
    expect(merged.hintsEarned).toBe(40);
  });

  it('reads a server that answers without counters as all earned and nothing spent', () => {
    // An API rolled back under a newer client. That is the reading the migration backfills the
    // column with, so the two cannot disagree — and this device's own spend still protects it,
    // which is what stops the old high-water balance from resurrecting anything.
    const legacy = { progress: { hints: 10, dailyCompletedDate: null, dailyCompletionDates: [] } };
    const merged = mergeProgress(local({ hints: 6, hintsEarned: 10, hintsSpent: 4 }), remote(legacy));
    expect(merged.hintsEarned).toBe(10);
    expect(merged.hintsSpent).toBe(4);
    expect(merged.hints).toBe(6);
  });

  it('survives a server that has no progress row yet', () => {
    const merged = mergeProgress(local({ hints: 4, hintsEarned: 7, hintsSpent: 3 }), remote({ progress: null }));
    expect(merged.hints).toBe(4);
    expect(merged.hintsEarned).toBe(7);
    expect(merged.hintsSpent).toBe(3);
  });

  it('reads a counter that is not a number as nothing rather than as NaN', () => {
    const merged = mergeProgress(
      local({ hints: 2, hintsEarned: 5, hintsSpent: 3 }),
      remote({ progress: { hints: 0, hintsEarned: undefined, hintsSpent: 'lots' as unknown as number, dailyCompletedDate: null, dailyCompletionDates: [] } }),
    );
    expect(merged.hints).toBe(2);
    expect(merged.hintsSpent).toBe(3);
  });
});

describe('merging daily completions', () => {
  it('unions both sides and keeps the latest as the current one', () => {
    const merged = mergeProgress(
      local({ dailyCompletionDates: ['20260710', '20260712'] }),
      remote({ progress: { hints: 3, dailyCompletedDate: '20260714', dailyCompletionDates: ['20260711', '20260714'] } }),
    );
    expect(merged.dailyCompletionDates).toEqual(['20260710', '20260711', '20260712', '20260714']);
    expect(merged.dailyCompletedDate).toBe('20260714');
  });

  it('falls back to the single stored date when a side has no list', () => {
    // Older clients only kept the last completion; losing it would break the streak.
    const merged = mergeProgress(
      local({ dailyCompletedDate: '20260712', dailyCompletionDates: [] }),
      remote({ progress: { hints: 3, dailyCompletedDate: '20260713', dailyCompletionDates: [] } }),
    );
    expect(merged.dailyCompletionDates).toEqual(['20260712', '20260713']);
  });

  it('leaves nothing behind when neither side has ever played a daily', () => {
    const merged = mergeProgress(local(), remote());
    expect(merged.dailyCompletionDates).toEqual([]);
    expect(merged.dailyCompletedDate).toBeNull();
  });

  it('does not duplicate a day both sides recorded', () => {
    const merged = mergeProgress(
      local({ dailyCompletionDates: ['20260712'] }),
      remote({ progress: { hints: 3, dailyCompletedDate: '20260712', dailyCompletionDates: ['20260712'] } }),
    );
    expect(merged.dailyCompletionDates).toEqual(['20260712']);
  });
});

describe('mergeProgress daily hints', () => {
  it('keeps the hints belonging to the faster side, not the smaller count', () => {
    const merged = mergeProgress(
      local({ dailyDurations: { '20260811': 4000 }, dailyHints: { '20260811': 3 } }),
      remote({
        progress: {
          hints: 3,
          dailyCompletedDate: null,
          dailyCompletionDates: [],
          dailyDurations: { '20260811': 9000 },
          dailyHints: { '20260811': 0 },
        },
      }),
    );
    expect(merged.dailyDurations['20260811']).toBe(4000);
    expect(merged.dailyHints['20260811']).toBe(3);
  });

  it('takes the only count there is when one side never recorded one', () => {
    const merged = mergeProgress(
      local({ dailyDurations: { '20260811': 4000 }, dailyHints: {} }),
      remote({
        progress: {
          hints: 3,
          dailyCompletedDate: null,
          dailyCompletionDates: [],
          dailyDurations: { '20260811': 9000 },
          dailyHints: { '20260811': 2 },
        },
      }),
    );
    expect(merged.dailyHints['20260811']).toBe(2);
  });

  it('leaves a day nobody counted absent rather than zero', () => {
    const merged = mergeProgress(
      local({ dailyDurations: { '20260811': 4000 } }),
      remote({
        progress: {
          hints: 3,
          dailyCompletedDate: null,
          dailyCompletionDates: [],
          dailyDurations: { '20260811': 9000 },
        },
      }),
    );
    expect('20260811' in merged.dailyHints).toBe(false);
  });
});
