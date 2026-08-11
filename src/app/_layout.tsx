import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { AppState, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { BootLogo } from '@/components/BootLogo';
import { useAppearance } from '@/state/appearanceStore';
import { useSemanticTokens, useThemeTokens } from '@/state/themeStore';
import { useAuthStore } from '@/state/authStore';
import { initProgressSync } from '@/state/progressSync';
import { getChallengeLevelIndex, getDailyChallengeDateKey } from '@/game/challenge';
import { getDailyDateKey, getDailyStreak } from '@/game/daily';
import { LEVEL_META } from '@/game/levels';
import { useChallengeStore } from '@/state/challengeStore';
import { configureNotificationHandler, onNotificationOpened, refreshDailyReminders, REMINDER_SCREEN } from '@/lib/dailyReminder';
import { registerPushToken } from '@/lib/pushToken';
import { useProgressStore } from '@/state/progressStore';
import { markHydrated } from '@/lib/hydration';
import { useI18n } from '@/i18n';

// The static document is rendered once and pinned to Portuguese by the hydration gate (see
// src/lib/hydration.ts), so its metadata is Portuguese to match.
const SITE_URL = 'https://www.jogarbumi.pt';
const SITE_DESCRIPTION =
  'Divide a grelha em retângulos e resolve o puzzle. Centenas de níveis, um desafio diário e o progresso guardado entre dispositivos.';

// Expo Router renders this instead of the segment when a render throws. Exported from the root
// layout, so it covers every screen the app has.
export { AppErrorBoundary as ErrorBoundary };

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
  const streakFreezes = useProgressStore(s => s.streakFreezes);
  const claimStreakFreeze = useProgressStore(s => s.claimStreakFreeze);
  const appearance = useAppearance();
  const theme = useThemeTokens();
  const semantic = useSemanticTokens();
  const { language } = useI18n();

  // The navigator paints its own ground under every screen, and left alone it is react-navigation's
  // light `rgb(242,242,242)` whatever the player picked. The screens cover it, so it only showed
  // where they do not: behind a push transition and in the overscroll past the end of a scroll.
  const navigationTheme = useMemo(
    () => ({
      ...(appearance === 'dark' ? DarkTheme : DefaultTheme),
      colors: {
        primary: theme.accent,
        background: theme.bg,
        card: theme.surface,
        text: theme.text,
        border: theme.gridSep,
        notification: semantic.danger,
      },
    }),
    [appearance, theme, semantic],
  );

  useEffect(() => {
    // First effect after mount: from here the tree may render the device's language and
    // appearance, because hydration has already matched the static markup. See
    // src/lib/hydration.ts.
    markHydrated();
    init();
    initProgressSync();
    configureNotificationHandler().catch(() => {});

    // `init` returns immediately once the server has answered, so this only does anything for a
    // launch that could not reach it — an app opened offline finds out who it belongs to as
    // soon as it comes back, instead of looking signed out until it is restarted.
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') init();
    });
    return () => subscription.remove();
  }, [init]);

  // Registered per signed-in session, since the token is what a friend's add is delivered to.
  // It asks for no permission of its own: a player who never allowed notifications simply is
  // not reachable, which is the quieter half of the trade.
  useEffect(() => {
    if (!user) return;
    registerPushToken().catch(() => {});
  }, [user]);

  // The reminder is scheduled once with its text baked in, so a language change would
  // otherwise leave the player with a notification in the language they just left.
  // Re-armed on launch and whenever the day's state changes: the schedule depends on
  // whether today is already played and on how long the streak is, and iOS only lets the
  // app schedule while it is running.
  /**
   * A missed day is covered before anything else reads the streak, so the reminder below and
   * every screen agree on one number. Idempotent, and it runs again when the app comes back:
   * a phone left open overnight crosses midnight without remounting anything.
   */
  useEffect(() => {
    claimStreakFreeze();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') claimStreakFreeze();
    });
    return () => subscription.remove();
  }, [claimStreakFreeze]);

  useEffect(() => {
    if (!dailyReminderEnabled) return;
    refreshDailyReminders({
      enabled: true,
      language,
      dailyDoneToday: dailyCompletedDate === getDailyDateKey(),
      dailyStreak: getDailyStreak([...dailyCompletionDates, ...streakFreezes]),
      promptForPermission: false,
    }).catch(() => {});
  }, [dailyReminderEnabled, language, dailyCompletedDate, dailyCompletionDates, streakFreezes]);

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
            <ThemeProvider value={navigationTheme}>
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
            </ThemeProvider>
            <BootLogo />
          </BottomSheetModalProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </>
  );
}
