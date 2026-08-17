import * as Sentry from '@sentry/node';

/**
 * Error reporting for the Vercel functions.
 *
 * Separate from the app's reporter because it is a separate runtime with a separate DSN: a 500
 * from a handler and a crash on a phone are different faults with different fixes, and reading
 * them in one stream only works if each says which it is.
 *
 * Inert without `SENTRY_DSN`, which is the state in every local checkout and in the tests.
 */
const dsn = process.env.SENTRY_DSN;

let started = false;

/**
 * Vercel keeps a warm function alive across invocations, so this runs once per instance rather
 * than once per request — `init` twice would install a second set of global handlers.
 */
function ensureStarted(): void {
  if (started || !dsn) return;
  started = true;

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? 'production',
    // The handlers read and write a player's progress, their friends' names and their board.
    // None of that belongs in an error report, and the default would send some of it.
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
}

/**
 * Reports a handler failure. Returns nothing and never throws: a reporter that can fail the
 * request it is reporting on turns one fault into two.
 *
 * `console.error` stays alongside it deliberately. The Vercel log is the one place that still
 * has the entry when the DSN is unset, the quota is spent, or Sentry itself is the thing down.
 */
export function reportServerError(error: unknown, context: string, extra?: Record<string, unknown>): void {
  console.error(`[${context}]`, error, extra ?? '');

  if (!dsn) return;

  try {
    ensureStarted();
    Sentry.withScope(scope => {
      scope.setTag('origin', context);
      if (extra) scope.setContext('detail', extra);
      Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
    });
  } catch {
    // Swallowed on purpose: the line above already recorded the real error, and this one is
    // about the reporter. Rethrowing here would replace a 500 the client can retry with a
    // crash it cannot.
  }
}
