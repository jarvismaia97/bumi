import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playHaptic, type Haptic } from './haptics';

const selectionAsync = vi.fn();
const notificationAsync = vi.fn();
const impactAsync = vi.fn();

// The literal values mirror the enums expo-haptics actually exports, so asserting on them
// checks the generator *and* the style rather than an identity we invented for the test.
vi.mock('expo-haptics', () => ({
  selectionAsync,
  notificationAsync,
  impactAsync,
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

/** What the module looks for before it will touch the native module at all. */
function pretendReactNative() {
  vi.stubGlobal('navigator', { product: 'ReactNative' });
  vi.stubGlobal('document', undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
  pretendReactNative();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('playHaptic', () => {
  it('answers a choice among peers with the selection generator', async () => {
    playHaptic('selection');

    await vi.waitFor(() => expect(selectionAsync).toHaveBeenCalledOnce());
    expect(notificationAsync).not.toHaveBeenCalled();
    expect(impactAsync).not.toHaveBeenCalled();
  });

  // Warning and error are separate patterns on iOS: one says "that did not take", the other
  // says "that failed". Collapsing them is the mistake this pins down.
  it.each([
    ['success', 'success'],
    ['warning', 'warning'],
    ['error', 'error'],
  ] as const)('reports the %s outcome as a notification of its own type', async (haptic, type) => {
    playHaptic(haptic);

    await vi.waitFor(() => expect(notificationAsync).toHaveBeenCalledWith(type));
    expect(selectionAsync).not.toHaveBeenCalled();
    expect(impactAsync).not.toHaveBeenCalled();
  });

  it.each([
    ['light', 'light'],
    ['medium', 'medium'],
    ['heavy', 'heavy'],
  ] as const)('conveys %s weight through the impact generator', async (haptic, style) => {
    playHaptic(haptic);

    await vi.waitFor(() => expect(impactAsync).toHaveBeenCalledWith(style));
    expect(notificationAsync).not.toHaveBeenCalled();
  });
});

// The app ships a real web build, so a call that reaches expo-haptics off-device is a live
// bug rather than a missing nicety.
describe('platforms without a Taptic Engine', () => {
  const everyHaptic: Haptic[] = ['selection', 'success', 'warning', 'error', 'light', 'medium', 'heavy'];

  it('stays silent in a browser', async () => {
    vi.stubGlobal('document', {});
    vi.stubGlobal('navigator', { product: 'Gecko' });

    everyHaptic.forEach(playHaptic);

    await expect.poll(() => selectionAsync.mock.calls.length).toBe(0);
    expect(notificationAsync).not.toHaveBeenCalled();
    expect(impactAsync).not.toHaveBeenCalled();
  });

  it('stays silent where there is no navigator at all, as when the web build prerenders', async () => {
    vi.stubGlobal('document', undefined);
    vi.stubGlobal('navigator', undefined);

    everyHaptic.forEach(playHaptic);

    await expect.poll(() => selectionAsync.mock.calls.length).toBe(0);
    expect(notificationAsync).not.toHaveBeenCalled();
    expect(impactAsync).not.toHaveBeenCalled();
  });

  it('swallows a native module that rejects instead of surfacing it to the caller', async () => {
    selectionAsync.mockRejectedValueOnce(new Error('no vibrator'));

    expect(() => playHaptic('selection')).not.toThrow();
    await vi.waitFor(() => expect(selectionAsync).toHaveBeenCalledOnce());
  });
});
