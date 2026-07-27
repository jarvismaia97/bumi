import { describe, expect, it } from 'vitest';
import { ADJECTIVES, AVATAR_GRID, NOUNS, playerAvatar, playerName } from './identity';

describe('playerName', () => {
  it('keeps the word lists index-aligned across languages', () => {
    expect(ADJECTIVES.en).toHaveLength(ADJECTIVES['pt-PT'].length);
    expect(NOUNS.en).toHaveLength(NOUNS['pt-PT'].length);
  });

  it('is stable for the same account id', () => {
    expect(playerName('user_abc123', 'pt-PT')).toBe(playerName('user_abc123', 'pt-PT'));
  });

  it('picks the same slot in every language, so the nickname just translates', () => {
    const ids = ['user_a', 'user_b', 'user_c', 'user_d'];
    const portuguese = ids.map(id => playerName(id, 'pt-PT'));
    const english = ids.map(id => playerName(id, 'en'));
    // Same identity => same shape of collisions across languages.
    expect(new Set(portuguese).size).toBe(new Set(english).size);
    expect(portuguese.every(name => name.split(' ').length === 2)).toBe(true);
    expect(english.every(name => name.split(' ').length === 2)).toBe(true);
  });

  it('spreads different ids across different names', () => {
    const names = new Set(Array.from({ length: 40 }, (_, i) => playerName(`user_${i}`, 'pt-PT')));
    expect(names.size).toBeGreaterThan(25);
  });

  it('never leaks the account id', () => {
    expect(playerName('luismsm14@privaterelay.appleid.com', 'pt-PT')).not.toContain('@');
  });

  it('falls back to a fixed identity when there is no id', () => {
    expect(playerName(null, 'pt-PT')).toBe(playerName(undefined, 'pt-PT'));
  });
});

describe('playerAvatar', () => {
  it('is stable for the same account id', () => {
    expect(playerAvatar('user_abc123')).toEqual(playerAvatar('user_abc123'));
  });

  it('fills a full grid and is mirrored around the centre column', () => {
    const { cells } = playerAvatar('user_abc123');
    expect(cells).toHaveLength(AVATAR_GRID * AVATAR_GRID);
    for (let row = 0; row < AVATAR_GRID; row++) {
      for (let col = 0; col < AVATAR_GRID; col++) {
        expect(cells[row * AVATAR_GRID + col]).toBe(cells[row * AVATAR_GRID + (AVATAR_GRID - 1 - col)]);
      }
    }
  });

  it('is never blank', () => {
    for (let i = 0; i < 200; i++) {
      expect(playerAvatar(`user_${i}`).cells.some(Boolean)).toBe(true);
    }
  });

  it('varies the palette between accounts', () => {
    const fills = new Set(Array.from({ length: 40 }, (_, i) => playerAvatar(`user_${i}`).fill));
    expect(fills.size).toBeGreaterThan(5);
  });
});
