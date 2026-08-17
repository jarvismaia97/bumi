import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  withScope: vi.fn((fn: (scope: unknown) => void) => fn({ setTag: vi.fn(), setContext: vi.fn() })),
  captureException: vi.fn(),
}));
vi.mock('@sentry/node', () => sentry);

async function loadWith(dsn: string | undefined) {
  vi.resetModules();
  Object.values(sentry).forEach(fn => fn.mockClear());
  if (dsn === undefined) delete process.env.SENTRY_DSN;
  else process.env.SENTRY_DSN = dsn;
  return import('./serverObservability');
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.SENTRY_DSN;
  vi.restoreAllMocks();
});

const DSN = 'https://key@o1.ingest.sentry.io/3';

describe('server error reporting', () => {
  // The Vercel log is the one place that still holds the entry when the DSN is unset, the quota
  // is spent, or Sentry itself is what is down. It is not a fallback for the DSN-less case only.
  it('always logs, with or without a DSN', async () => {
    const withoutDsn = await loadWith(undefined);
    withoutDsn.reportServerError(new Error('boom'), 'progress');
    expect(console.error).toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();

    const withDsn = await loadWith(DSN);
    vi.mocked(console.error).mockClear();
    withDsn.reportServerError(new Error('boom'), 'progress');
    expect(console.error).toHaveBeenCalled();
    expect(sentry.captureException).toHaveBeenCalled();
  });

  // Vercel keeps a warm function alive across invocations, so a per-request init would install a
  // second set of global handlers on every call.
  it('starts Sentry once per instance, not once per request', async () => {
    const { reportServerError } = await loadWith(DSN);

    reportServerError(new Error('one'), 'progress');
    reportServerError(new Error('two'), 'friends');
    reportServerError(new Error('three'), 'friends');

    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledTimes(3);
  });

  // A reporter that can fail the request it is reporting on turns one fault into two: the
  // handler would go from a 500 the client can retry to a crash it cannot.
  it('never throws, even when Sentry itself does', async () => {
    const { reportServerError } = await loadWith(DSN);
    sentry.captureException.mockImplementationOnce(() => {
      throw new Error('sentry is down');
    });

    expect(() => reportServerError(new Error('boom'), 'progress')).not.toThrow();
    // And the real error still reached the log, which is the point of keeping it.
    expect(console.error).toHaveBeenCalled();
  });

  it('turns a thrown non-Error into one rather than dropping it', async () => {
    const { reportServerError } = await loadWith(DSN);
    reportServerError('just a string', 'progress');

    const sent = sentry.captureException.mock.calls[0][0] as Error;
    expect(sent).toBeInstanceOf(Error);
    expect(sent.message).toBe('just a string');
  });
});
