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

## Blocked on

1. **Rotate the web client secret.** The original was pasted into a chat transcript.
   Reset it in APIs & Services > Credentials and update `GOOGLE_CLIENT_SECRET` in
   Vercel. Also set `GOOGLE_CLIENT_ID` to the new web client above.
2. **Publish the OAuth consent screen** for project `jarvis-485711`. A new project
   starts in Testing mode, which caps sign-in at 100 listed test users and expires
   refresh tokens after 7 days. Scopes here are only email/profile/openid, so
   publishing needs no Google review.
3. **App ID capability.** Confirm `pt.jogarbumi.app` has Sign in with Apple enabled in
   the developer portal. Missing capability fails at runtime, not at build.
4. `suporte@jogarbumi.pt` created and receiving mail; the support URL still points at
   the privacy page.

## Before submission

1. Generate the Apple client secret and set the server variables in Vercel:
   `npm run generate-apple-secret -- /path/to/AuthKey_AN9QJ8343L.p8`
   Sets `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`, `APPLE_APP_BUNDLE_IDENTIFIER`.
   In the same pass set `GOOGLE_CLIENT_ID` and `GOOGLE_IOS_CLIENT_ID` to the clients
   above and `GOOGLE_CLIENT_SECRET` to the rotated secret.
2. Redeploy, then **verify web Google login still works and an existing user lands on
   their existing account** — this changes both the client id array and the project.
3. `npx eas login && npx eas init` — writes `extra.eas.projectId` into `app.json`.
4. `npx eas build --profile development --platform ios`, install on a physical iPhone.
   Expo Go no longer works for this app: `@react-native-google-signin/google-signin`
   is native code, so a development build is required.
5. Test on device: Google sign-in, Apple sign-in, account deletion, offline play,
   daily reminder. Confirm both providers land on one user row, not two.
6. `npx eas build --profile production --platform ios`
7. `npx eas submit --platform ios` — prompts for Apple ID plus an app-specific
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
