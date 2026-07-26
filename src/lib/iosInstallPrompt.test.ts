import { describe, expect, it } from 'vitest';
import { isIOSInstallPromptEligible } from './iosInstallPrompt';

describe('isIOSInstallPromptEligible', () => {
  it('accepts Safari on iPhone when the site is not installed', () => {
    expect(isIOSInstallPromptEligible(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      false,
    )).toBe(true);
  });

  it('does not show inside a standalone PWA or another iOS browser', () => {
    expect(isIOSInstallPromptEligible(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      true,
    )).toBe(false);
    expect(isIOSInstallPromptEligible(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/130.0.0.0 Mobile/15E148 Safari/604.1',
      false,
    )).toBe(false);
  });
});
