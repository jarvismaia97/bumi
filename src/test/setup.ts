import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { markHydrated } from '@/lib/hydration';

// Two native modules sit under almost every component and neither is what any component
// test is about: expo-localization reads native locale state jsdom does not have, and
// AsyncStorage ships Flow-typed source vitest cannot parse. Tests drive the stores directly.
vi.mock('expo-localization', () => ({ useLocales: () => [] }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
}));

// Reanimated now sits under every pressable in the app, and its worklet runtime cannot load
// outside a Metro build. See the stub for what it stands in for.
vi.mock('react-native-reanimated', () => import('./reanimated-stub'));

// Components render through react-native-web, so Platform.OS is 'web' and the gate would hold
// back the device language and appearance waiting for a hydration that never happens here. No
// test renders into server markup, so every test starts hydrated.
markHydrated();

// Auto-cleanup only kicks in with vitest globals, which this project does not enable.
afterEach(cleanup);
