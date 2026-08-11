import * as AppleAuthentication from 'expo-apple-authentication';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { useAppleSignInAvailable } from '@/lib/appleSignIn';
import { useAppearance } from '@/state/appearanceStore';
import { useI18n } from '@/i18n';

/**
 * Apple's own button on iOS, and a hand-built one everywhere else.
 *
 * `expo-apple-authentication` ships no component outside iOS, so the web and Android builds
 * cannot render Apple's. Apple's Human Interface Guidelines allow a custom button provided it
 * keeps the mark, the wording and the black-or-white treatment, which is what this is: same
 * height, same corner radius, same two colourways picked by appearance.
 *
 * Both call the same `signInWithApple`, which routes itself — native sheet on iOS, browser
 * round trip elsewhere.
 */
export function AppleSignInButton({
  onPress,
  height,
  style,
}: {
  onPress: () => void;
  height: number;
  style?: StyleProp<ViewStyle>;
}) {
  const nativeAvailable = useAppleSignInAvailable();
  const appearance = useAppearance();
  const { t } = useI18n();

  if (nativeAvailable) {
    return (
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={
          appearance === 'dark'
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={height / 2}
        style={[{ height }, style]}
        onPress={onPress}
      />
    );
  }

  // Apple's two colourways, and the same inversion rule the native button follows.
  const dark = appearance === 'dark';
  const background = dark ? '#ffffff' : '#000000';
  const ink = dark ? '#000000' : '#ffffff';

  return (
    <AnimatedPressable
      accessibilityRole="button"
      feedback="control"
      style={[styles.button, { height, borderRadius: height / 2, backgroundColor: background }, style]}
      onPress={onPress}
      accessibilityLabel={t('auth.signInApple')}
    >
      <View style={styles.content}>
        <Text style={[styles.mark, { color: ink, fontSize: height * 0.46 }]}></Text>
        <Text style={[styles.label, { color: ink }]} numberOfLines={1}>{t('auth.signInApple')}</Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  // Nudged up because the glyph's own bounding box sits low against cap height.
  mark: { marginTop: -3 },
  label: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
});
