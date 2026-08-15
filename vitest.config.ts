import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Mirrors the `@/*` path alias in tsconfig.json so tested modules can use it.
const src = fileURLToPath(new URL('./src', import.meta.url));

// Tests whose result depends on the local zone, so they run with one pinned instead of
// inheriting the machine's. Add a file here rather than reaching for a global TZ.
const TZ_SENSITIVE = ['src/game/daily.test.ts'];

export default defineConfig({
  test: {
    projects: [
      {
        // Pure logic: no DOM, no React Native, fast.
        test: {
          name: 'logic',
          include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
          exclude: [...TZ_SENSITIVE, '**/node_modules/**', '**/dist/**'],
          environment: 'node',
        },
        resolve: { alias: { '@': src } },
      },
      {
        // Same as `logic`, but with the zone pinned. Anything that decides which puzzle a date
        // belongs to has to be exercised somewhere the clocks actually move: the daily's board
        // size was wrong for half the year in DST zones and no test could see it, because the
        // run inherited whatever zone the machine happened to be in — green on a developer
        // laptop in Lisbon or in UTC CI for opposite reasons. Lisbon is the app's primary
        // market and shifts on the EU dates, so it is the zone the bug was reported in.
        // Kept a separate project rather than a global TZ so the rest of the suite keeps
        // running in the machine's own zone.
        test: {
          name: 'logic-tz',
          include: TZ_SENSITIVE,
          environment: 'node',
          env: { TZ: 'Europe/Lisbon' },
        },
        resolve: { alias: { '@': src } },
      },
      {
        // Components render through react-native-web, which the app already ships for its
        // web build, so `react-native` imports become real DOM nodes under jsdom. Anything
        // needing a native module (gestures, bottom sheets, reanimated) stays out of here.
        test: {
          name: 'components',
          include: ['src/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
        },
        resolve: {
          alias: [
            { find: /^lucide-react-native(\/.*)?$/, replacement: fileURLToPath(new URL('./src/test/lucide-stub.tsx', import.meta.url)) },
            { find: /^react-native$/, replacement: 'react-native-web' },
            { find: /^@\//, replacement: `${src}/` },
          ],
        },
        // react-native-web and expo-localization both read this React Native global.
        define: { __DEV__: 'true' },
      },
    ],
  },
});
