import { describe, expect, it } from 'vitest';
import { createChallengeUrl, createDailyChallengeUrl, createDailyResultMessage, getChallengeLevelIndex, getDailyChallengeDateKey, resolveDailySolve, showsMilestoneHintReward } from './challenge';
import { getDailyDateKey } from './daily';

/** The `n` days ending on `last`, oldest first, as the store keeps them. */
function runEndingOn(last: Date, days: number): string[] {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(last);
    date.setDate(last.getDate() - (days - 1 - index));
    return getDailyDateKey(date);
  });
}

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
    expect(createDailyResultMessage('20260720', '42s · 0 dicas · 1 erro', 3, 'pt-PT')).toContain('42s · 0 dicas · 1 erro');
  });

  it('leaves the URL clean for Portuguese, the server default', () => {
    expect(createChallengeUrl(41, 'https://www.jogarbumi.pt', 'pt-PT')).toBe('https://www.jogarbumi.pt/partilha/nivel/42');
    expect(createDailyChallengeUrl('20260720', 'https://www.jogarbumi.pt', 'pt-PT')).toBe('https://www.jogarbumi.pt/partilha/diario/20260720');
  });

  it('stamps the sharer language on the URL so the card renders in it', () => {
    expect(createChallengeUrl(41, 'https://www.jogarbumi.pt', 'en')).toBe('https://www.jogarbumi.pt/partilha/nivel/42?lang=en');
    expect(createDailyChallengeUrl('20260720', 'https://www.jogarbumi.pt', 'en')).toBe('https://www.jogarbumi.pt/partilha/diario/20260720?lang=en');
  });

  it('accepts a campaign level within range', () => {
    expect(getChallengeLevelIndex('42', 500)).toBe(41);
  });

  it('rejects missing, fractional, and out-of-range levels', () => {
    expect(getChallengeLevelIndex(undefined, 500)).toBeNull();
    expect(getChallengeLevelIndex('4.5', 500)).toBeNull();
    expect(getChallengeLevelIndex('501', 500)).toBeNull();
  });

  it('rejects a day that has not happened, which a link could otherwise record as played', () => {
    // A hand-edited query string was enough: the win wrote the key into the completion list,
    // where it counted towards the month, could pay the monthly hints and then synced.
    const now = new Date(2026, 7, 15);

    expect(getDailyChallengeDateKey('20270815', now)).toBeNull();
    expect(getDailyChallengeDateKey('20260817', now)).toBeNull();
    // Today itself is the boundary and is playable, whatever the hour the link is opened at.
    expect(getDailyChallengeDateKey('20260815', new Date(2026, 7, 15, 23, 59))).toBe('20260815');
    expect(getDailyChallengeDateKey('20260814', now)).toBe('20260814');
  });

  // The clock asking is rarely the clock that wrote the key, and a link is the whole reason two
  // clocks meet. Tokyo shares its genuine today; Los Angeles reads it seventeen hours behind and
  // the share card reads it at UTC, where nobody lives. Judged on the reader's own midnight,
  // each of those turns the key down — and the app does not fail loudly, it quietly opens some
  // other day's board, so the "beat my time" the link exists for compares two different puzzles.
  it("accepts a sharer's today from a zone that is already tomorrow", () => {
    const losAngelesEvening = new Date(2026, 7, 15, 17, 0);

    expect(getDailyChallengeDateKey('20260816', losAngelesEvening)).toBe('20260816');
    // A day nobody is standing in is still refused: the allowance is one day, not open-ended.
    expect(getDailyChallengeDateKey('20260817', losAngelesEvening)).toBeNull();
  });
});

describe('what a daily solve was worth', () => {
  const now = new Date(2026, 7, 15);

  it('celebrates the thirtieth day on the thirtieth day', () => {
    // The streak was read from the render before the day was recorded, so arriving at thirty
    // asked whether twenty-nine was a milestone. The milestones are sparse, so nobody ever saw
    // one on the day they earned it — the gold turned up the following evening at thirty-one.
    const dateKey = getDailyDateKey(now);
    const previous = runEndingOn(new Date(2026, 7, 14), 29);

    const outcome = resolveDailySolve({ dateKey, recordedDates: previous, freezeDates: [] }, now);

    expect(outcome.streak).toBe(30);
    expect(outcome.streakMilestone).toBe(true);
  });

  it('says nothing on the twenty-ninth, or on the thirty-first', () => {
    const dateKey = getDailyDateKey(now);

    expect(resolveDailySolve({ dateKey, recordedDates: runEndingOn(new Date(2026, 7, 14), 28), freezeDates: [] }, now).streakMilestone).toBe(false);
    expect(resolveDailySolve({ dateKey, recordedDates: runEndingOn(new Date(2026, 7, 14), 30), freezeDates: [] }, now).streakMilestone).toBe(false);
  });

  it('counts a frozen day towards the run, the way the store does', () => {
    const dateKey = getDailyDateKey(now);
    const recordedDates = runEndingOn(new Date(2026, 7, 13), 29);

    const outcome = resolveDailySolve({ dateKey, recordedDates, freezeDates: [getDailyDateKey(new Date(2026, 7, 14))] }, now);

    expect(outcome.streak).toBe(31);
  });

  it('celebrates nothing for a day already on file, which the store will not pay for twice', () => {
    // A replay from the archive runs the whole win flow again. The store declines to pay a
    // second time, so a celebration here would be congratulating a reward that never arrived.
    const dateKey = getDailyDateKey(now);
    const recordedDates = runEndingOn(now, 30);

    const outcome = resolveDailySolve({ dateKey, recordedDates, freezeDates: [] }, now);

    expect(outcome.replay).toBe(true);
    expect(outcome.streakMilestone).toBe(false);
    expect(outcome.weeklyClosed).toBe(false);
    expect(outcome.monthlyClosed).toBe(false);
  });

  it('marks the solve that closes the weekly goal, and only that one', () => {
    const monday = getDailyDateKey(new Date(2026, 7, 10));
    const tuesday = getDailyDateKey(new Date(2026, 7, 11));
    const wednesday = getDailyDateKey(new Date(2026, 7, 12));

    expect(resolveDailySolve({ dateKey: wednesday, recordedDates: [monday, tuesday], freezeDates: [] }, now).weeklyClosed).toBe(true);
    expect(resolveDailySolve({ dateKey: tuesday, recordedDates: [monday], freezeDates: [] }, now).weeklyClosed).toBe(false);
  });
});

describe('the milestone hint the win sheet promises', () => {
  it('promises it only when the solve was the one that paid it', () => {
    // Read off `solvedMap` after marking, a first solve and a replay are the same entry, so
    // every replay of a tenth level promised a hint the balance never received.
    expect(showsMilestoneHintReward(9, true)).toBe(true);
    expect(showsMilestoneHintReward(9, false)).toBe(false);
  });

  it('says nothing on the levels between milestones', () => {
    expect(showsMilestoneHintReward(8, true)).toBe(false);
    expect(showsMilestoneHintReward(0, true)).toBe(false);
  });
});
