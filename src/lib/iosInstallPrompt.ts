export function isIOSInstallPromptEligible(userAgent: string, standalone: boolean): boolean {
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isSafari = /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(userAgent);

  return isIOS && isSafari && !standalone;
}

export function canShowIOSInstallPrompt(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const standalone = window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  return isIOSInstallPromptEligible(navigator.userAgent, standalone);
}
