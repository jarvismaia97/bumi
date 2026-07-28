/** The outcome of an action the player committed to. */
type NotificationHaptic = 'success' | 'warning' | 'error';

/** How much weight the action carried. The standard iOS triad. */
type ImpactHaptic = 'light' | 'medium' | 'heavy';

/**
 * One flat vocabulary over the three generators iOS keeps separate, because reaching for the
 * wrong family is what makes feedback feel cheap: `selection` is a choice among peers, the
 * notification set reports how a committed action ended, and the impact set conveys weight.
 * Call sites name the intent, not the generator.
 */
export type Haptic = 'selection' | NotificationHaptic | ImpactHaptic;

/**
 * Native feedback is optional: web, static rendering and unsupported devices continue silently.
 * The guard runs before the import so `expo-haptics` never reaches the web bundle at all, and
 * the rejection handler covers the devices that ship the module but no working motor.
 *
 * Nothing here checks whether the player wants haptics: iOS already gates the Taptic Engine on
 * the system setting and on Low Power Mode, so an honoured "off" arrives as silence from the
 * OS. That is also why the app offers no setting of its own — the system one already works.
 */
export function playHaptic(haptic: Haptic): void {
  if (typeof document !== 'undefined' || typeof navigator === 'undefined' || navigator.product !== 'ReactNative') return;

  void import('expo-haptics')
    .then(Haptics => {
      switch (haptic) {
        case 'selection':
          return Haptics.selectionAsync();
        case 'success':
          return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        case 'warning':
          return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        case 'error':
          return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        case 'light':
          return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        case 'medium':
          return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        case 'heavy':
          return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    })
    .catch(() => {
      // Haptics are progressive enhancement and must never interrupt an interaction.
    });
}
