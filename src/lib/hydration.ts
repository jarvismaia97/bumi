import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

/**
 * One static document serves every language and both appearances, and which of each it was built
 * in is an accident of the build machine: under Node `useLocales()` answered English on Vercel
 * and `useColorScheme()` answers light always. Anything the first client pass reads from the
 * device instead — the browser's language, the system's dark mode — contradicts that markup.
 *
 * The two contradictions do not fail the same way, which is why this gate is not optional for
 * either. A language mismatch is a text mismatch: React throws #418, discards the server's
 * markup and rebuilds the tree, which is loud but self-correcting. An appearance mismatch is
 * only a `className` mismatch, and React never patches attributes during hydration — it keeps
 * what the server sent. So a dark-mode device silently kept the light palette on any route that
 * had no reason to re-render after mounting.
 *
 * Both ends now agree on the static values: static rendering has no client, so the server
 * snapshot is always "not yet hydrated", which pins the document — and the first client pass —
 * to what the app falls back to with no device to ask. The device's own language and appearance
 * are applied from the mount effect onward, as an ordinary update, which does repaint.
 *
 * Native has no hydration and no static document, so it starts out already hydrated and nothing
 * about it changes.
 */
let hydrated = Platform.OS !== 'web';
const listeners = new Set<() => void>();

/** Called once from the root layout's mount effect. */
export function markHydrated(): void {
  if (hydrated) return;
  hydrated = true;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return hydrated;
}

/** Static rendering has no client, so the server snapshot is always "not yet". */
function getServerSnapshot(): boolean {
  return false;
}

export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Test seam: the flag is module state, and a test that flips it has to be able to put it back. */
export function resetHydrationForTests(value = Platform.OS !== 'web'): void {
  hydrated = value;
  for (const listener of listeners) listener();
}
