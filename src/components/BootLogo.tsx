import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
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
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(true);
  // Starting at 1 puts every segment at rest on the first frame, which is the reduced build:
  // there is no honest slower version of a panel crossing half the screen and stretching 12x.
  const [build] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  const [exit] = useState(() => new Animated.Value(0));
  const sideTravel = Math.max(150, width / 2 + 58);

  useEffect(() => {
    const useNativeDriver = Platform.OS !== 'web';
    // Nothing is assembling any more, so the 2.3s build plus its 520ms hold would just be a wait
    // in front of the app. What the screen is for — the mark, then handing over — is kept: a
    // beat on the finished logo, then a cross-fade, which is movement-free by nature.
    const animation = reduceMotion
      ? Animated.sequence([
          Animated.delay(900),
          Animated.timing(exit, {
            toValue: 1,
            duration: 300,
            easing: Easing.linear,
            useNativeDriver,
          }),
        ])
      : Animated.sequence([
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
  }, [build, exit, reduceMotion]);

  if (!visible) return null;

  const overlayOpacity = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const markScale = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] });
  const titleOpacity = build.interpolate({ inputRange: [0, 0.88, 1], outputRange: [0, 0, 1] });
  const titleTranslate = build.interpolate({ inputRange: [0, 0.88, 1], outputRange: [8, 8, 0] });

  return (
    <Animated.View style={[styles.overlay, { backgroundColor: theme.bg, opacity: overlayOpacity }]}>
      {/* The exit already reads as a hand-off through opacity alone; the shrink is the part of it
          that is movement, so it is the part that goes. */}
      <Animated.View style={[styles.mark, reduceMotion ? null : { transform: [{ scale: markScale }] }]}>
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
  // The same grid as Logo.tsx, at this screen's 86pt box: margin 11, gutter 8, units 19 and 37.
  panel: { borderRadius: 5 },
  pink: {
    top: 11,
    left: 11,
    width: 37,
    height: 19,
    backgroundColor: '#f6ed94',
  },
  green: {
    top: 11,
    right: 11,
    width: 19,
    height: 64,
    backgroundColor: '#9fcf9b',
  },
  white: {
    top: 38,
    left: 11,
    width: 37,
    height: 37,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  titleWrap: { marginTop: 14, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: 0 },
});
