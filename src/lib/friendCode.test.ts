import { describe, expect, it } from 'vitest';
import { friendCodeFromBytes, isFriendCode, normalizeFriendCode } from './friendCode';

describe('friend codes', () => {
  it('builds a six-character code from bytes', () => {
    expect(friendCodeFromBytes(new Uint8Array([0, 1, 2, 3, 4, 5]))).toBe('234567');
  });

  it('wraps bytes around the alphabet rather than dropping them', () => {
    expect(friendCodeFromBytes(new Uint8Array([30, 31, 255, 0, 0, 0])).length).toBe(6);
  });

  it('accepts a code the way it arrives in a message', () => {
    expect(normalizeFriendCode('7k3qf2')).toBe('7K3QF2');
    expect(normalizeFriendCode(' 7K3-QF2 ')).toBe('7K3QF2');
  });

  it('rejects anything that is not a code rather than guessing', () => {
    // O, I, L, U and the digits they are mistaken for are not in the alphabet at all.
    expect(normalizeFriendCode('7K3QFO')).toBeNull();
    expect(normalizeFriendCode('7K3QF')).toBeNull();
    expect(normalizeFriendCode('7K3QF23')).toBeNull();
    expect(normalizeFriendCode('')).toBeNull();
    expect(isFriendCode('not a code')).toBe(false);
  });
});
