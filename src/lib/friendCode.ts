/**
 * The code a player hands out to be added to someone's leaderboard. Deliberately *not* the
 * account id: that is the auth subject, it is the primary key of every progress table, and it
 * can never be changed once it has been pasted into a chat. A code lives in `profiles`, is
 * unique, and can be rotated, so unwanted company is a fixable mistake rather than a permanent
 * one.
 *
 * The alphabet drops 0/O, 1/I/L and U — the pairs that get misread off a screen, and the
 * letter that turns codes into words nobody wants to read out loud. 30^6 is 729 million codes,
 * which is more than enough for a game with friends and short enough to type from a photo.
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export const FRIEND_CODE_LENGTH = 6;

export function friendCodeAlphabet(): string {
  return ALPHABET;
}

/** Builds a code from random bytes. The caller owns the randomness, so this stays testable. */
export function friendCodeFromBytes(bytes: Uint8Array): string {
  let code = '';
  for (let i = 0; i < FRIEND_CODE_LENGTH; i++) {
    code += ALPHABET[(bytes[i] ?? 0) % ALPHABET.length];
  }
  return code;
}

/**
 * What a player typed, turned into what a code looks like. Spaces, dashes and lower case all
 * survive being pasted from a message; a letter outside the alphabet does not, because the
 * mistake is worth reporting rather than silently mapping to something else.
 */
export function normalizeFriendCode(input: string): string | null {
  const cleaned = input.trim().toUpperCase().replace(/[\s-]/g, '');
  if (cleaned.length !== FRIEND_CODE_LENGTH) return null;
  return [...cleaned].every(char => ALPHABET.includes(char)) ? cleaned : null;
}

export function isFriendCode(input: string): boolean {
  return normalizeFriendCode(input) !== null;
}
