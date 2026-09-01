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

## Screenshots

Apple's required size is the 6.9" set — 1320x2868. `supportsTablet` is false, so there is no
iPad set. Each language with a listing wants its own set.

Captured 2026-08-18 from the production web build rather than a simulator, at
`assets/store/ios-6.9/<lang>/` for `pt`, `en` and `es`:

1. `01-menu` — menu with progress, medals and the daily.
2. `02-mapa-ilhas` — island map with unlocked levels.
3. `03-tabuleiro` — a 12x12 mid-solve.
4. `04-vitoria` — the win sheet.
5. `05-amigos` — the friends board, invite code masked.

The Playwright MCP has no deviceScaleFactor option, and `scale: "device"` follows the browser's
own ratio, which is 1 — so a 3x shot needs a context built by hand with
`newContext({ viewport, deviceScaleFactor: 3, storageState })`, seeded from the signed-in
page's storage state. `.playwright-mcp/capture.js` is that script.

**Uploaded 2026-08-18** to version 1.0, one set per localization. Two things about the console
that cost time: the 6.9" slot is hidden behind *Ver todos os tamanhos em Gestor de multimédia*
— the page shows 6.5" by default, which rejects 1320x2868 — and a multi-file upload lands in an
arbitrary order, so the five go up one at a time. The other sizes then read *A utilizar Ecrã de
6,9"*, so 6.9" is the only set that has to exist.

## Store listing state, 2026-08-18

The listing was empty on Apple's side — description, keywords and support URL were blank in
every language, including Portuguese. Now filled and saved (nothing submitted for review):

| Localization | Name | Subtitle | Description | Keywords | Screenshots |
| --- | --- | --- | --- | --- | --- |
| pt-PT (primary) | Bumi: Puzzle de Lógica | Puzzle de retângulos | 1954 chars | 54 | own set |
| en-US | Bumi: Logic Puzzle | Rectangle logic puzzle | 1992 | 59 | own set |
| es-ES | Bumi: Puzle de Lógica | Lógica con rectángulos | 2021 | 60 | own set |

The descriptions are the long ones from `play-store.md`, not the three-sentence versions written
above — the same app deserves the same copy on both stores, and the short one reads thin on a
product page. The Spanish subtitle is *Lógica con rectángulos* rather than the one drafted here,
which was 31 characters against Apple's limit of 30. Support URL is the privacy page in all
three, for the reason given below.

Not done: en-GB, es-MX and the other variants. Apple falls back to the primary language, so a
British visitor sees Portuguese unless en-GB exists; add it if that matters.

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

Nothing. The last item — disabling an old Google client secret that had leaked into a chat
transcript — was checked in the console on 2026-08-17 and no longer exists: the `bumi web`
client carries exactly one secret, created 2026-07-25 and active, with no second one to
disable. Whatever the leaked value was, it is not among the client's keys, so it cannot
authenticate. This entry stayed open here long after the fact was no longer true, which is
the argument for reading the console rather than the note about it.

Worth a look while you are there: the project holds **three** Android OAuth clients
(`Bumi Android 1`, `Cliente Android 2`, `Cliente Android 3`, all 2026-08-11) where the two
certificates below need only two. One is likely redundant, and an OAuth client nobody can
account for is worth removing rather than leaving.

Sign in with Apple works on a real device, so the
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
8. Upload the 6.9" screenshots above, one set per listing language.
9. Privacy questionnaire: email and name (Google/Apple sign-in) plus game progress,
   linked to identity. The friends board shares progress *between players* — a painter
   nickname, points, level count and streak, never a name, email or account id — so the
   questionnaire's "data used to track you" stays No while progress remains linked to
   identity. The policy paragraph covering it is `privacy.friends*` in the catalogue.

## What an App Store submission actually needs

Version 1.0.0 went in for review on 2026-08-21, and the console refused it five times first. None
of these were listed anywhere; each one only appears as a line in *Não é possível adicionar para
revisão* after pressing the button:

| Blocker | What it was |
| --- | --- |
| No build | The version had no build attached at all. TestFlight having build 48 is not the same thing — it has to be added to the version under *Compilação*. |
| Privacy policy URL | Empty. The address had been put in *URL das seleções de privacidade do utilizador*, which is optional and a different field. And it is **per localization** — filling pt-PT leaves en-US and es-ES still empty and still blocking. |
| App privacy not published | The answers existed but were never published, and publishing is an explicit affirmation that they are accurate. |
| Age rating | Never answered. Seven steps; every answer is the first column for a Shikaku puzzle, and it lands on 4+ in 172 countries. |
| Content rights | Never answered. No third-party content. |
| Price and availability | Never set. Free, all 175 countries. Apple will not review an app that has no price. |

