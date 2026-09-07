/**
 * The iOS listing, live since 2026-09-04. The numeric id is what Safari's smart banner wants in
 * `+html.tsx`; the URL is what a press opens. `apps.apple.com/app/id<id>` carries no country
 * segment on purpose — Apple resolves it to the visitor's own storefront, which is what the
 * Portuguese, English and Spanish listings are there for.
 *
 * There is no Play equivalent yet: the Android build is still in a closed test, so a link would
 * lead a player to a page they cannot install from. Add it here when that track opens.
 */
export const APP_STORE_APP_ID = '6794318786';
export const APP_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_APP_ID}`;
