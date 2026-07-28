import { describe, expect, it } from 'vitest';
import { translate, type SupportedLanguage } from '@/i18n/messages';
import { difficultyLabel, hintLabel, isHintDisabled, levelLabel, nextLabel, type LabelContext } from './labels';

const t = (language: SupportedLanguage = 'pt-PT') => (key: string, vars?: Record<string, number | string>) =>
  translate(language, key, vars);

function context(overrides: Partial<LabelContext> = {}): LabelContext {
  return {
    mode: 'campaign',
    levelIndex: 41,
    meta: { label: 'medium', size: 8, maxArea: 9, hard: 0, clueTarget: 20, clueRange: [18, 22], challenge: 1, milestone: false },
    tutorialIndex: 0,
    tutorialTotal: 3,
    rows: 5,
    columns: 5,
    hints: 3,
    ...overrides,
  };
}

describe('level label', () => {
  it('numbers a campaign level from one, not zero', () => {
    expect(levelLabel(context(), t())).toBe('Nível 42');
  });

  it('names the day rather than a number for the daily', () => {
    expect(levelLabel(context({ mode: 'daily' }), t())).toBe('Hoje');
  });

  it('counts tutorial lessons out of the total', () => {
    expect(levelLabel(context({ mode: 'tutorial', tutorialIndex: 1 }), t())).toBe('Tutorial 2/3');
  });

  it('follows the chosen language', () => {
    expect(levelLabel(context(), t('en'))).toBe('Level 42');
  });
});

describe('difficulty label', () => {
  it('reads difficulty and board size for a campaign level', () => {
    expect(difficultyLabel(context(), t())).toBe('Médio · 8×8');
  });

  it('marks a milestone level as the harder one it is', () => {
    const label = difficultyLabel(context({ meta: { ...context().meta!, milestone: true } }), t());
    expect(label.startsWith('Extra difícil · ')).toBe(true);
  });

  it('falls back to empty rather than a broken string when there is no level meta', () => {
    expect(difficultyLabel(context({ meta: null }), t())).toBe('');
  });
});

describe('hints', () => {
  it('never offers a hint on the first campaign level, which teaches the rules', () => {
    const first = context({ levelIndex: 0 });
    expect(hintLabel(first, t())).toBe('Sem dica');
    expect(isHintDisabled(first, false)).toBe(true);
  });

  it('shows the balance everywhere else', () => {
    expect(hintLabel(context({ hints: 4 }), t())).toBe('Dica · 4');
  });

  it('keeps the tutorial hint available even at a zero balance', () => {
    // Being stuck in the tutorial is worse than being helped through it.
    expect(isHintDisabled(context({ mode: 'tutorial', hints: 0 }), false)).toBe(false);
  });

  it('disables the hint once the level is won', () => {
    expect(isHintDisabled(context({ hints: 5 }), true)).toBe(true);
  });

  it('disables the hint at an empty balance', () => {
    expect(isHintDisabled(context({ hints: 0 }), false)).toBe(true);
  });
});

describe('next label', () => {
  it('sends the daily back to the menu and the campaign onward', () => {
    expect(nextLabel('daily', t())).toBe('Voltar ao menu');
    expect(nextLabel('campaign', t())).toBe('Próximo nível');
  });
});
