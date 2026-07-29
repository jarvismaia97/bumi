import { Platform, Share } from 'react-native';
import { translate, type SupportedLanguage } from '@/i18n/messages';
import type { ShareResult } from '@/lib/challengeShare';

/**
 * Handing out the code is how a player consents to being on someone's board, so it goes out
 * through the same share sheet as a challenge link rather than a silent clipboard write: the
 * player sees exactly what leaves the device, and to whom.
 */
export async function shareFriendCode(code: string, language: SupportedLanguage): Promise<ShareResult> {
  const message = `${translate(language, 'leaderboard.shareMessage', { code })}\nhttps://www.jogarbumi.pt`;

  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ title: translate(language, 'leaderboard.title'), text: message });
      return 'shared';
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(code);
      return 'copied';
    }
    return 'unavailable';
  }

  await Share.share({ message });
  return 'shared';
}
