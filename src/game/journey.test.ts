import { describe, expect, it } from 'vitest';
import { getIslandJourney, getIslandRange, ISLANDS } from './islands';

/** Every level of the first `count` islands, as the progress store would hold them. */
function solvedThrough(islandIndex: number): Record<number, true> {
  const { endIdx } = getIslandRange(islandIndex);
  return Object.fromEntries(Array.from({ length: endIdx }, (_, idx) => [idx, true as const]));
}

describe('the campaign as a journey', () => {
  it('describes one chapter per island', () => {
    const { islands } = getIslandJourney({}, 0);

    expect(islands).toHaveLength(ISLANDS.length);
    expect(islands[0].id).toBe('scrub');
    expect(islands.at(-1)?.id).toBe('olympus');
  });

  it('counts what is solved inside each island, not across the campaign', () => {
    const { islands } = getIslandJourney(solvedThrough(0), getIslandRange(1).startIdx);

    expect(islands[0].solved).toBe(islands[0].total);
    expect(islands[0].complete).toBe(true);
    expect(islands[1].solved).toBe(0);
    expect(islands[1].complete).toBe(false);
  });

  it('marks the island the next level belongs to as the current one', () => {
    const { islands, currentIndex } = getIslandJourney(solvedThrough(1), getIslandRange(2).startIdx);

    expect(currentIndex).toBe(2);
    expect(islands[2].current).toBe(true);
    expect(islands.filter(island => island.current)).toHaveLength(1);
  });

  it('leaves the islands past the player undiscovered', () => {
    const { islands } = getIslandJourney({}, 0);

    expect(islands[0].reached).toBe(true);
    expect(islands[1].reached).toBe(false);
    expect(islands.at(-1)?.reached).toBe(false);
  });

  it('opens every island to a player who has finished the campaign', () => {
    const last = ISLANDS.length - 1;
    const { islands, currentIndex } = getIslandJourney(solvedThrough(last), getIslandRange(last).endIdx - 1);

    expect(currentIndex).toBe(last);
    expect(islands.every(island => island.reached)).toBe(true);
    expect(islands.every(island => island.complete)).toBe(true);
  });

  it('starts a fresh player on the first island rather than nowhere', () => {
    const { currentIndex, islands } = getIslandJourney({}, 0);

    expect(currentIndex).toBe(0);
    expect(islands[0].current).toBe(true);
    expect(islands[0].solved).toBe(0);
  });
});
