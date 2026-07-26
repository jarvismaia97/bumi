import { describe, expect, it } from 'vitest';
import { INITIAL_HINTS, isMilestoneLevel, MAX_HINTS, normalizeHintCount } from './hints';

describe('hint economy', () => {
  it('starts with a small fixed balance', () => {
    expect(INITIAL_HINTS).toBe(3);
    expect(MAX_HINTS).toBe(5);
  });

  it('rewards every tenth level only', () => {
    expect(isMilestoneLevel(8)).toBe(false);
    expect(isMilestoneLevel(9)).toBe(true);
    expect(isMilestoneLevel(19)).toBe(true);
  });

  it('keeps hint balances between zero and the cap', () => {
    expect(normalizeHintCount(-2)).toBe(0);
    expect(normalizeHintCount(4.8)).toBe(4);
    expect(normalizeHintCount(99)).toBe(MAX_HINTS);
  });
});
