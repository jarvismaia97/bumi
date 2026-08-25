import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

interface BrandMarkProps {
  size?: number;
  /** Plays the assemble once on mount. Off by default: this is arrival, not decoration. */
  assemble?: boolean;
}

export const ASSEMBLE_IN_MS = 190;

// Same geometry as the SVG Logo, as fractions of the mark, so the two cannot drift apart.
// Views rather than SVG because each piece has to animate independently.
const VIEWBOX = 32;
const PIECES = [
  { x: 4, y: 4, w: 14, h: 7, fill: '#f6ed94', opacity: 1, from: { x: -0.9, y: -0.7 } },
  { x: 21, y: 4, w: 7, h: 24, fill: '#9fcf9b', opacity: 1, from: { x: 1.1, y: -0.3 } },
  { x: 4, y: 14, w: 14, h: 14, fill: '#ffffff', opacity: 0.85, from: { x: -0.8, y: 0.9 } },
] as const;

/**
 * The boot animation assembles this mark over ~3.3s, which is fine once per launch and a toll
 * on every navigation. Arriving at the menu replays the idea at a fourteenth of the length:
 * the pieces drop into place while the screen is already fading in, so it costs no waiting.
 */
export function BrandMark({ size = 28, assemble = false }: BrandMarkProps) {
  // Rest is 0, never 1. At 1 the pieces sit outside the clipped box, so a mark that starts
  // there is a blank square until an animation carries it home — and the menu unmounts and
  // remounts on every navigation, so that animation is started over and over on a screen that
  // is also running its own fade-in. One interrupted run and the logo stays blank for the rest
  // of the session: it did, on a device, from the first return out of the friends board.
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const unit = size / VIEWBOX;

  useEffect(() => {
    if (!assemble || reduceMotion) {
      progress.value = 0;
      return;
    }
    // Starts scattered and settles; the small hold keeps it from reading as a twitch.
    progress.value = 1;
    progress.value = withDelay(
      40,
      withTiming(0, { duration: ASSEMBLE_IN_MS, easing: Easing.out(Easing.back(1.4)), reduceMotion: ReduceMotion.Never }),
    );
    // The floor under the animation, not a second animation: whatever happened to the timing,
    // the mark is a mark again a breath after it should have been.
    const settle = setTimeout(() => {
      progress.value = 0;
    }, 40 + ASSEMBLE_IN_MS + 400);
    return () => clearTimeout(settle);
  }, [assemble, progress, reduceMotion]);

  return (
    <View style={{ width: size, height: size, borderRadius: 9 * unit, backgroundColor: '#a8b9d8', overflow: 'hidden' }}>
      {PIECES.map((piece, index) => (
        <BrandPiece key={index} piece={piece} unit={unit} progress={progress} />
      ))}
    </View>
  );
}

function BrandPiece({
  piece,
  unit,
  progress,
}: {
  piece: (typeof PIECES)[number];
  unit: number;
  progress: ReturnType<typeof useSharedValue<number>>;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: piece.opacity * (1 - progress.value * 0.4),
    transform: [
      { translateX: progress.value * piece.from.x * piece.w * unit },
      { translateY: progress.value * piece.from.y * piece.h * unit },
      { scale: 1 - progress.value * 0.15 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        style,
        {
          position: 'absolute',
          left: piece.x * unit,
          top: piece.y * unit,
          width: piece.w * unit,
          height: piece.h * unit,
          borderRadius: 2 * unit,
          backgroundColor: piece.fill,
        },
      ]}
    />
  );
}
