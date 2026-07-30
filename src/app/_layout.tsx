import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BootLogo } from '@/components/BootLogo';
import { useAppearance } from '@/state/appearanceStore';
import { useAuthStore } from '@/state/authStore';
import { initProgressSync } from '@/state/progressSync';
import { getChallengeLevelIndex, getDailyChallengeDateKey } from '@/game/challenge';
import { getDailyDateKey, getDailyStreak } from '@/game/daily';
import { LEVEL_META } from '@/game/levels';
import { useChallengeStore } from '@/state/challengeStore';
import { configureNotificationHandler, onNotificationOpened, refreshDailyReminders, REMINDER_SCREEN } from '@/lib/dailyReminder';
import { useProgressStore } from '@/state/progressStore';
import { markHydrated, useI18n } from '@/i18n';

// The static document is rendered once and pinned to Portuguese by the hydration gate (see
// src/i18n/hydration.ts), so its metadata is Portuguese to match.
const SITE_URL = 'https://www.jogarbumi.pt';
const SITE_DESCRIPTION =
  'Divide a grelha em retângulos e resolve o puzzle. Centenas de níveis, um desafio diário e o progresso guardado entre dispositivos.';

export default function RootLayout() {
  const init = useAuthStore(s => s.init);
  const loading = useAuthStore(s => s.loading);
  const user = useAuthStore(s => s.user);
  const linkingUrl = Linking.useLinkingURL();
  const setPendingChallenge = useChallengeStore(s => s.setPendingChallenge);
  const setPendingDailyChallenge = useChallengeStore(s => s.setPendingDailyChallenge);
  const dailyReminderEnabled = useProgressStore(s => s.dailyReminderEnabled);
  const dailyCompletedDate = useProgressStore(s => s.dailyCompletedDate);
  const dailyCompletionDates = useProgressStore(s => s.dailyCompletionDates);
  const appearance = useAppearance();
  const { language } = useI18n();

  useEffect(() => {
    // First effect after mount: from here the tree may render the device's language, because
    // hydration has already matched the static markup. See src/i18n/hydration.ts.
    markHydrated();
    init();
    initProgressSync();
    configureNotificationHandler().catch(() => {});
  }, [init]);

  // The reminder is scheduled once with its text baked in, so a language change would
  // otherwise leave the player with a notification in the language they just left.
  // Re-armed on launch and whenever the day's state changes: the schedule depends on
  // whether today is already played and on how long the streak is, and iOS only lets the
  // app schedule while it is running.
  useEffect(() => {
    if (!dailyReminderEnabled) return;
    refreshDailyReminders({
      enabled: true,
      language,
      dailyDoneToday: dailyCompletedDate === getDailyDateKey(),
      dailyStreak: getDailyStreak(dailyCompletionDates),
      promptForPermission: false,
    }).catch(() => {});
  }, [dailyReminderEnabled, language, dailyCompletedDate, dailyCompletionDates]);

  // The reminder carries the screen it wants opened; without this the payload was written
  // and never read, so tapping it just landed on the menu like the app icon does.
  useEffect(() => {
    let teardown: (() => void) | undefined;
    onNotificationOpened(screen => {
      if (screen === REMINDER_SCREEN) setPendingDailyChallenge(getDailyDateKey());
    })
      .then(unsubscribe => {
        teardown = unsubscribe;
      })
      .catch(() => {});
    return () => teardown?.();
  }, [setPendingDailyChallenge]);

  useEffect(() => {
    if (!linkingUrl) return;
    const params = Linking.parse(linkingUrl).queryParams;
    const dailyChallenge = getDailyChallengeDateKey(params?.daily);
    if (dailyChallenge) {
      setPendingDailyChallenge(dailyChallenge);
      return;
    }
    const challenge = getChallengeLevelIndex(params?.challenge, LEVEL_META.length);
    if (challenge != null) setPendingChallenge(challenge);
  }, [linkingUrl, setPendingChallenge, setPendingDailyChallenge]);

  return (
    <>
      {/* Web-only PWA metadata. On iOS this renders a Handoff activity that needs
          `extra.router.origin`, which we do not want to advertise from the app. */}
      {Platform.OS === 'web' && (
        <Head>
          <title>Bumi · Puzzle de lógica</title>
          <meta name="description" content={SITE_DESCRIPTION} />
          <link rel="canonical" href={SITE_URL} />
          {/* Both spellings: Chrome deprecated the apple-prefixed one, iOS only knows it. */}
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="Bumi" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <link rel="manifest" href="/site.webmanifest" />
          <meta name="theme-color" content="#a8b9d8" />
          {/* Shared challenge links get their card from `api/share.ts`; this is the card for
              the bare domain, which is what people paste into a chat when they recommend it. */}
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content="Bumi" />
          <meta property="og:title" content="Bumi · Puzzle de lógica" />
          <meta property="og:description" content={SITE_DESCRIPTION} />
          <meta property="og:url" content={SITE_URL} />
          <meta property="og:image" content={`${SITE_URL}/share-card.png`} />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta property="og:locale" content="pt_PT" />
          <meta property="og:locale:alternate" content="en_GB" />
          <meta property="og:locale:alternate" content="es_ES" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="Bumi · Puzzle de lógica" />
          <meta name="twitter:description" content={SITE_DESCRIPTION} />
          <meta name="twitter:image" content={`${SITE_URL}/share-card.png`} />
          <style>{`
            html, body, #root {
              -webkit-user-select: none;
              user-select: none;
              -webkit-touch-callout: none;
            }
          `}</style>
        </Head>
      )}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <BottomSheetModalProvider>
            {/* `auto` would read the device appearance, which the in-app override can contradict. */}
            <StatusBar style={appearance === 'dark' ? 'light' : 'dark'} />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Protected guard={loading}>
                <Stack.Screen name="loading" />
              </Stack.Protected>
              <Stack.Protected guard={!loading}>
                <Stack.Screen name="index" />
              </Stack.Protected>
              <Stack.Protected guard={!loading && !user}>
                <Stack.Screen name="login" />
              </Stack.Protected>
            </Stack>
            <BootLogo />
          </BottomSheetModalProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </>
  );
}
