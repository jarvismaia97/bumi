import type { ComponentType } from 'react';
import * as Sentry from '@sentry/react-native';

/**
 * Crash and error reporting for the app.
 *
 * Everything here is inert without `EXPO_PUBLIC_SENTRY_DSN`. That is not a convenience for
 * development: it is what keeps a fork, a local checkout and the test suite from posting a
 * stranger's errors into this project's issue list. A missing DSN is the normal state
 * everywhere except a real build, so it is a silent no-op rather than a warning.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** Whether reporting is actually wired to anything. Exported so callers can skip the work. */
export const isErrorReportingEnabled = Boolean(dsn);

export function initErrorReporting(): void {
  if (!dsn) return;

  Sentry.init({
    dsn,
    // The three targets ship independently and only one of them is ever the one that broke.
    environment: process.env.EXPO_PUBLIC_SENTRY_ENV ?? 'production',
    // Off by default: the app knows a player's name, their friends' names and their board. An
    // error report needs the stack, not the person. `beforeSend` below strips what is left.
    sendDefaultPii: false,
    // Errors are the reason this exists. Tracing is a separate quota on the free tier and a
    // separate decision; turn it on deliberately, with a sample rate, if it is ever wanted.
    tracesSampleRate: 0,
    beforeSend(event) {
      // The friend code is a capability — whoever reads it can add its owner. It travels in
      // request bodies and can end up in a breadcrumb, so it is removed on the way out.
      if (event.request?.data) delete event.request.data;
      if (event.user) event.user = { id: event.user.id };
      return event;
    },
  });
}

/**
 * Wraps the root component so Sentry sees unhandled render errors and touch events.
 *
 * Identity when there is no DSN, rather than always wrapping: without one the wrapper is a
 * component that reports nowhere, and every test in this repo mounts the tree it would sit on.
 * Keeping it out of that path means the suite exercises the same shape the app ships without a
 * DSN, instead of a shape only the tests ever see.
 */
export function wrapRootComponent(component: ComponentType): ComponentType {
  return dsn ? Sentry.wrap(component) : component;
}

/**
 * Reports an error that was caught and handled, so it does not reach a crash handler.
 *
 * `context` is a short label for where it came from, not a message: the grouping Sentry does is
 * on the stack, and a label that varies per call would split one fault into many issues.
 */
export function reportError(error: unknown, context: string, extra?: Record<string, unknown>): void {
  if (!dsn) return;

  Sentry.withScope(scope => {
    scope.setTag('origin', context);
    if (extra) scope.setContext('detail', extra);
    Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
  });
}
