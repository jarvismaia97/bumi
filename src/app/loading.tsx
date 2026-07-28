import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Logo } from '@/components/Logo';
import { useThemeTokens } from '@/state/themeStore';
import { useI18n } from '@/i18n';

export default function LoadingScreen() {
  const theme = useThemeTokens();
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const [pulse] = useState(() => new Animated.Value(0));
  const [sweep] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const useNativeDriver = Platform.OS !== 'web';
    const beat = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 780,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 780,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver,
        }),
      ])
    );
    const shine = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver,
      })
    );

    // This screen is an indeterminate busy indicator, so unlike a flourish it cannot just stop:
    // freeze it and a slow sign-in is indistinguishable from a hung app. The beat is what says
    // "still working" and it survives on opacity, which stays put; the shine is travel and only
    // travel, so it goes. At 0.64Hz the fade is nowhere near a flash risk either.
    const animation = reduceMotion ? beat : Animated.parallel([beat, shine]);

    animation.start();
    return () => animation.stop();
  }, [pulse, sweep, reduceMotion]);

  const logoScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.06],
  });
  const logoOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 1],
  });
  const sweepX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-42, 42],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.logoWrap}>
        <Animated.View style={reduceMotion ? { opacity: logoOpacity } : { transform: [{ scale: logoScale }] }}>
          <Logo size={58} />
        </Animated.View>
        {reduceMotion ? null : (
          <Animated.View
            style={[
              styles.sweep,
              {
                backgroundColor: theme.bg,
                opacity: 0.25,
                transform: [{ translateX: sweepX }, { rotate: '18deg' }],
              },
            ]}
          />
        )}
      </View>
      <Text style={[styles.label, { color: theme.sub }]}>{t('game.preparing')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoWrap: {
    width: 74,
    height: 74,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sweep: { position: 'absolute', width: 16, height: 86 },
  label: { marginTop: 14, fontSize: 12, fontWeight: '700', letterSpacing: 0 },
});
