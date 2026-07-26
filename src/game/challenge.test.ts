import { describe, expect, it } from 'vitest';
import { createChallengeUrl, createDailyChallengeUrl, createDailyResultMessage, getChallengeLevelIndex, getDailyChallengeDateKey } from './challenge';

describe('challenge links', () => {
  it('encodes only the public campaign level in the URL', () => {
    expect(createChallengeUrl(41, 'https://bumi-nu.vercel.app/')).toBe('https://bumi-nu.vercel.app/partilha/nivel/42');
  });

  it('encodes only a valid daily date in the URL', () => {
    expect(createDailyChallengeUrl('20260720', 'https://bumi-nu.vercel.app/')).toBe('https://bumi-nu.vercel.app/partilha/diario/20260720');
    expect(getDailyChallengeDateKey('20260720')).toBe('20260720');
    expect(getDailyChallengeDateKey('20260230')).toBeNull();
    expect(getDailyChallengeDateKey('20-07-2026')).toBeNull();
  });

  it('formats a daily result without exposing the puzzle solution', () => {
    expect(createDailyResultMessage('20260720', '42s · 0 dicas · 1 erro', 3)).toContain('42s · 0 dicas · 1 erro');
  });

  it('accepts a campaign level within range', () => {
    expect(getChallengeLevelIndex('42', 500)).toBe(41);
  });

  it('rejects missing, fractional, and out-of-range levels', () => {
    expect(getChallengeLevelIndex(undefined, 500)).toBeNull();
    expect(getChallengeLevelIndex('4.5', 500)).toBeNull();
    expect(getChallengeLevelIndex('501', 500)).toBeNull();
  });
});
