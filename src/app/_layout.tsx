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
import { LEVEL_META } from '@/game/levels';
import { useChallengeStore } from '@/state/challengeStore';
import { configureNotificationHandler, setDailyReminder } from '@/lib/dailyReminder';
import { useProgressStore } from '@/state/progressStore';
import { useI18n } from '@/i18n';

export default function RootLayout() {
  const init = useAuthStore(s => s.init);
  const loading = useAuthStore(s => s.loading);
  const user = useAuthStore(s => s.user);
  const linkingUrl = Linking.useLinkingURL();
  const setPendingChallenge = useChallengeStore(s => s.setPendingChallenge);
  const setPendingDailyChallenge = useChallengeStore(s => s.setPendingDailyChallenge);
  const dailyReminderEnabled = useProgressStore(s => s.dailyReminderEnabled);
  const appearance = useAppearance();
  const { language } = useI18n();

  useEffect(() => {
    init();
    initProgressSync();
    configureNotificationHandler().catch(() => {});
  }, [init]);

  // The reminder is scheduled once with its text baked in, so a language change would
  // otherwise leave the player with a notification in the language they just left.
  useEffect(() => {
    if (!dailyReminderEnabled) return;
    setDailyReminder(true, language, { promptForPermission: false }).catch(() => {});
  }, [dailyReminderEnabled, language]);

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
          <title>Bumi</title>
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="Bumi" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <link rel="manifest" href="/site.webmanifest" />
          <meta name="theme-color" content="#a8b9d8" />
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
