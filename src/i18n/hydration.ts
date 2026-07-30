import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

/**
 * One static document serves all three languages, and it is rendered with no locale at all, so
 * its copy is Portuguese. A browser reporting any other language used to render English or
 * Spanish on the very first client pass, which is a hydration mismatch: React threw #418, threw
 * the server's markup away, and rebuilt the tree.
 *
 * So the first client pass now says what the document says, and the device's language is applied
 * on the pass after hydration. The visible result is the same — a non-Portuguese player still
 * sees the static Portuguese frame the server sent, because that frame is what was downloaded —
 * except React now keeps the markup instead of discarding it.
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
