import { describe, expect, it } from 'vitest';
import { ARTISTS, AVATAR_GRID, playerAvatar, playerName } from './identity';

describe('playerName', () => {
  it('gives every artist an epithet in both languages', () => {
    for (const artist of ARTISTS) {
      expect(artist.epithet['pt-PT']).toBeTruthy();
      expect(artist.epithet.en).toBeTruthy();
    }
  });

  it('keeps the artist name identical across languages, translating only the epithet', () => {
    const portuguese = playerName('user_abc123', 'pt-PT');
    const english = playerName('user_abc123', 'en');
    expect(portuguese.split(' "')[0]).toBe(english.split(' "')[0]);
  });

  it('stays short enough for the account card', () => {
    for (const artist of ARTISTS) {
      expect(`${artist.name} "${artist.epithet['pt-PT']}"`.length).toBeLessThanOrEqual(32);
      expect(`${artist.name} "${artist.epithet.en}"`.length).toBeLessThanOrEqual(32);
    }
  });

  it('is stable for the same account id', () => {
    expect(playerName('user_abc123', 'pt-PT')).toBe(playerName('user_abc123', 'pt-PT'));
  });

  it('spreads different ids across different artists', () => {
    const names = new Set(Array.from({ length: 60 }, (_, i) => playerName(`user_${i}`, 'pt-PT')));
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
