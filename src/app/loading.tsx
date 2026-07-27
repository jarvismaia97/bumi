import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { Logo } from '@/components/Logo';
import { useThemeTokens } from '@/state/themeStore';
import { useI18n } from '@/i18n';

export default function LoadingScreen() {
  const theme = useThemeTokens();
  const { t } = useI18n();
  const [pulse] = useState(() => new Animated.Value(0));
  const [sweep] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const useNativeDriver = Platform.OS !== 'web';
    const animation = Animated.parallel([
      Animated.loop(
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
      ),
      Animated.loop(
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1100,
          easing: Easing.linear,
          useNativeDriver,
        })
      ),
    ]);

    animation.start();
    return () => animation.stop();
  }, [pulse, sweep]);

  const logoScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.06],
  });
  const sweepX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-42, 42],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}> 
      <View style={styles.logoWrap}>
        <Animated.View style={{ transform: [{ scale: logoScale }] }}>
          <Logo size={58} />
        </Animated.View>
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
