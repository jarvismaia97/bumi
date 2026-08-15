import { getAuth } from '../../src/lib/auth';

// better-auth's node handler reads the raw request stream itself, so Vercel must not consume
// the body first — parsed, every POST to /api/auth arrives with an empty stream.
export const config = { api: { bodyParser: false } };

export default async function handler(req: any, res: any) {
  const { toNodeHandler } = await import('better-auth/node');
  return toNodeHandler(await getAuth())(req, res);
}
