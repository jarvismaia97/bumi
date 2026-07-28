import { describe, expect, it } from 'vitest';
import { MAX_HINTS } from '@/game/hints';
import { mergeProgress, type LocalProgress, type RemoteProgressState } from './progressMerge';

function local(overrides: Partial<LocalProgress> = {}): LocalProgress {
  return {
    solvedMap: {},
    solvedDateMap: {},
    hints: 3,
    dailyCompletedDate: null,
    dailyCompletionDates: [],
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

describe('merging hints', () => {
  it('takes the higher balance rather than adding, which would mint hints on every merge', () => {
    expect(mergeProgress(local({ hints: 5 }), remote({ progress: { hints: 2, dailyCompletedDate: null, dailyCompletionDates: [] } })).hints).toBe(5);
    expect(mergeProgress(local({ hints: 1 }), remote({ progress: { hints: 4, dailyCompletedDate: null, dailyCompletionDates: [] } })).hints).toBe(4);
  });

  it('clamps a balance the server should never have sent', () => {
    const merged = mergeProgress(local(), remote({ progress: { hints: 9999, dailyCompletedDate: null, dailyCompletionDates: [] } }));
    expect(merged.hints).toBe(MAX_HINTS);
  });

  it('survives a server that has no progress row yet', () => {
    expect(mergeProgress(local({ hints: 4 }), remote({ progress: null })).hints).toBe(4);
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
