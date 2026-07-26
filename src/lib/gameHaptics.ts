type HapticAction = 'selection' | 'success' | 'error';

/** Native feedback is optional: web and unsupported devices simply continue silently. */
export function playGameHaptic(action: HapticAction): void {
  if (typeof document !== 'undefined' || typeof navigator === 'undefined' || navigator.product !== 'ReactNative') return;

  void import('expo-haptics')
    .then(Haptics => {
      switch (action) {
        case 'selection':
          return Haptics.selectionAsync();
        case 'success':
          return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        case 'error':
          return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    })
    .catch(() => {
      // Haptics are progressive enhancement and must never interrupt play.
    });
}
