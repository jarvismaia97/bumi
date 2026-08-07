import { describe, expect, it } from 'vitest';
import { beatsFriendTime } from './dailyRace';

describe('who a daily solve just moved past', () => {
  it('passes everyone slower when today had not been played yet', () => {
    expect(beatsFriendTime(null, 60_000, 90_000)).toBe(true);
    expect(beatsFriendTime(null, 60_000, 30_000)).toBe(false);
  });

  it('says nothing about a friend who was already behind', () => {
    // They heard about it when it happened; repeating it is how a notification gets switched off.
    expect(beatsFriendTime(80_000, 60_000, 90_000)).toBe(false);
  });

  it('passes only the friends caught between the old time and the new one', () => {
    const previous = 80_000;
    const current = 50_000;
    expect(beatsFriendTime(previous, current, 70_000)).toBe(true);
    expect(beatsFriendTime(previous, current, 80_000)).toBe(true);
    expect(beatsFriendTime(previous, current, 90_000)).toBe(false);
    expect(beatsFriendTime(previous, current, 40_000)).toBe(false);
  });

  it('stays quiet when a replay did not improve the record', () => {
    // The stored time is the better of the two, so nothing moved.
    expect(beatsFriendTime(50_000, 70_000, 60_000)).toBe(false);
    expect(beatsFriendTime(50_000, 50_000, 60_000)).toBe(false);
  });

  it('does not fire on an exact tie with the friend', () => {
    // Level is not past. Being told someone drew with you is not news worth a phone buzzing.
    expect(beatsFriendTime(null, 60_000, 60_000)).toBe(false);
  });
});
