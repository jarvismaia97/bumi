import { Platform, Share } from 'react-native';
import { createChallengeUrl, createDailyChallengeUrl, createDailyResultMessage } from '@/game/challenge';
import { translate, type SupportedLanguage } from '@/i18n/messages';

// See auth-client.ts: native has a window without location, node static
// rendering is 'web' with no window at all. Both guards are required.
const productionUrl =
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.origin
    : process.env.EXPO_PUBLIC_SHARE_URL ?? process.env.EXPO_PUBLIC_AUTH_API_URL ?? 'https://www.jogarbumi.pt';

export type ShareResult = 'shared' | 'copied' | 'unavailable';

export async function shareChallenge(levelIndex: number, language: SupportedLanguage): Promise<ShareResult> {
  const url = createChallengeUrl(levelIndex, productionUrl, language);
  const title = translate(language, 'share.levelTitle', { level: levelIndex + 1 });
  return share(`${title}\n${translate(language, 'share.levelBody')}`, url, title);
}

export async function shareDailyChallenge(dateKey: string, language: SupportedLanguage): Promise<ShareResult> {
  const url = createDailyChallengeUrl(dateKey, productionUrl, language);
  const title = translate(language, 'share.dailyTitleDated', { date: formatDailyDate(dateKey, language) });
  return share(`${title}\n${translate(language, 'share.dailyBody')}`, url, translate(language, 'share.dailyTitle'));
}

export async function shareDailyResult(dateKey: string, summary: string, streak: number, language: SupportedLanguage): Promise<ShareResult> {
  const url = createDailyChallengeUrl(dateKey, productionUrl, language);
  return share(createDailyResultMessage(dateKey, summary, streak, language), url, translate(language, 'share.resultTitle'));
}

function formatDailyDate(dateKey: string, language: SupportedLanguage): string {
  const date = new Date(Number(dateKey.slice(0, 4)), Number(dateKey.slice(4, 6)) - 1, Number(dateKey.slice(6, 8)));
  return date.toLocaleDateString(language, { day: 'numeric', month: 'long' });
}

async function share(message: string, url: string, title: string): Promise<ShareResult> {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ title, text: message, url });
      return 'shared';
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${message}\n${url}`);
      return 'copied';
    }
    return 'unavailable';
  }

  await Share.share({ message: `${message}\n${url}` });
  return 'shared';
}
