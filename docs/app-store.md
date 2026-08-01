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

## Localised listings

The app ships Portuguese, English and Spanish (`CFBundleLocalizations`), so App Store
Connect needs a listing per language or the store shows Portuguese to everyone. Portuguese
above is the primary; these two are the other localizations to paste in. Keywords are a
single 100-character field, comma separated, no spaces.

### English (en-GB, en-US)

- Subtitle: Rectangle logic puzzle
- Description: Solve logic puzzles by splitting each grid into rectangles. Every number is
  the area of the rectangle that contains it. Hundreds of levels, a daily challenge, and
  progress saved across your devices.
- Keywords: `puzzle,logic,rectangles,shikaku,brain,daily,numbers,offline`

### Spanish (es-ES)

- Subtitle: Puzle de logica con rectangulos
- Description: Resuelve puzles de logica dividiendo cada cuadricula en rectangulos. Cada
  numero indica el area del rectangulo que lo contiene. Cientos de niveles, un reto diario y
  el progreso guardado entre dispositivos.
- Keywords: `puzle,logica,rectangulos,shikaku,cerebro,reto,diario,numeros`

## Screenshots to capture

Apple's required size is the 6.9" set — 1320x2868, which is what the iPhone 17 Pro Max
simulator produces. `supportsTablet` is false, so there is no iPad set. Each language with
a listing wants its own set, so capture with the app in that language.

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

Everything else on this list is closed. Sign in with Apple works on a real device, so the
App ID carries the capability — that could only ever be checked at runtime, since EAS syncs
Push Notifications but never reports the Apple capability either way. `suporte@jogarbumi.pt`
is live and receiving mail; the support URL stays pointed at the privacy page on purpose,
because that page states the address (`privacy.contactBody`), which is what Apple asks a
support URL to provide.

And web Google login was confirmed on 2026-08-01 with an account that predates the client
switch. No duplicates: 13 users, every email appearing once, each with exactly one `account`
row, the oldest dating from before the move to project `606345526586`. Google issues public
subject identifiers, which is why `sub` survived the change — checked rather than assumed.

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
7. `npx eas-cli submit --platform ios --latest` — non-interactive. An App Store Connect
   API key is already stored on the EAS servers, which the run reports as
   `Key Source: EAS servers`; nothing prompts for an Apple ID. (The `.p8` recorded above is
   the Sign in with Apple key and is a different thing entirely — it cannot authenticate a
   submission.) Apple then processes the binary for 5-10 minutes and emails when it lands;
   internal TestFlight is immediate after that, external testing needs Apple's review.
8. Capture the 6.9" screenshots described above, one set per listing language.
9. Privacy questionnaire: email and name (Google/Apple sign-in) plus game progress,
   linked to identity. The friends board shares progress *between players* — a painter
   nickname, points, level count and streak, never a name, email or account id — so the
   questionnaire's "data used to track you" stays No while progress remains linked to
   identity. The policy paragraph covering it is `privacy.friends*` in the catalogue.

## Submitted

| Build | Version | Date | Notes |
| --- | --- | --- | --- |
| 29 | 1.0.0 | 2026-08-01 | First TestFlight upload. Carries Spanish, the mistake-based medals, the friends board and its notifications, the error boundary, and SDK 57 patch alignment. |

## Maintenance

- `APPLE_CLIENT_SECRET` expires at most six months after generation and nothing
  rotates it automatically. Apple sign-in breaks silently when it lapses. Record the
  expiry date printed by the script here: **expires 2027-01-23** (generated 2026-07-25).
- App icon must stay free of an alpha channel; App Store Connect rejects transparency.
- `android.package` is still unset in `app.json`, which blocks any Android build.
