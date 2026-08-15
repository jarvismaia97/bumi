import { forwardRef, type ComponentProps, type ComponentRef } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

// The animation rides the Pressable itself rather than a wrapper view, so converting a call
// site adds no box to the tree: flex, gap and hitSlop measurements all stay where they were.
const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

/**
 * Chosen so the pressed edge travels about the same distance whatever the control's size —
 * roughly 2 to 3pt in from each side. Holding the *factor* constant instead would leave a
 * 40pt icon button looking inert and a full-width button looking like it broke.
 */
const PRESS_SCALE = {
  /** Compact controls around the 44pt touch minimum: header icons, sheet back and close. */
  icon: 0.92,
  /** Controls sized by their own label, roughly 48 to 160pt: the footer trio, the auth pill. */
  control: 0.96,
  /** Full-width surfaces: settings rows, the campaign and daily buttons, sheet primaries. */
  surface: 0.98,
} as const;

export type PressFeedback = keyof typeof PRESS_SCALE;

/** Scaling a control is inappropriate under reduced motion, but the touch still needs answering. */
const REDUCED_MOTION_OPACITY = 0.7;

const PRESS_IN = { duration: 80, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System };
// Overshoots on release so the control settles back instead of snapping.
const PRESS_OUT = { duration: 150, easing: Easing.out(Easing.back(1.5)), reduceMotion: ReduceMotion.System };

export interface AnimatedPressableProps extends Omit<ComponentProps<typeof Pressable>, 'style'> {
  /** Pressable's `({ pressed }) => style` callback is the thing this component replaces. */
  style?: StyleProp<ViewStyle>;
  feedback?: PressFeedback;
}

/** A Pressable that acknowledges the touch. Every other prop is Pressable's own. */
export const AnimatedPressable = forwardRef<ComponentRef<typeof Pressable>, AnimatedPressableProps>(
  function AnimatedPressable({ feedback = 'surface', style, disabled, onPressIn, onPressOut, ...rest }, ref) {
    const press = useSharedValue(0);
    const reduceMotion = useReducedMotion();
    const scale = PRESS_SCALE[feedback];

    // Transform and opacity only: both compose off the layout, so a press never reflows the row.
    const pressStyle = useAnimatedStyle(() => (reduceMotion
      ? { opacity: interpolate(press.value, [0, 1], [1, REDUCED_MOTION_OPACITY]) }
      : { transform: [{ scale: interpolate(press.value, [0, 1], [1, scale]) }] }));

    return (
      <AnimatedPressableBase
        ref={ref}
        {...rest}
        disabled={disabled}
        // Animating a control that does nothing is a lie, and leaving the style off is also
        // what keeps a resting opacity the call site painted (a dimmed button) intact.
        style={disabled ? style : [style, pressStyle]}
        onPressIn={event => {
          press.value = withTiming(1, PRESS_IN);
          onPressIn?.(event);
        }}
        onPressOut={event => {
          press.value = withTiming(0, PRESS_OUT);
          onPressOut?.(event);
        }}
      />
    );
  },
);
