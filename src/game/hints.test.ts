import { describe, expect, it } from 'vitest';
import { INITIAL_HINTS, isMilestoneLevel, MAX_HINTS, MILESTONE_INTERVAL, normalizeHintCount } from './hints';

describe('hint economy', () => {
  it('starts with a small balance below a ceiling the player can work towards', () => {
    expect(INITIAL_HINTS).toBe(3);
    expect(MAX_HINTS).toBeGreaterThan(INITIAL_HINTS);
  });

  it('does not let the milestone drip alone pin the player at the cap', () => {
    // The old ceiling of 5 was reached by level 50 on milestones alone, after which
    // spending a hint cost nothing and saving one meant nothing.
    const milestonesInCampaign = Math.floor(500 / MILESTONE_INTERVAL);
    const levelsToReachCap = (MAX_HINTS - INITIAL_HINTS) * MILESTONE_INTERVAL;
    expect(levelsToReachCap).toBeGreaterThan(100);
    expect(INITIAL_HINTS + milestonesInCampaign).toBeGreaterThan(MAX_HINTS);
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
