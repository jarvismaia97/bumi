import { fireEvent, render, screen } from '@testing-library/react';
import { Pressable, Text } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimatedPressable } from './AnimatedPressable';

// Reanimated is stubbed for every component test (see src/test/setup.ts), but reduced motion is
// a branch this component owns, so it gets a switch the tests can throw.
const { reducedMotion } = vi.hoisted(() => ({ reducedMotion: { on: false } }));
vi.mock('react-native-reanimated', async () => ({
  ...(await import('@/test/reanimated-stub')),
  useReducedMotion: () => reducedMotion.on,
}));

/** Everything a call site relies on the wrapper not swallowing, in one prop bag. */
const forwarded = {
  accessibilityRole: 'button',
  accessibilityLabel: 'Abrir mapa',
  accessibilityState: { disabled: false, selected: true, expanded: false },
  hitSlop: { top: 4, right: 4, bottom: 4, left: 4 },
  testID: 'target',
} as const;

/** The attributes react-native-web derives from those props, which is where they can go missing. */
function attributes(node: HTMLElement) {
  return Object.fromEntries(
    Array.from(node.attributes)
      .filter(attribute => attribute.name !== 'class' && attribute.name !== 'style')
      .map(attribute => [attribute.name, attribute.value]),
  );
}

afterEach(() => {
  reducedMotion.on = false;
});

describe('AnimatedPressable', () => {
  it('renders the same control a plain Pressable would', () => {
    const { unmount } = render(<Pressable {...forwarded}><Text>Mapa</Text></Pressable>);
    const plain = attributes(screen.getByTestId('target'));
    unmount();

    render(<AnimatedPressable {...forwarded}><Text>Mapa</Text></AnimatedPressable>);

    expect(attributes(screen.getByTestId('target'))).toEqual(plain);
  });

  it('keeps the intensity out of the rendered control', () => {
    render(<AnimatedPressable {...forwarded} feedback="icon"><Text>Mapa</Text></AnimatedPressable>);

    expect(screen.getByTestId('target').getAttribute('feedback')).toBeNull();
  });

  it('leaves the style the call site painted in place', () => {
    render(<AnimatedPressable {...forwarded} style={{ minHeight: 48, opacity: 0.4 }}><Text>Mapa</Text></AnimatedPressable>);

    const { minHeight, opacity } = getComputedStyle(screen.getByTestId('target'));
    expect(minHeight).toBe('48px');
    expect(opacity).toBe('0.4');
  });

  it('fires onPress', () => {
    const onPress = vi.fn();
    render(<AnimatedPressable {...forwarded} onPress={onPress}><Text>Mapa</Text></AnimatedPressable>);

    fireEvent.click(screen.getByTestId('target'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // Animating a control that does nothing is a lie, and the transform is also what would
  // otherwise overwrite the dimmed opacity a disabled call site paints.
  it('takes the animation off a disabled control', () => {
    render(<AnimatedPressable {...forwarded} disabled><Text>Mapa</Text></AnimatedPressable>);

    const target = screen.getByTestId('target');
    expect(getComputedStyle(target).transform).toBe('none');
    expect(target.getAttribute('aria-disabled')).toBe('true');
  });

  it('animates an enabled control off its own transform', () => {
    render(<AnimatedPressable {...forwarded}><Text>Mapa</Text></AnimatedPressable>);

    expect(getComputedStyle(screen.getByTestId('target')).transform).toBe('scale(1)');
  });

  // Scaling is inappropriate under reduced motion, but doing nothing would leave the touch
  // unanswered, so the feedback moves to opacity instead of disappearing.
  it('answers with opacity instead of a scale under reduced motion', () => {
    reducedMotion.on = true;
    render(<AnimatedPressable {...forwarded}><Text>Mapa</Text></AnimatedPressable>);

    const { transform, opacity } = getComputedStyle(screen.getByTestId('target'));
    expect(transform).toBe('none');
    expect(opacity).toBe('1');
  });
});
