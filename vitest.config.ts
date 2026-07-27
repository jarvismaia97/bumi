import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Mirrors the `@/*` path alias in tsconfig.json so tested modules can use it.
const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        // Pure logic: no DOM, no React Native, fast.
        test: {
          name: 'logic',
          include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
          environment: 'node',
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
