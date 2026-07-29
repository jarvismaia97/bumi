import { createDailyChallengeUrl, getDailyChallengeDateKey } from '../game/challenge';
import { translate, type SupportedLanguage } from '../i18n/messages';

/** One hook per key, picked by date so the same day always yields the same post. */
const HOOK_KEYS = ['social.hook1', 'social.hook2', 'social.hook3', 'social.hook4'];

export interface DailySocialContent {
  dateKey: string;
  hook: string;
  title: string;
  caption: string;
  challengeUrl: string;
}

export function createDailySocialContent(dateKey: string, baseUrl: string, language: SupportedLanguage = 'pt-PT'): DailySocialContent {
  const validDateKey = getDailyChallengeDateKey(dateKey);
  if (!validDateKey) throw new Error('Invalid daily challenge date');

  const date = new Date(Number(dateKey.slice(0, 4)), Number(dateKey.slice(4, 6)) - 1, Number(dateKey.slice(6, 8)));
  const label = date.toLocaleDateString(language, { day: 'numeric', month: 'long' });
  const hook = translate(language, HOOK_KEYS[Number(dateKey) % HOOK_KEYS.length]);
  // The link carries the language too, so the card the post links to matches the post.
  const challengeUrl = createDailyChallengeUrl(dateKey, baseUrl, language);

  return {
    dateKey,
    hook,
    title: translate(language, 'share.dailyTitleDated', { date: label }),
    caption: `${hook}\n\n${translate(language, 'social.caption')}\n${challengeUrl}\n\n${translate(language, 'social.hashtags')}`,
    challengeUrl,
  };
}
