import { describe, expect, it } from 'vitest';
import { checkWin, rectOk } from './geometry';
import { isCampaignLevelUnlocked, requiresCampaignLogin } from './access';
import { TUTORIAL_LEVELS } from './levels';
import { translate } from '@/i18n/messages';
import type { PlacedRect } from './types';

/** The lesson copy names the clue values, so the two can silently drift apart. */
const LESSON_KEYS = ['tutorial.lesson1', 'tutorial.lesson2', 'tutorial.lesson3'] as const;

describe('tutorial levels', () => {
  it('has one level per lesson of copy', () => {
    // TutorialOverlay indexes its lessons by the same number, falling back to the last one,
    // so a fourth level would silently repeat the third lesson's text.
    expect(TUTORIAL_LEVELS).toHaveLength(LESSON_KEYS.length);
  });

  it('is solvable exactly as authored', () => {
    for (const level of TUTORIAL_LEVELS) {
      const solution = level.solution as PlacedRect[];
      expect(solution.every(rect => rectOk(rect, level))).toBe(true);
      expect(checkWin(solution, level)).toBe(true);
    }
  });

  it('covers every square, so there is no unreachable win', () => {
    for (const level of TUTORIAL_LEVELS) {
      const rows = level.rows ?? level.size;
      const columns = level.columns ?? level.size;
      const covered = level.solution.reduce((total, r) => total + (r.r2 - r.r1) * (r.c2 - r.c1), 0);
      expect(covered).toBe(rows * columns);
    }
  });

  it('grows from one piece to three', () => {
    expect(TUTORIAL_LEVELS.map(level => level.solution.length)).toEqual([1, 1, 3]);
  });

  it('teaches with the clue values the copy talks about', () => {
    // "Arrasta sobre o 2", "O 4 ocupa quatro casas", "2 em linha, 4 em quadrado, 3 em coluna".
    for (const [index, key] of LESSON_KEYS.entries()) {
      const body = translate('pt-PT', `${key}.body`);
      for (const clue of TUTORIAL_LEVELS[index].clues) {
        expect(body).toContain(String(clue.v));
      }
    }
  });

  it('leads into a campaign level the player can actually open', () => {
    // The last lesson hands off to startCampaign(0); a locked or gated level 1 would
    // strand a brand new player at the end of the tutorial.
    expect(isCampaignLevelUnlocked(0, {})).toBe(true);
    expect(requiresCampaignLogin(0, false)).toBe(false);
  });
});
