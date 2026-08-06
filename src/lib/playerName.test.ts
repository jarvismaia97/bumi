import { describe, expect, it } from 'vitest';
import { ARTISTS, artistIndexFor, artistLabel, playerName } from './playerName';

describe('the painter a board row is called at rest', () => {
  it('pairs the artist with the epithet written for that artist', () => {
    const artist = ARTISTS[1];
    expect(artistLabel(1, 'pt-PT')).toBe(`${artist.name} "${artist.epithet['pt-PT']}"`);
    expect(artistLabel(1, 'en')).toBe(`${artist.name} "${artist.epithet.en}"`);
    expect(artistLabel(1, 'es')).toBe(`${artist.name} "${artist.epithet.es}"`);
  });

  it('keeps an index in range, so a shorter catalogue cannot paint undefined', () => {
    // The board is sent an index by a server that may be a deploy ahead of this device.
    expect(artistLabel(ARTISTS.length + 1, 'en')).toBe(artistLabel(1, 'en'));
    expect(artistLabel(ARTISTS.length * 3, 'en')).toBe(artistLabel(0, 'en'));
  });

  it('gives the same account the same painter every time it is asked', () => {
    const id = 'user_abc123';
    expect(artistIndexFor(id)).toBe(artistIndexFor(id));
    expect(playerName(id, 'pt-PT')).toBe(playerName(id, 'pt-PT'));
  });

  it('names an account by the painter its index points at', () => {
    const id = 'user_abc123';
    expect(playerName(id, 'en')).toBe(artistLabel(artistIndexFor(id), 'en'));
  });
});
