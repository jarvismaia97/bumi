import { describe, expect, it } from 'vitest';
import { getAchievements } from './achievements';
import { TITLES, titleFor } from './titles';

/** Targets read off the achievements themselves, so the two cannot drift apart unnoticed. */
const TARGETS = Object.fromEntries(
  getAchievements({ solvedMap: {}, solvedDateMap: {}, levelMedals: {}, dailyStreak: 0 }).map(a => [a.id, a.target]),
);

describe('titles', () => {
  it('pays out an achievement that exists', () => {
    for (const title of TITLES) {
      expect(TARGETS[title.achievement], title.id).toBeDefined();
    }
  });

  it('turns on exactly at the threshold the achievement turns on at', () => {
    // The two numbers are written in two files. This is what keeps them the same number: move
    // `gold-50` to sixty and the goldsmith title fails here rather than quietly lying.
    for (const title of TITLES) {
      const target = TARGETS[title.achievement];
      const field = title.achievement.startsWith('gold') ? 'gold' : title.achievement.startsWith('daily') ? 'streak' : 'solved';
      const at = { solved: 0, gold: 0, streak: 0, [field]: target };
      const under = { solved: 0, gold: 0, streak: 0, [field]: target - 1 };
      expect(title.reached(at), `${title.id} at ${target}`).toBe(true);
      expect(title.reached(under), `${title.id} below ${target}`).toBe(false);
    }
  });

  it('gives the highest earned, not the first reached', () => {
    expect(titleFor({ solved: 500, gold: 200, streak: 40 })?.id).toBe('legend');
    expect(titleFor({ solved: 260, gold: 0, streak: 0 })?.id).toBe('veteran');
  });

  it('ranks mastery above volume at a similar depth', () => {
    // Sixty levels with fifty golds is a harder thing to have than sixty levels without.
    expect(titleFor({ solved: 60, gold: 50, streak: 0 })?.id).toBe('goldsmith');
    expect(titleFor({ solved: 60, gold: 0, streak: 0 })?.id).toBe('explorer');
  });

  it('gives a first-day player nothing, having been nothing yet', () => {
    expect(titleFor({ solved: 9, gold: 0, streak: 0 })).toBeNull();
  });
});

describe('title frames', () => {
  it('never puts a lesser metal above a greater one', () => {
    // The list is ordered by rank, so the frames have to descend with it: a bronze above a gold
    // would mean a higher title wearing a lower ring.
    const rank = { gold: 3, silver: 2, bronze: 1 };
    const ranks = TITLES.map(title => rank[title.frame]);
    expect([...ranks].sort((a, b) => b - a)).toEqual(ranks);
  });

  it('gives every title a frame, since the ring is how the board shows rank at a glance', () => {
    for (const title of TITLES) expect(['gold', 'silver', 'bronze']).toContain(title.frame);
  });
});
