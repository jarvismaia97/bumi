/**
 * Generates the APPLE_CLIENT_SECRET JWT that Better Auth's Apple provider needs.
 *
 * Apple does not issue a static client secret: it is an ES256 JWT you sign yourself
 * with the "Sign in with Apple" .p8 key, and Apple caps its lifetime at six months.
 * When it expires, Apple sign-in stops working — rerun this and update the value in
 * Vercel. The printed expiry date is the one to put in the calendar.
 *
 * Usage:
 *   npm run generate-apple-secret -- /absolute/path/to/AuthKey_XXXXXXXXXX.p8
 *
 * Keep the .p8 outside the repo. Apple lets you download it exactly once.
 */
import { readFileSync } from 'node:fs';
import { importPKCS8, SignJWT } from 'jose';

const TEAM_ID = 'UTCM3TBG22';
const KEY_ID = 'AN9QJ8343L';
// Native-only Apple sign-in, so the App ID doubles as the client id. A Services ID
// would only be needed to offer Apple sign-in on the web.
const CLIENT_ID = 'pt.jogarbumi.app';
const SIX_MONTHS_SECONDS = 15777000;

async function main(): Promise<void> {
  const keyPath = process.argv[2];
  if (!keyPath) {
    console.error('Usage: npm run generate-apple-secret -- /path/to/AuthKey_XXXXXXXXXX.p8');
    process.exit(1);
  }

  const privateKey = await importPKCS8(readFileSync(keyPath, 'utf8'), 'ES256');
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + SIX_MONTHS_SECONDS;

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: KEY_ID })
    .setIssuer(TEAM_ID)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .setAudience('https://appleid.apple.com')
    .setSubject(CLIENT_ID)
    .sign(privateKey);

  console.log(`\nAPPLE_CLIENT_ID=${CLIENT_ID}`);
  console.log(`APPLE_APP_BUNDLE_IDENTIFIER=${CLIENT_ID}`);
  console.log(`APPLE_CLIENT_SECRET=${token}`);
  console.log(`\nExpires ${new Date(expiresAt * 1000).toISOString().slice(0, 10)} — regenerate before then.\n`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
