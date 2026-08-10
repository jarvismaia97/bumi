import { DIFFS } from './difficulty';
import { genUniqueLevel } from './generateUnique';
import type { DifficultyTier, Level } from './types';

export type TrainingTier = Pick<DifficultyTier, 'label' | 'size' | 'maxArea' | 'hard' | 'clues'>;

/**
 * What training offers, taken from `DIFFS` rather than restated. The campaign names six
 * difficulties and spends several rows climbing through each; a player choosing one is choosing
 * the name, so each name contributes its last row — the hardest board that name covers, which
 * is what someone asking for `hard` means by it.
 *
 * Deriving instead of listing means a retuned campaign retunes training with it, and there is
 * no second definition of what `expert` is to drift out of step.
 */
export const TRAINING_TIERS: readonly TrainingTier[] = Object.values(
  DIFFS.reduce<Record<string, TrainingTier>>((byLabel, tier) => {
    byLabel[tier.label] = { label: tier.label, size: tier.size, maxArea: tier.maxArea, hard: tier.hard, clues: tier.clues };
    return byLabel;
  }, {}),
);

/**
 * What a guest may pick. The two gentlest names, which is enough to learn the rule on and to
 * decide whether the game is for you — the point of training being open at all.
 *
 * The rest asks for an account, and the ask is honest here in a way it would not be if training
 * were closed outright: signing in unlocks something on the spot rather than only promising to
 * remember things later. It still records nothing, so this trades no progress for the account.
 */
const GUEST_TIER_LABELS = ['easy', 'medium'] as const;

export function isTierLocked(tier: TrainingTier, isSignedIn: boolean): boolean {
  if (isSignedIn) return false;
  return !(GUEST_TIER_LABELS as readonly string[]).includes(tier.label);
}

/** Any seed at all, since nothing has to reproduce it. Injectable so a test can pin one. */
function looseSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/**
 * A puzzle at that difficulty, from a seed nothing keeps. The campaign's levels are a frozen
 * catalogue and the daily's seed is its date, because both have to be the same board for
 * everyone; training is the one mode where the point is that it never repeats.
 *
 * `clueTarget` comes along because it is half of what a difficulty name means — the same board
 * size at half the piece count is a different puzzle — while `refine` deliberately does not:
 * it costs about 100ms hill-climbing clue positions, which the baked catalogue can afford at
 * build time and a tap cannot.
 */
export function generateTrainingLevel(tier: TrainingTier, seed: number = looseSeed()): Level {
  return genUniqueLevel(seed, tier.size, tier.maxArea, tier.hard, 0, { clueTarget: tier.clues[1] });
}
