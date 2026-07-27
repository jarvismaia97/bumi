import { isMilestoneLevel } from './hints';
import type { ChallengeProfile, DifficultyTier, HardLevel, LevelMeta } from './types';

// `clues` is the piece-count band this tier aims for, as [start, end] across the tier's own
// levels — the target ramps from the first value to the second as the player progresses
// through the tier. Bands are size-relative: 22 pieces is dense on a 8x8 and sparse on a
// 12x12, so each row carries its own. The generator hits these by construction (see
// targetArea in generator.ts) rather than by rejection sampling.
export const DIFFS: DifficultyTier[] = [
  { label: 'easy', size: 4, maxArea: 8, count: 20, hard: 0, clues: [4, 6] },
  { label: 'easy', size: 5, maxArea: 10, count: 25, hard: 0, clues: [6, 9] },
  { label: 'easy', size: 6, maxArea: 12, count: 25, hard: 0, clues: [10, 14] },
  { label: 'medium', size: 7, maxArea: 10, count: 30, hard: 0, clues: [14, 18] },
  { label: 'medium', size: 8, maxArea: 9, count: 30, hard: 0, clues: [19, 24] },
  { label: 'hard', size: 9, maxArea: 8, count: 35, hard: 1, clues: [24, 29] },
  { label: 'hard', size: 10, maxArea: 8, count: 35, hard: 1, clues: [29, 34] },
  { label: 'expert', size: 10, maxArea: 9, count: 40, hard: 1, clues: [32, 36] },
  { label: 'expert', size: 11, maxArea: 9, count: 40, hard: 1, clues: [36, 40] },
  { label: 'master', size: 11, maxArea: 10, count: 45, hard: 2, clues: [40, 44] },
  { label: 'master', size: 12, maxArea: 12, count: 45, hard: 2, clues: [42, 46] },
  // Lenda used to cap at 15/16. Swept against every other setting at this board size and
  // density, maxArea 16 graded worst in all eight upper tiers — a 16 has only three legal
  // shapes on a 12-wide board (2x8, 8x2, 4x4), so a big clue value pins itself down instead
  // of opening choices. Lenda's difficulty comes from piece density, not piece size.
  { label: 'legend', size: 12, maxArea: 12, count: 65, hard: 2, clues: [45, 49] },
  { label: 'legend', size: 12, maxArea: 12, count: 65, hard: 2, clues: [48, 52] },
];

/** How far a generated level may sit from its target piece count before it's rejected. */
const CLUE_SLACK = 2;

export function getCampaignLevelMeta(): LevelMeta[] {
  const levels: LevelMeta[] = [];

  DIFFS.forEach(tier => {
    for (let i = 0; i < tier.count; i++) {
      const progress = i / Math.max(1, tier.count - 1);
      const areaReduction = progress >= 0.7 ? 2 : progress >= 0.35 ? 1 : 0;
      const hard: HardLevel = progress >= 0.72 ? Math.min(2, tier.hard + 1) as HardLevel : tier.hard;
      const [clueStart, clueEnd] = tier.clues;
      const clueTarget = Math.round(clueStart + (clueEnd - clueStart) * progress);
      levels.push({
        label: tier.label,
        size: tier.size,
        maxArea: Math.max(4, tier.maxArea - areaReduction),
        hard,
        clueTarget,
        clueRange: [clueTarget - CLUE_SLACK, clueTarget + CLUE_SLACK],
        // The first 70 levels teach the rules — all of Fácil plus the first Médio tier.
        // From level 71 each stage adds more ambiguity; every tenth level combines all
        // challenge signals.
        challenge: getChallengeProfile(levels.length + 1),
        milestone: false,
      });
    }
  });

  return levels.map((level, idx) =>
    isMilestoneLevel(idx)
      ? { ...level, hard: 2, milestone: true }
      : level,
  );
}

function getChallengeProfile(levelNumber: number): ChallengeProfile {
  if (levelNumber <= 70) return 0;
  if (levelNumber % 10 === 0) return 3;
  if (levelNumber <= 100) return 1;
  if (levelNumber <= 200) return 2;
  return 3;
}
