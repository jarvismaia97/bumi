import type { ComponentType } from 'react';
import { View } from 'react-native';

// Reanimated 4 boots a worklet runtime that only exists inside a Metro build, so importing
// the real package under vitest fails at module load. The stub keeps every call the app makes
// answerable and renders the plain component underneath, which is what the DOM assertions are
// about. Timings collapse to their end value: nothing here observes a frame.

/** Layout animations (`FadeIn.duration(140).reduceMotion(...)`) chain arbitrarily deep. */
const chainable: unknown = new Proxy({}, { get: () => () => chainable });

/** Every easing is the identity curve; which curve a press uses is not observable in jsdom. */
const identityEasing = (value: number) => value;

type AnimatedProps = Record<string, unknown> & { entering?: unknown; exiting?: unknown };

function AnimatedView({ entering: _entering, exiting: _exiting, ...props }: AnimatedProps) {
  return <View {...props} />;
}

export function createAnimatedComponent<P>(Component: ComponentType<P>) {
  return Component;
}

export function useSharedValue<T>(initial: T) {
  return { value: initial };
}

export function useAnimatedStyle<T>(updater: () => T) {
  return updater();
}

export function useReducedMotion() {
  return false;
}

export function withTiming<T>(toValue: T) {
  return toValue;
}

export function withDelay<T>(_delay: number, animation: T) {
  return animation;
}

export function withSequence<T>(...animations: T[]) {
  return animations[animations.length - 1];
}

export function interpolate(value: number, input: readonly number[], output: readonly number[]) {
  const progress = (value - input[0]) / (input[1] - input[0]);
  return output[0] + progress * (output[1] - output[0]);
}

export const Easing = new Proxy({}, { get: () => () => identityEasing }) as Record<string, never>;

export const ReduceMotion = { System: 'system', Always: 'always', Never: 'never' } as const;

export const FadeIn = chainable as Record<string, never>;
export const FadeOut = chainable as Record<string, never>;

export default { View: AnimatedView, createAnimatedComponent };
