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
          try {
            await Promise.all([
              progressPool.query('delete from profiles where user_id = $1', [user.id]),
              progressPool.query('delete from user_progress where user_id = $1', [user.id]),
              progressPool.query('delete from solved_levels where user_id = $1', [user.id]),
              progressPool.query('delete from daily_completions where user_id = $1', [user.id]),
              progressPool.query('delete from level_medals where user_id = $1', [user.id]),
              // Both directions: the friend's own row points back at an account that is gone,
              // and leaving it would keep a dead entry on their board.
              progressPool.query('delete from friendships where user_id = $1 or friend_id = $1', [user.id]),
              // Deletion is stated as permanent, so the device identifier and the rate-limit
              // trail go too: neither is progress, and both are about a person.
              progressPool.query('delete from push_tokens where user_id = $1', [user.id]),
              progressPool.query('delete from friend_code_attempts where user_id = $1', [user.id]),
            ]);
          } finally {
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
