import type { Translate } from '@/i18n';
import type { LevelMeta } from './types';
import type { Mode } from '@/state/uiStore';

/**
 * The header, footer and win sheet each pick their copy from the same handful of facts, and
 * every one of those choices used to be a nested ternary inside the game screen — untestable,
 * and the most likely thing to rot as modes and copy change. They are plain functions here so
 * the wrong label in the wrong mode is a failing test rather than a screenshot.
 */
export interface LabelContext {
  mode: Mode;
  levelIndex: number;
  meta: LevelMeta | null;
  tutorialIndex: number;
  tutorialTotal: number;
  rows: number;
  columns: number;
  hints: number;
}

export function levelLabel(context: LabelContext, t: Translate): string {
  if (context.mode === 'daily') return t('game.today');
  if (context.mode === 'tutorial') {
    return t('game.tutorialLevel', { current: context.tutorialIndex + 1, total: context.tutorialTotal });
  }
  return t('game.level', { level: context.levelIndex + 1 });
}

export function difficultyLabel(context: LabelContext, t: Translate): string {
  if (context.mode === 'daily') return t('game.dailyLabel');
  if (context.mode === 'tutorial') return t('game.learnMeta', { rows: context.rows, columns: context.columns });
  if (!context.meta) return '';

  const extra = context.meta.milestone ? `${t('game.extraHard')} · ` : '';
  return `${extra}${t(`difficulty.${context.meta.label}`)} · ${context.meta.size}×${context.meta.size}`;
}

/** The first campaign level teaches the rules, so it never offers a way to skip them. */
export function isFirstCampaignLevel(context: LabelContext): boolean {
  return context.mode === 'campaign' && context.levelIndex === 0;
}

export function hintLabel(context: LabelContext, t: Translate): string {
  if (context.mode === 'tutorial') return t('game.hint');
  if (isFirstCampaignLevel(context)) return t('game.noHint');
  return t('game.hintWithCount', { count: context.hints });
}

export function isHintDisabled(context: LabelContext, won: boolean): boolean {
  if (won) return true;
  // The tutorial hands out hints freely: being stuck there is worse than being helped.
  if (context.mode === 'tutorial') return false;
  return isFirstCampaignLevel(context) || context.hints <= 0;
}

export function nextLabel(mode: Mode, t: Translate): string {
  return mode === 'daily' ? t('win.backToMenu') : t('win.nextLevel');
}
