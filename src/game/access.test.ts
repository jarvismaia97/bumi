import { describe, expect, it } from 'vitest';
import { GUEST_CAMPAIGN_LEVEL_LIMIT, isCampaignLevelUnlocked, requiresCampaignLogin } from './access';

describe('guest campaign access', () => {
  it('allows guests through level 10 and requires login for level 11', () => {
    expect(requiresCampaignLogin(GUEST_CAMPAIGN_LEVEL_LIMIT - 1, false)).toBe(false);
    expect(requiresCampaignLogin(GUEST_CAMPAIGN_LEVEL_LIMIT, false)).toBe(true);
  });

  it('does not limit signed-in players', () => {
    expect(requiresCampaignLogin(499, true)).toBe(false);
  });

  it('unlocks only completed levels and the next campaign level', () => {
    const solvedMap = { 0: true, 1: true } as const;
    expect(isCampaignLevelUnlocked(0, solvedMap)).toBe(true);
    expect(isCampaignLevelUnlocked(2, solvedMap)).toBe(true);
    expect(isCampaignLevelUnlocked(3, solvedMap)).toBe(false);
  });
});
