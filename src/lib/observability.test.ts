import { afterEach, describe, expect, it, vi } from 'vitest';

// Hoisted so the mock can be inspected after a fresh import of the module under test: the DSN is
// read once at module scope, so every case here has to re-import rather than re-call.
const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  wrap: vi.fn((component: unknown) => component),
  withScope: vi.fn((fn: (scope: unknown) => void) => fn({ setTag: vi.fn(), setContext: vi.fn() })),
  captureException: vi.fn(),
}));
vi.mock('@sentry/react-native', () => sentry);

async function loadWith(dsn: string | undefined) {
  vi.resetModules();
  Object.values(sentry).forEach(fn => fn.mockClear());
  if (dsn === undefined) delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  else process.env.EXPO_PUBLIC_SENTRY_DSN = dsn;
  return import('./observability');
}

afterEach(() => {
  delete process.env.EXPO_PUBLIC_SENTRY_DSN;
});

const DSN = 'https://key@o1.ingest.sentry.io/2';

// Without a DSN nothing may leave the device, and that is the state of every local checkout,
// every fork and this suite. Getting it wrong the other way is what posts a stranger's crashes
// into someone else's issue list.
describe('error reporting without a DSN', () => {
  it('does not start Sentry', async () => {
    const { initErrorReporting, isErrorReportingEnabled } = await loadWith(undefined);
    initErrorReporting();

    expect(isErrorReportingEnabled).toBe(false);
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it('sends nothing when an error is reported', async () => {
    const { reportError } = await loadWith(undefined);
    reportError(new Error('boom'), 'render');

    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  // Identity rather than a wrapper that reports nowhere: every test in this repo mounts the
  // tree this sits on, and they should exercise the shape the app ships without a DSN.
  it('leaves the root component exactly as it was', async () => {
    const { wrapRootComponent } = await loadWith(undefined);
    const Root = () => null;

    expect(wrapRootComponent(Root)).toBe(Root);
    expect(sentry.wrap).not.toHaveBeenCalled();
  });
});

describe('error reporting with a DSN', () => {
  it('starts Sentry with tracing off and PII off', async () => {
    const { initErrorReporting, isErrorReportingEnabled } = await loadWith(DSN);
    initErrorReporting();

    expect(isErrorReportingEnabled).toBe(true);
    const config = sentry.init.mock.calls[0][0] as Record<string, unknown>;
    expect(config.dsn).toBe(DSN);
    // Tracing is a separate quota and a separate decision; PII would carry the player's name,
    // their friends' names and their board into an error report.
    expect(config.tracesSampleRate).toBe(0);
    expect(config.sendDefaultPii).toBe(false);
  });

  it('reports a caught error and tags where it came from', async () => {
    const { reportError } = await loadWith(DSN);
    const failure = new Error('boom');
    reportError(failure, 'render');

    expect(sentry.captureException).toHaveBeenCalledWith(failure);
  });

  it('turns a thrown non-Error into one rather than dropping it', async () => {
    const { reportError } = await loadWith(DSN);
    reportError('just a string', 'render');

    const sent = sentry.captureException.mock.calls[0][0] as Error;
    expect(sent).toBeInstanceOf(Error);
    expect(sent.message).toBe('just a string');
  });

  it('wraps the root component', async () => {
    const { wrapRootComponent } = await loadWith(DSN);
    const Root = () => null;
    wrapRootComponent(Root);

    expect(sentry.wrap).toHaveBeenCalledWith(Root);
  });

  // The request body carries the friend code, which is a capability: whoever reads it can add
  // its owner. It must not survive into an issue.
  it('strips the request body and all but the user id before sending', async () => {
    const { initErrorReporting } = await loadWith(DSN);
    initErrorReporting();
    const { beforeSend } = sentry.init.mock.calls[0][0] as { beforeSend: (event: unknown) => unknown };

    const cleaned = beforeSend({
      request: { data: { action: 'add', code: 'ABC123' } },
      user: { id: 'u1', email: 'someone@example.com', username: 'Someone' },
    }) as { request?: { data?: unknown }; user?: Record<string, unknown> };

    expect(cleaned.request?.data).toBeUndefined();
    expect(cleaned.user).toEqual({ id: 'u1' });
  });
});
