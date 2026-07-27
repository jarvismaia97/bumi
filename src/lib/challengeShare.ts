import { Platform, Share } from 'react-native';
import { createChallengeUrl, createDailyChallengeUrl, createDailyResultMessage } from '@/game/challenge';

// See auth-client.ts: window exists on native but window.location does not.
const productionUrl =
  Platform.OS === 'web'
    ? window.location.origin
    : process.env.EXPO_PUBLIC_SHARE_URL ?? process.env.EXPO_PUBLIC_AUTH_API_URL ?? 'https://www.jogarbumi.pt';

export type ShareResult = 'shared' | 'copied' | 'unavailable';

export async function shareChallenge(levelIndex: number): Promise<ShareResult> {
  const url = createChallengeUrl(levelIndex, productionUrl);
  const message = `Bumi · Nível ${levelIndex + 1}\nConsegues resolver este puzzle sem dicas?`;
  return share(message, url, `Bumi · Nível ${levelIndex + 1}`);
}

export async function shareDailyChallenge(dateKey: string): Promise<ShareResult> {
  const url = createDailyChallengeUrl(dateKey, productionUrl);
  const label = formatDailyDate(dateKey);
  const message = `Bumi · Desafio diário ${label}\nConsegues resolver antes de mim?`;
  return share(message, url, 'Bumi · Desafio diário');
}

export async function shareDailyResult(dateKey: string, summary: string, streak: number): Promise<ShareResult> {
  const url = createDailyChallengeUrl(dateKey, productionUrl);
  return share(createDailyResultMessage(dateKey, summary, streak), url, 'Resultado do desafio diário Bumi');
}

function formatDailyDate(dateKey: string): string {
  const date = new Date(Number(dateKey.slice(0, 4)), Number(dateKey.slice(4, 6)) - 1, Number(dateKey.slice(6, 8)));
  return date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' });
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
