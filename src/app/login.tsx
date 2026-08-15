import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { AppleSignInButton } from '@/components/AppleSignInButton';
import { GoogleMark } from '@/components/GoogleMark';
import { Logo } from '@/components/Logo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppleSignInOffered } from '@/lib/appleSignIn';
import { hitSlopFor } from '@/lib/touchTarget';
import { useAuthStore } from '@/state/authStore';
import { useSemanticTokens, useThemeTokens } from '@/state/themeStore';
import { useI18n } from '@/i18n';

// Matches the one on the privacy screen: same box, same slop carrying it to the 44pt floor.
const BACK_BUTTON_SIZE = 38;
const BACK_BUTTON_HIT_SLOP = hitSlopFor({ width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE });

export default function LoginScreen() {
  const theme = useThemeTokens();
  const semantic = useSemanticTokens();
  const signInWithGoogle = useAuthStore(s => s.signInWithGoogle);
  const signInWithApple = useAuthStore(s => s.signInWithApple);
  const authError = useAuthStore(s => s.error);
  const [submitting, setSubmitting] = useState(false);
  const appleOffered = useAppleSignInOffered();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  async function onSignIn() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } finally {
      setSubmitting(false);
    }
  }

  async function onAppleSignIn() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await signInWithApple();
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * The only screen in the app that insists, and until now the only one nothing could be left.
   * It is reached by tapping a campaign level that wants an account, so backing out costs that
   * level — the dialog says which door is closing, and names what is still open rather than just
   * asking twice.
   */
  function leave() {
    // A deep link can land here with nothing behind it, and `back()` on an empty stack goes
    // nowhere: the way out has to hold even when there is no way back.
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  function confirmLeave() {
    // `Alert.alert` is an empty function under react-native-web, so asking there would show
    // nothing and do nothing — a way out that silently is not one. The browser's own dialog
    // asks the same question.
    if (Platform.OS === 'web') {
      if (window.confirm(`${t('auth.leaveTitle')}\n\n${t('auth.leaveBody')}`)) leave();
      return;
    }

    Alert.alert(t('auth.leaveTitle'), t('auth.leaveBody'), [
      { text: t('settings.cancel'), style: 'cancel' },
      { text: t('auth.leaveConfirm'), onPress: leave },
    ]);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <AnimatedPressable
        accessibilityRole="button"
        feedback="icon"
        style={[styles.back, { top: insets.top + 12, borderColor: theme.gridSep, backgroundColor: theme.surface }]}
        hitSlop={BACK_BUTTON_HIT_SLOP}
        onPress={confirmLeave}
        accessibilityLabel={t('a11y.back')}
      >
        <ArrowLeft size={19} color={theme.text} strokeWidth={2.3} />
      </AnimatedPressable>
      <Logo size={54} />
      <Text style={[styles.title, { color: theme.text }]}>Bumi</Text>
      <Text style={[styles.sub, { color: theme.sub }]}>
        {t('auth.description')}
      </Text>

      <AnimatedPressable
        accessibilityRole="button"
        disabled={submitting}
        style={[styles.signInButton, { backgroundColor: theme.accent, opacity: submitting ? 0.78 : 1 }]}
        onPress={onSignIn}
      >
        <GoogleMark size={18} />
        <Text style={[styles.signInText, { color: theme.onAccent }]}>{submitting ? t('auth.opening') : t('auth.signInGoogle')}</Text>
      </AnimatedPressable>

      {appleOffered ? (
        <AppleSignInButton height={48} style={styles.appleButton} onPress={() => onAppleSignIn().catch(() => {})} />
      ) : null}

      {authError ? <Text style={[styles.error, { color: semantic.danger }]}>{authError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 28 },
  // Absolute, because the screen centres its column and the way out belongs at the corner
  // rather than in the middle of the argument for signing in.
  back: { position: 'absolute', left: 20, width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE, borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 36, fontWeight: '800', letterSpacing: 0 },
  sub: { fontSize: 14, lineHeight: 20, maxWidth: 320, textAlign: 'center', marginBottom: 10 },
  signInButton: { width: '100%', maxWidth: 300, borderRadius: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  appleButton: { width: '100%', maxWidth: 300, height: 48 },
  signInText: { fontSize: 15, fontWeight: '700' },
  error: { fontSize: 12, lineHeight: 17, maxWidth: 300, textAlign: 'center' },
});