Two more that block review without being errors: the App Review contact (name, phone, email) and,
if *Necessário iniciar sessão* is ticked, demo credentials. Bumi signs in through Apple and Google
only, so there is no username and password to give — the box is unticked and the notes tell the
reviewer to use Sign in with Apple with their own account, and that the tutorial, the first ten
levels, the daily and training all run with no account at all.

**Release is set to manual.** It was on *automatic after approval*, which would have put 1.0.0 on
the App Store the day it passed — weeks before the Android closed test finishes. Manual keeps the
date a decision.

### App privacy, as declared

Three data types, all *App Functionality*, all linked to identity, none used for tracking: Name,
Email Address, and Gameplay Content — which is Apple's category for game progress, and the one
this app's whole sync feature is about. The email entry had *Marketing or Developer Advertising*
ticked, which contradicts the listing's "no ads" line and the ad-ID declaration on Play; it was
wrong and is now off. It has to go back on the day any newsletter starts.

## Submitted

| Build | Version | Date | Notes |
| --- | --- | --- | --- |
| 29 | 1.0.0 | 2026-08-01 | First TestFlight upload. Carries Spanish, the mistake-based medals, the friends board and its notifications, the error boundary, and SDK 57 patch alignment. |
| 48 | 1.0.0 | 2026-08-18 | Carries the stored-language fix, so a bad language preference no longer blanks the app. First build since 29, and the one the 6.9" screenshots were taken against. Submitted for App Review on 2026-08-21 from commit `e5fa2ad`, the same commit as Android version code 9. Not yet tested on a device against FCM — which is the argument for the manual release. |
| 49 | 1.0.0 | 2026-08-25 | `a6c8f10` — the launch screen was still the Expo template's logo. |
| 50 | 1.0.0 | 2026-08-26 | `89fbb6e` — the menu brand mark stayed a blank square after the first navigation. |
| 51 | 1.0.0 | 2026-08-27 | `e7890e9` — four taps that went quiet for the length of a round trip. **This is the build attached to version 1.0.0 today**, and the one the review screen recording was taken against. |

## Review, read from the console on 2026-09-01

The 21 August submission was **rejected on 2026-08-22 01:27**, under
*2.1.0 Performance: App Completeness* — Apple's *Guideline 2.1 - Information Needed - New App
Submission*, which is a request for information rather than a fault found in the app. Seven
things were asked for: a screen recording on a physical device covering the core flow
(registration, login, account deletion, purchases, user content, permission prompts), the device
models and OS versions tested, a description of the app and its audience, setup and access
instructions, the external services behind the core functionality, any regional differences, and
documentation for regulated industries or third-party material.

Answered on **2026-08-30 18:10**: all seven in the *Notas* field of App Review Information, plus
`bumi_review_v3_h264.mp4` — one take, no cuts, iPhone 16 Pro Max on iOS 27, from the home screen
through the tutorial, campaign, win sheet, island map, daily, training, Sign in with Apple, the
friends board (add by code, remove), the reminder permission prompt, and account deletion ending
on a signed-out menu at zero progress. Point 4 was answered by saying there are no demo
credentials to give: the app has no username-and-password sign-up, so the reviewer signs in with
their own Apple Account (Hide My Email works) or plays signed out.

Apple replied **2026-08-31 09:28** with the boilerplate *"Please resubmit the app for review in
App Store Connect once any necessary adjustments have been made"*. That is not a re-review: a
rejected submission stays rejected until it is sent again. On 2026-09-01 the version reads
**Preparar para envio** with build 51 attached, and the submission page reads *Problemas por
resolver*.

**So the ball is here, not at Apple.** The action is *Enviar novamente para a equipa de revisão de
apps* on the submission page — the button renders grey but carries no `disabled` attribute. Note
that the reply and the recording live on the old submission thread; the Notes field is what
travels with a new submission, which is why the seven answers were put there rather than only in
the message.

## Maintenance

- `APPLE_CLIENT_SECRET` expires at most six months after generation and nothing
  rotates it automatically. Apple sign-in breaks silently when it lapses. Record the
  expiry date printed by the script here: **expires 2027-01-23** (generated 2026-07-25).
- App icon must stay free of an alpha channel; App Store Connect rejects transparency.
- `android.package` is set to `pt.jogarbumi.app`; the Android side is written up in `play-store.md`.
