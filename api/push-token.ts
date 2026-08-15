import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuth } from '../src/lib/auth';
import { resolveLanguage } from '../src/i18n/messages';

/**
 * Where a device says how to reach it. One row per token rather than per user: the same
 * account can be signed in on a phone and a tablet, and both should hear about a new friend.
 * The token is claimed by whoever posts it last, so a device handed to someone else stops
 * receiving the previous owner's notifications.
 */

type PostBody = { token?: string; platform?: string; language?: string; action?: 'register' | 'unregister' };

/**
 * Guaranteed by the time this module finishes loading: importing `../src/lib/auth` above throws
 * when DATABASE_URL is missing, so a handler-level "not configured" branch could never run.
 */
const databaseUrl = process.env.DATABASE_URL as string;

/** Expo's token format. Anything else is not something the push service will accept. */
const EXPO_TOKEN = /^Expo(nent)?PushToken\[[^\]]+\]$/;

/**
 * What `Platform.OS` can actually be. The column took whatever the body said, at whatever
 * length, from a caller who is only trusted to know their own token — so it was a free text
 * field on a table nobody reads carefully. It is written for us to read while debugging a
 * delivery, and an unrecognised value tells us nothing that 'unknown' does not.
 */
const PLATFORMS = new Set(['ios', 'android', 'web', 'macos', 'windows']);

function normalizePlatform(platform: string | undefined): string {
  return platform && PLATFORMS.has(platform) ? platform : 'unknown';
}

/**
 * Where a browser may read a response from, mirroring `trustedOrigins` in src/lib/auth.ts.
 * Reflecting whatever `Origin` arrived was doing nothing for anybody: the web build is served
 * from the same origin as this function and React Native does not implement CORS at all, so the
 * reflection only ever widened who could read a reply.
 */
const ALLOWED_ORIGINS = new Set([
  process.env.BETTER_AUTH_URL ?? 'https://www.jogarbumi.pt',
  'https://jogarbumi.pt',
  'https://www.jogarbumi.pt',
  'http://localhost:3000',
  'http://localhost:8081',
]);

function sendJson(res: VercelResponse, status: number, body: unknown) {
  res.status(status).setHeader('content-type', 'application/json');
  res.send(JSON.stringify(body));
}

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) res.setHeader('access-control-allow-origin', origin);
  res.setHeader('vary', 'origin');
  res.setHeader('access-control-allow-methods', 'POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
}

function parseBody(req: VercelRequest): PostBody {
  if (!req.body) return {};
  if (typeof req.body === 'string') return JSON.parse(req.body) as PostBody;
  return req.body as PostBody;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const { fromNodeHeaders } = await import('better-auth/node');
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  const userId = session?.user.id;
  if (!userId) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  const { token, platform, language, action } = parseBody(req);
  if (!token || !EXPO_TOKEN.test(token)) {
    sendJson(res, 400, { error: 'invalid_token' });
    return;
  }

  const sql = neon(databaseUrl);

  // Signing out has to hand the token back, or the device keeps answering for an account
  // nobody is using on it — which matters most when the phone has changed hands.
  if (action === 'unregister') {
    await sql`delete from push_tokens where token = ${token} and user_id = ${userId}`;
    sendJson(res, 200, { ok: true });
    return;
  }

  // The token is the key and the last poster wins it, which is deliberate: a phone that changes
  // hands has to stop delivering the previous owner's notifications, and the new owner's app
  // registering the same token is the only signal that happened. The trade is that a token is
  // treated as proof of holding the device — so whoever learns one can claim it onto their own
  // account and quietly stop the victim's notifications. Nothing is disclosed by that, and the
  // victim's next registration takes it straight back, which is why it stands.
  await sql`
    insert into push_tokens (token, user_id, platform, updated_at)
    values (${token}, ${userId}, ${normalizePlatform(platform)}, now())
    on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now()
  `;

  // The notification is written for whoever receives it, so the receiver's own language is
  // what has to be on file: the sender's request headers are a different person's setting.
  await sql`
    insert into profiles (user_id, language)
    values (${userId}, ${resolveLanguage(language)})
    on conflict (user_id) do update set language = excluded.language
  `;

  sendJson(res, 200, { ok: true });
}
