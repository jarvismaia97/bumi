import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

/**
 * One static document serves all three languages, and which language it was built in used to be
 * an accident of the build machine: `useLocales()` under Node answered English on Vercel, so the
 * shipped markup said "Getting ready..." while the `lang` attribute said pt-PT and a Portuguese
 * browser rendered Portuguese on the first client pass. React called that a text mismatch, threw
 * #418, discarded the server's markup and rebuilt the tree.
 *
 * Both ends now agree on Portuguese: static rendering has no client, so the server snapshot is
 * always "not yet hydrated", which pins the document — and the first client pass — to the
 * language the catalogue falls back to. The device's own language is applied from the mount
 * effect onward.
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
