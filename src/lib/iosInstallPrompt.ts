export function isIOSInstallPromptEligible(userAgent: string, standalone: boolean): boolean {
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isSafari = /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(userAgent);

  return isIOS && isSafari && !standalone;
}

export function canShowIOSInstallPrompt(): boolean {
  // Kept free of react-native imports so the pure logic above stays testable in
  // a plain node environment. Safe on native: navigator.userAgent is undefined
  // there, so the eligibility test returns false.
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const standalone = window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  return isIOSInstallPromptEligible(navigator.userAgent, standalone);
}
