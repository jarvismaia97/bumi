# App Store submission

## Product information

- Name: Bumi
- Subtitle: Puzzle de retangulos
- Primary category: Games / Puzzle
- Secondary category: Education
- Age rating: 4+
- Support URL: https://www.jogarbumi.pt/privacidade
- Privacy policy URL: https://www.jogarbumi.pt/privacidade
- Bundle ID: pt.jogarbumi.app

## Description

Resolve puzzles de logica dividindo cada grelha em retangulos. Cada numero indica a area do retangulo que o contem. Explora centenas de niveis, enfrenta um desafio diario e guarda o progresso entre dispositivos.

## Keywords

puzzle,logica,retangulos,numero,cerebro,desafio,diario

## Screenshots to capture

1. Nivel em jogo com uma selecao em curso.
2. Menu da campanha com progresso e medalhas.
3. Desafio diario concluido.
4. Mapa de niveis e ilhas desbloqueadas.
5. Escolha de tema e definicoes.

## Apple identifiers

| Item | Value |
| --- | --- |
| Team ID | `UTCM3TBG22` |
| App Store Connect app ID | `6794318786` |
| Sign in with Apple key ID | `AN9QJ8343L` |

The `.p8` key lives outside the repo. Apple allows exactly one download, so keep a backup.

## Google OAuth

Both clients live in Google Cloud project `606345526586` (`jarvis-485711`). They must
stay in the same project: `GoogleSignin` mints the id token against the web client, and
a cross-project pairing makes the audience check fail on every native login.

| Client | ID |
| --- | --- |
| Web | `606345526586-sjfscet3ehk2i9guth0cnjv7sg05vh1m` |
| iOS | `606345526586-tg7hsb94esepmg0sivm4hdkckjssmj19` |

This replaced an older web client in project `341922017268`. Google issues *public*
subject identifiers, so `sub` is stable per Google account across projects and existing
users keep their accounts — but confirm that on first login after the switch rather
than assuming it.

## Sign in with Apple is iOS-only by design

The button is gated on `Platform.OS === 'ios'` in `src/app/login.tsx`, so it never
renders on the web build — including the PWA on an iPhone, which still reports
`Platform.OS === 'web'`. It appears only in a real iOS build, where
`EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=true` comes from `eas.json`. That variable is
deliberately absent from Vercel; setting it there would change nothing.

This is why no Services ID exists. Apple rejects App IDs as the `client_id` for web
OAuth, so `/api/auth/sign-in/social` with `provider: apple` returns a URL Apple will
refuse. Nothing in the UI can reach that path. Offering Apple sign-in on the web would
require a Services ID, domain verification of `jogarbumi.pt`, a client secret re-signed
with the Services ID as `sub`, an `audience` array covering both it and the bundle id,
and a hand-built web button. App Store guideline 4.8 governs only the iOS app, so none
of that is needed to ship.

## Build credentials

Generated 2026-07-27 and stored on EAS, so builds no longer prompt for them.

| Item | Value |
| --- | --- |
| Distribution certificate | `728702EE354F7CFBB38C7640D11D041D`, expires 2027-07-27 |
| Provisioning profile | `GQWHJ83D78`, active |
| Push key | created and assigned |

`eas-cli` is deliberately **not** a project dependency — it pulls in
`dtrace-provider`, whose `node-gyp rebuild` install script fails on EAS Build. The
version floor lives in `eas.json` under `cli.version`, which is what EAS recommends.
Invoke it as `npx eas-cli`; plain `npx eas` cannot resolve the binary.

## Blocked on

1. **Disable the old Google client secret.** A new secret was added alongside it, so
   both currently authenticate. Until the old one is disabled in Google Auth Platform >
   Clients, the value leaked into a chat transcript still works.
2. **Verify Google login end to end** on the web, with a pre-existing account, and
   confirm it does not create a duplicate user row.
3. `suporte@jogarbumi.pt` created and receiving mail; the support URL still points at
   the privacy page.

Sign in with Apple was the other open item and is now closed: signing in works on a real
device, so the App ID carries the capability. That one could only be checked at runtime —
EAS synced Push Notifications but never reported the Apple capability either way.

## Before submission

1. Generate the Apple client secret and set the server variables in Vercel:
   `npm run generate-apple-secret -- /path/to/AuthKey_AN9QJ8343L.p8`
   Sets `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`, `APPLE_APP_BUNDLE_IDENTIFIER`.
   In the same pass set `GOOGLE_CLIENT_ID` and `GOOGLE_IOS_CLIENT_ID` to the clients
   above and `GOOGLE_CLIENT_SECRET` to the rotated secret.
2. Redeploy, then **verify web Google login still works and an existing user lands on
   their existing account** — this changes both the client id array and the project.
3. `npx eas-cli login && npx eas-cli init` — writes `extra.eas.projectId` into `app.json`.
4. `npx eas-cli build --profile development --platform ios`, install on a physical iPhone.
   Expo Go no longer works for this app: `@react-native-google-signin/google-signin`
   is native code, so a development build is required.
5. Test on device: Google sign-in, Apple sign-in, account deletion, offline play,
   daily reminder. Confirm both providers land on one user row, not two.
6. `npx eas-cli build --profile production --platform ios`
7. `npx eas-cli submit --platform ios` — prompts for Apple ID plus an app-specific
   password. The `.p8` above is a Sign in with Apple key and cannot authenticate
   submission; an App Store Connect API key (Users and Access > Integrations, which
   also yields an Issuer ID) would make this non-interactive and is required for CI.
8. Capture 6.7" screenshots (1290x2796). `supportsTablet` is false, so no iPad set.
9. Privacy questionnaire: email and name (Google/Apple sign-in) plus game progress,
   linked to identity.

## Maintenance

- `APPLE_CLIENT_SECRET` expires at most six months after generation and nothing
  rotates it automatically. Apple sign-in breaks silently when it lapses. Record the
  expiry date printed by the script here: **expires 2027-01-23** (generated 2026-07-25).
- App icon must stay free of an alpha channel; App Store Connect rejects transparency.
- `android.package` is still unset in `app.json`, which blocks any Android build.
