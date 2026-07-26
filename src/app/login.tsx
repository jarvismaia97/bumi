import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleMark } from '@/components/GoogleMark';
import { Logo } from '@/components/Logo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/state/authStore';
import { useThemeTokens } from '@/state/themeStore';
import { useI18n } from '@/i18n';

export default function LoginScreen() {
  const theme = useThemeTokens();
  const signInWithGoogle = useAuthStore(s => s.signInWithGoogle);
  const signInWithApple = useAuthStore(s => s.signInWithApple);
  const authError = useAuthStore(s => s.error);
  const [submitting, setSubmitting] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const appleEnabled = process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED === 'true';

  useEffect(() => {
    if (Platform.OS !== 'ios' || !appleEnabled) return;
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, [appleEnabled]);

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

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Logo size={54} />
      <Text style={[styles.title, { color: theme.text }]}>Bumi</Text>
      <Text style={[styles.sub, { color: theme.sub }]}>
        {t('auth.description')}
      </Text>

      <Pressable
        disabled={submitting}
        style={({ pressed }) => [
          styles.signInButton,
          { backgroundColor: theme.accent, opacity: submitting || pressed ? 0.78 : 1 },
        ]}
        onPress={onSignIn}
      >
        <GoogleMark size={18} />
        <Text style={styles.signInText}>{submitting ? t('auth.opening') : t('auth.signInGoogle')}</Text>
      </Pressable>

      {appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={8}
          style={styles.appleButton}
          onPress={() => onAppleSignIn().catch(() => {})}
        />
      ) : null}

      {authError ? <Text style={styles.error}>{authError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 28 },
  title: { fontSize: 36, fontWeight: '800', letterSpacing: 0 },
  sub: { fontSize: 14, lineHeight: 20, maxWidth: 320, textAlign: 'center', marginBottom: 10 },
  signInButton: { width: '100%', maxWidth: 300, borderRadius: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  appleButton: { width: '100%', maxWidth: 300, height: 48 },
  signInText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  error: { color: '#b03060', fontSize: 12, lineHeight: 17, maxWidth: 300, textAlign: 'center' },
});
