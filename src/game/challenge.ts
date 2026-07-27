// Relative, not the `@/` alias: this module is reached from api/share.ts, and Vercel's
// function builder compiles each file without reading tsconfig paths. See share.paths.test.ts.
import { translate, type SupportedLanguage } from '../i18n/messages';

export function getChallengeLevelIndex(value: unknown, totalLevels: number): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const level = typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isInteger(level) || level < 1 || level > totalLevels) return null;
  return level - 1;
}

/**
 * `language` rides along so the link preview card is rendered in the language of whoever
 * shared it — the receiver's own device language is unknowable from a server-rendered card.
 */
export function createChallengeUrl(levelIndex: number, baseUrl: string, language?: SupportedLanguage): string {
  const level = levelIndex + 1;
  return `${baseUrl.replace(/\/$/, '')}/partilha/nivel/${level}${languageQuery(language)}`;
}

function languageQuery(language: SupportedLanguage | undefined): string {
  // Portuguese is the server's default, so only the other one needs saying.
  return language && language !== 'pt-PT' ? `?lang=${language}` : '';
}

export function getDailyChallengeDateKey(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || !/^\d{8}$/.test(raw)) return null;

  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? raw : null;
}

export function createDailyChallengeUrl(dateKey: string, baseUrl: string, language?: SupportedLanguage): string {
  const validDateKey = getDailyChallengeDateKey(dateKey);
  if (!validDateKey) throw new Error('Invalid daily challenge date');
  return `${baseUrl.replace(/\/$/, '')}/partilha/diario/${validDateKey}${languageQuery(language)}`;
}

export function createDailyResultMessage(
  dateKey: string,
  summary: string,
  streak: number,
  language: SupportedLanguage,
): string {
  const date = new Date(Number(dateKey.slice(0, 4)), Number(dateKey.slice(4, 6)) - 1, Number(dateKey.slice(6, 8)));
  const label = date.toLocaleDateString(language, { day: 'numeric', month: 'long' });
  const streakLabel = translate(language, streak === 1 ? 'menu.day' : 'menu.days');
  const title = translate(language, 'share.dailyTitleDated', { date: label });
  const streakLine = translate(language, 'share.resultStreak', { count: streak, label: streakLabel });
  return `${title}\n${summary}\n${streakLine}\n${translate(language, 'share.resultBeat')}`;
}
