import { describe, expect, it } from 'vitest';
import { hintLabel, type LabelContext } from './labels';
import { translate } from '@/i18n/messages';
import { isTierLocked, TRAINING_TIERS } from './training';

const t = (key: string, variables?: Record<string, number | string>) => translate('pt-PT', key, variables);
const tierOf = (label: string) => TRAINING_TIERS.find(tier => tier.label === label)!;

describe('what a guest may train on', () => {
  it('opens the two gentlest names, which is enough to decide if the game is for you', () => {
    expect(isTierLocked(tierOf('easy'), false)).toBe(false);
    expect(isTierLocked(tierOf('medium'), false)).toBe(false);
  });

  it('asks for an account for the rest', () => {
    for (const label of ['hard', 'expert', 'master', 'legend']) {
      expect(isTierLocked(tierOf(label), false), label).toBe(true);
    }
  });

  it('locks nothing once signed in', () => {
    for (const tier of TRAINING_TIERS) {
      expect(isTierLocked(tier, true), tier.label).toBe(false);
    }
  });

  it('leaves a guest something to play, which is the point of training being open', () => {
    expect(TRAINING_TIERS.some(tier => !isTierLocked(tier, false))).toBe(true);
  });
});

describe('the hint button', () => {
  /** Only `mode` and `hints` decide the label; the rest of the context is scenery. */
  function context(overrides: Partial<LabelContext> = {}): LabelContext {
    return {
      mode: 'training',
      levelIndex: 0,
      meta: null,
      tutorialIndex: 0,
      tutorialTotal: 3,
      rows: 8,
      columns: 8,
      hints: 3,
      ...overrides,
    };
  }

  it('does not count down a balance training never spends', () => {
    expect(hintLabel(context(), t)).toBe(t('game.hint'));
    expect(hintLabel(context(), t)).not.toContain('3');
  });

  it('still counts in the campaign, where a hint costs one', () => {
    expect(hintLabel(context({ mode: 'campaign', levelIndex: 5 }), t)).toBe(
      t('game.hintWithCount', { count: 3 }),
    );
  });

  it('reads the same at zero in training, since zero is not a limit there', () => {
    expect(hintLabel(context({ hints: 0 }), t)).toBe(t('game.hint'));
  });
});
