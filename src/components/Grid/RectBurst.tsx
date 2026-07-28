import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { BD_PAL, BG_PAL } from '@/theme/palette';
import { BURST_DELAY_MS, BURST_FADE_MS, BURST_TRAVEL_MS, burstParticleCount, type CelebrationTier } from './celebration';

interface RectBurstProps {
  tier: CelebrationTier;
  active: boolean;
  /** The burst is sized to the board so it reads as coming out of the puzzle. */
  width: number;
  height: number;
}

interface Particle {
  angle: number;
  distance: number;
  width: number;
  height: number;
  spin: number;
  delay: number;
  fill: string;
  border: string;
}

/**
 * Mixed aspect ratios, not one shape repeated: the pieces the player spends the game drawing
 * are wide, tall and square, so a burst of identical tiles would look like anything but this
 * game. Indexed rather than random for the same reason the rest of the particle is.
 */
const SHAPES = [
  { w: 1, h: 1 },
  { w: 1.6, h: 1 },
  { w: 1, h: 1.5 },
  { w: 2.1, h: 1 },
  { w: 1, h: 1 },
  { w: 1.3, h: 1 },
] as const;

/**
 * Confetti is what every app reaches for. This game is about rectangles, so the burst is made
 * of them, in the board's own palette — the celebration says Bumi rather than saying "app".
 *
 * Particles are derived from their index, never random: a burst that differs between renders
 * would restart differently on every re-render while the board is still celebrating.
 */
function buildParticles(count: number, radius: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const golden = i * 2.399963; // golden angle, so successive particles never line up
    const spread = ((i * 37) % 11) / 11;
    const shape = SHAPES[i % SHAPES.length];
    const scale = 11 + ((i * 13) % 9);
    return {
      angle: golden,
      distance: radius * (0.5 + spread * 0.62),
      width: scale * shape.w,
      height: scale * shape.h,
      spin: ((i % 2 === 0 ? 1 : -1) * (90 + ((i * 53) % 180))),
      delay: ((i * 29) % 7) * 18,
      fill: BG_PAL[i % BG_PAL.length],
      border: BD_PAL[i % BD_PAL.length],
    };
  });
}

function BurstParticle({ particle, active }: { particle: Particle; active: boolean }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    if (!active) return;
    progress.value = withDelay(
      BURST_DELAY_MS + particle.delay,
      withTiming(1, { duration: BURST_TRAVEL_MS, easing: Easing.out(Easing.cubic) }),
    );
  }, [active, particle.delay, progress]);

  const style = useAnimatedStyle(() => {
    const travelled = progress.value * particle.distance;
    // Fades over the last stretch rather than the whole flight, so it reads as thrown, not blown.
    const fadeStart = 1 - BURST_FADE_MS / BURST_TRAVEL_MS;
    const opacity = progress.value < fadeStart ? 1 : 1 - (progress.value - fadeStart) / (1 - fadeStart);
    return {
      opacity: active ? opacity : 0,
      transform: [
        { translateX: Math.cos(particle.angle) * travelled },
        { translateY: Math.sin(particle.angle) * travelled },
        { rotate: `${progress.value * particle.spin}deg` },
        { scale: 0.6 + progress.value * 0.4 },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        style,
        {
          width: particle.width,
          height: particle.height,
          backgroundColor: particle.fill,
          borderColor: particle.border,
          marginLeft: -particle.width / 2,
          marginTop: -particle.height / 2,
        },
      ]}
    />
  );
}

export function RectBurst({ tier, active, width, height }: RectBurstProps) {
  const count = burstParticleCount(tier);
  if (count === 0) return null;

  const particles = buildParticles(count, Math.max(width, height) * 0.78);

  return (
    <Animated.View pointerEvents="none" style={styles.origin}>
      {particles.map((particle, index) => (
        <BurstParticle key={index} particle={particle} active={active} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  origin: { position: 'absolute', left: '50%', top: '50%' },
  particle: { position: 'absolute', borderWidth: 1.5, borderRadius: 2 },
});
