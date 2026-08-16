import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
const baseURL = process.env.BETTER_AUTH_URL ?? 'https://www.jogarbumi.pt';
const secret = process.env.BETTER_AUTH_SECRET;

if (!databaseUrl) throw new Error('DATABASE_URL is not configured');
if (!secret) throw new Error('BETTER_AUTH_SECRET is not configured');

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleIosClientId = process.env.GOOGLE_IOS_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const appleClientId = process.env.APPLE_CLIENT_ID?.trim();
const appleClientSecret = process.env.APPLE_CLIENT_SECRET?.trim();
const appleBundleIdentifier = process.env.APPLE_APP_BUNDLE_IDENTIFIER?.trim();

// A social provider whose vars are missing is dropped silently below, which reads
// at runtime as "sign-in is just broken" rather than "a var is missing". Say so.
if (!googleClientId || !googleClientSecret) {
  console.warn('[auth] Google provider disabled: GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set');
}
if (!appleClientId || !appleClientSecret) {
  console.warn('[auth] Apple provider disabled: APPLE_CLIENT_ID/APPLE_CLIENT_SECRET not set');
}

async function createAuth() {
  const [{ expo }, { betterAuth }] = await Promise.all([
    import('@better-auth/expo'),
    import('better-auth'),
  ]);

  return betterAuth({
    baseURL,
    basePath: '/api/auth',
    secret,
    database: new Pool({ connectionString: databaseUrl }),
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async user => {
          const progressPool = new Pool({ connectionString: databaseUrl });
          const client = await progressPool.connect();
          try {
            // One transaction on one connection, because the alternative already failed in
            // production: nine deletes issued together through a pool are nine independent
            // transactions, so a failure part-way commits whatever had already landed and
            // abandons the rest. One account came out of that with its profile gone and 666
            // rows of solved levels, medals and dailies left behind — records of a person who
            // had been told deletion was permanent, and rows no query could reach again.
            await client.query('begin');
            await client.query('delete from profiles where user_id = $1', [user.id]);
            await client.query('delete from user_progress where user_id = $1', [user.id]);
            await client.query('delete from solved_levels where user_id = $1', [user.id]);
            await client.query('delete from daily_completions where user_id = $1', [user.id]);
            await client.query('delete from streak_freezes where user_id = $1', [user.id]);
            await client.query('delete from level_medals where user_id = $1', [user.id]);
            // Both directions: the friend's own row points back at an account that is gone,
            // and leaving it would keep a dead entry on their board.
            await client.query('delete from friendships where user_id = $1 or friend_id = $1', [user.id]);
            // Deletion is stated as permanent, so the device identifier and the rate-limit
            // trail go too: neither is progress, and both are about a person.
            await client.query('delete from push_tokens where user_id = $1', [user.id]);
            await client.query('delete from friend_code_attempts where user_id = $1', [user.id]);
            await client.query('commit');
          } catch (error) {
            // Rolling back leaves the account whole rather than half-erased, and rethrowing
            // stops better-auth removing the user row on top of progress this did not clear.
            // A deletion that failed and says so can be retried; one that half-succeeded
            // quietly cannot, because there is no longer an account to retry it from.
            await client.query('rollback').catch(() => {});
            throw error;
          } finally {
            client.release();
            await progressPool.end();
          }
        },
      },
    },
    trustedOrigins: [
      baseURL,
      'https://jogarbumi.pt',
      'https://www.jogarbumi.pt',
      'bumi://',
      'bumi://*',
      'http://localhost:3000',
      'http://localhost:8081',
    ],
    socialProviders: {
      ...(googleClientId && googleClientSecret
        ? {
            google: {
              // Web id must stay first: the browser redirect flow uses only the
              // first entry, while native id-token verification accepts any of them.
              clientId: [googleClientId, googleIosClientId].filter(
                (id): id is string => Boolean(id)
              ),
              clientSecret: googleClientSecret,
              prompt: 'select_account',
            },
          }
        : {}),
      ...(appleClientId && appleClientSecret
        ? {
            apple: {
              clientId: appleClientId,
              clientSecret: appleClientSecret,
              ...(appleBundleIdentifier ? { appBundleIdentifier: appleBundleIdentifier } : {}),
            },
          }
        : {}),
    },
    plugins: [expo()],
  });
}

let authPromise: ReturnType<typeof createAuth> | null = null;

export function getAuth() {
  authPromise ??= createAuth();
  return authPromise;
}
