// Relative, not the `@/` alias: this module is reached from api/share.ts, and Vercel's
// function builder compiles each file without reading tsconfig paths. See share.paths.test.ts.
import { getDailyStreak } from './daily';
import { isStreakMilestone, goalsCompletedBy } from './goals';
import { isMilestoneLevel } from './hints';
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

/**
 * The day a `?daily=` link names, or null when it is not a day this app will open.
 *
 * A date that has not arrived is rejected alongside the malformed ones. The archive already
 * greys future days out, but a link reaches `startDaily` without passing the archive, and the
 * win that followed wrote that key into `dailyCompletionDates` — where it counts towards the
 * monthly goal, can pay the monthly hints, and then syncs to the server as a day that was
 * played. Anyone could hand-edit the query string; the day after tomorrow is not a puzzle.
 *
 * "Has not arrived" is judged a day wide, not on this clock, because the clock asking is rarely
 * the clock that wrote the key. A player in Tokyo shares their genuine today and it reaches
 * Los Angeles seventeen hours behind, and the share card renders at UTC on Vercel where nobody
 * lives at all — judged locally, each of those turns down a real day, and the reader silently
 * gets some other board than the one the link was about. The largest real offset is UTC+14, so
 * a day of allowance accepts every honest key while still refusing a date nobody is standing in.
 *
 * `now` is a parameter so the rule can be pinned to a fixed day in a test rather than to
 * whatever day the suite happens to run on.
 */
const MAX_TIMEZONE_LEAD_MS = 24 * 60 * 60 * 1000;

export function getDailyChallengeDateKey(value: unknown, now: Date = new Date()): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || !/^\d{8}$/.test(raw)) return null;

  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;

  const furthestToday = new Date(now.getTime() + MAX_TIMEZONE_LEAD_MS);
  return date > new Date(furthestToday.getFullYear(), furthestToday.getMonth(), furthestToday.getDate()) ? null : raw;
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

export interface DailySolve {
  /** The puzzle's own day. The archive and shared links mean it is not always today. */
  dateKey: string;
  /** Days already on file, as they stand *before* this solve is written. */
  recordedDates: readonly string[];
  /** Days a freeze covered: they lengthen the run and count towards nothing else. */
  freezeDates: readonly string[];
}

export interface DailyOutcome {
  /** The day was already recorded, so this solve closed nothing and was paid nothing. */
  replay: boolean;
  weeklyClosed: boolean;
  monthlyClosed: boolean;
  /** The run counting this solve — the number the win sheet is about to show. */
  streak: number;
  streakMilestone: boolean;
}

/**
 * What a daily solve was worth, the way `resolveCampaignSolve` answers that for a level.
 *
 * The streak is computed here from the recorded days with this one appended, rather than read
 * back off the store once the solve is written. The screen used to read it from the render that
 * preceded the write, which is the run *without* today: a player arriving at thirty was asked
 * whether twenty-nine was a milestone, got nothing, and was handed the gold the next evening at
 * thirty-one. Every milestone is sparse and far apart, so every one of them landed on the wrong
 * day. Appending the day to a list already in hand is also the answer that does not depend on
 * when the store's write lands or on whether it deduplicated one — and it is a pure function,
 * which is what makes the thirtieth day a test rather than a claim.
 *
 * A day already on file celebrates nothing. The store refuses to pay a second time for it, so a
 * replay that still threw gold would be congratulating the player for a reward they did not get.
 */
export function resolveDailySolve({ dateKey, recordedDates, freezeDates }: DailySolve, now: Date = new Date()): DailyOutcome {
  const replay = recordedDates.includes(dateKey);
  const closed = goalsCompletedBy(recordedDates, dateKey, now);
  const streak = getDailyStreak([...recordedDates, dateKey, ...freezeDates], now);

  return {
    replay,
    weeklyClosed: closed.weekly,
    monthlyClosed: closed.monthly,
    streak,
    streakMilestone: !replay && isStreakMilestone(streak),
  };
}

/**
 * Whether the win sheet may promise the milestone hint — which it may only when `markSolved`
 * has just paid one.
 *
 * The sheet used to decide this by looking the level up in `solvedMap` after marking it, where
 * a first solve and a replay are the same entry, so replaying any tenth level promised a hint
 * the balance never received. `wasNewSolve` is what `markSolved` returned, and the level rule is
 * the store's own `isMilestoneLevel` rather than the catalogue's `milestone` flag: the two agree
 * today because the catalogue is built from this predicate, and asking the payer directly means
 * the promise cannot come apart from the payment if that ever stops being true.
 */
export function showsMilestoneHintReward(levelIndex: number, wasNewSolve: boolean): boolean {
  return wasNewSolve && isMilestoneLevel(levelIndex);
}
