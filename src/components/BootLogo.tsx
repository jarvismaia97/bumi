import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useThemeTokens } from '@/state/themeStore';

type Direction = 'horizontal' | 'vertical';

type LogoSegmentProps = {
  build: Animated.Value;
  inputRange: [number, number, number, number];
  direction: Direction;
  fromX: number;
  fromY: number;
  stretch: number;
  style: object;
};

function LogoSegment({
  build,
  inputRange,
  direction,
  fromX,
  fromY,
  stretch,
  style,
}: LogoSegmentProps) {
  const opacity = build.interpolate({
    inputRange,
    outputRange: [0, 1, 1, 1],
    extrapolate: 'clamp',
  });
  const translateX = build.interpolate({
    inputRange,
    outputRange: [fromX, 0, 0, 0],
    extrapolate: 'clamp',
  });
  const translateY = build.interpolate({
    inputRange,
    outputRange: [fromY, 0, 0, 0],
    extrapolate: 'clamp',
  });
  const horizontalScale = build.interpolate({
    inputRange,
    outputRange: direction === 'horizontal' ? [0.08, stretch, 1, 1] : [1, 1, 1, 1],
    extrapolate: 'clamp',
  });
  const verticalScale = build.interpolate({
    inputRange,
    outputRange: direction === 'vertical' ? [0.08, stretch, 1, 1] : [1, 1, 1, 1],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.segment,
        style,
        {
          opacity,
          transform: [
            { translateX },
            { translateY },
            { scaleX: horizontalScale },
            { scaleY: verticalScale },
          ],
        },
      ]}
    />
  );
}

export function BootLogo() {
  const theme = useThemeTokens();
  const { width } = useWindowDimensions();
  const [visible, setVisible] = useState(true);
  const [build] = useState(() => new Animated.Value(0));
  const [exit] = useState(() => new Animated.Value(0));
  const sideTravel = Math.max(150, width / 2 + 58);

  useEffect(() => {
    const useNativeDriver = Platform.OS !== 'web';
    const animation = Animated.sequence([
      Animated.timing(build, {
        toValue: 1,
        duration: 2300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      }),
      Animated.delay(520),
      Animated.timing(exit, {
        toValue: 1,
        duration: 460,
        easing: Easing.in(Easing.cubic),
        useNativeDriver,
      }),
    ]);

    animation.start(({ finished }) => {
      if (finished) setVisible(false);
    });

    return () => animation.stop();
  }, [build, exit]);

  if (!visible) return null;

  const overlayOpacity = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const markScale = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] });
  const titleOpacity = build.interpolate({ inputRange: [0, 0.88, 1], outputRange: [0, 0, 1] });
  const titleTranslate = build.interpolate({ inputRange: [0, 0.88, 1], outputRange: [8, 8, 0] });

  return (
    <Animated.View style={[styles.overlay, { backgroundColor: theme.bg, opacity: overlayOpacity }]}>
      <Animated.View style={[styles.mark, { transform: [{ scale: markScale }] }]}>
        <LogoSegment
          build={build}
          inputRange={[0, 0.14, 0.26, 0.32]}
          direction="horizontal"
          fromX={-sideTravel}
          fromY={0}
          stretch={4.2}
          style={styles.base}
        />
        <LogoSegment
          build={build}
          inputRange={[0.22, 0.38, 0.5, 0.56]}
          direction="horizontal"
          fromX={-sideTravel}
          fromY={0}
          stretch={7.2}
          style={[styles.panel, styles.pink]}
        />
        <LogoSegment
          build={build}
          inputRange={[0.46, 0.62, 0.74, 0.8]}
          direction="horizontal"
          fromX={sideTravel}
          fromY={0}
          stretch={12}
          style={[styles.panel, styles.green]}
        />
        <LogoSegment
          build={build}
          inputRange={[0.7, 0.84, 0.94, 1]}
          direction="vertical"
          fromX={0}
          fromY={sideTravel * 0.55}
          stretch={4.2}
          style={[styles.panel, styles.white]}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.titleWrap,
          { opacity: titleOpacity, transform: [{ translateY: titleTranslate }] },
        ]}
      >
        <Text style={[styles.title, { color: theme.text }]}>Bumi</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  mark: { width: 86, height: 86, borderRadius: 24, overflow: 'visible' },
  segment: { position: 'absolute' },
  base: {
    top: 0,
    left: 0,
    width: 86,
    height: 86,
    borderRadius: 24,
    backgroundColor: '#a8b9d8',
  },
  panel: { borderRadius: 5 },
  pink: {
    top: 13,
    left: 13,
    width: 35,
    height: 24,
    backgroundColor: '#f6ed94',
  },
  green: {
    top: 13,
    right: 13,
    width: 19,
    height: 60,
    backgroundColor: '#9fcf9b',
  },
  white: {
    top: 43,
    left: 13,
    width: 35,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  titleWrap: { marginTop: 14, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: 0 },
});
