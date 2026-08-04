/**
 * A name for what a row on the board has done, shown beside the player's own.
 *
 * The twelve achievements had no reward beyond being ticked. These are that reward — but only
 * the ones a leaderboard row can prove, because a title nobody else can see is not worth
 * having. A row carries solved levels, medal counts and the daily streak, so those are what
 * titles are cut from; the island achievements need the actual `solvedMap`, which is the one
 * thing the board does not send about a friend.
 *
 * Nothing is stored and nothing is bought. The title is a function of numbers the board already
 * shows, which is why a friend gets theirs without the server learning a new column.
 */
export interface TitleStats {
  solved: number;
  gold: number;
  streak: number;
}

export interface Title {
  id: string;
  /** The achievement this pays out. `titles.test.ts` holds the two to the same threshold. */
  achievement: string;
  reached: (stats: TitleStats) => boolean;
}

/**
 * Ordered by what outranks what, and the first match wins. Mastery sits above volume at a
 * similar depth: fifty golds is a harder thing to have than a hundred levels touched, so it
 * takes the higher rung.
 */
export const TITLES: readonly Title[] = [
  { id: 'legend', achievement: 'campaign-500', reached: s => s.solved >= 500 },
  { id: 'veteran', achievement: 'campaign-250', reached: s => s.solved >= 250 },
  { id: 'goldsmith', achievement: 'gold-50', reached: s => s.gold >= 50 },
  { id: 'cartographer', achievement: 'campaign-100', reached: s => s.solved >= 100 },
  { id: 'steady', achievement: 'daily-7', reached: s => s.streak >= 7 },
  { id: 'collector', achievement: 'gold-10', reached: s => s.gold >= 10 },
  { id: 'explorer', achievement: 'campaign-50', reached: s => s.solved >= 50 },
  { id: 'apprentice', achievement: 'campaign-10', reached: s => s.solved >= 10 },
];

/** The highest one earned, or nothing at all — a first-day player has not been anything yet. */
export function titleFor(stats: TitleStats): Title | null {
  return TITLES.find(title => title.reached(stats)) ?? null;
}
