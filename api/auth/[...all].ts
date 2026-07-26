import { getAuth } from '../../src/lib/auth';

export const config = { api: { bodyParser: false } };

export default async function handler(req: any, res: any) {
  const { toNodeHandler } = await import('better-auth/node');
  return toNodeHandler(await getAuth())(req, res);
}
