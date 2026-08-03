import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { ReactNode } from 'react';
import { THEMES } from '@/theme/themes';

/**
 * The ground the document stands on, which is the only colour the page has before React paints
 * anything. Plain CSS, because it has to hold in the gap where no JavaScript has run yet: the
 * gate in `@/lib/hydration` pins the first pass to the light palette, so without this a dark
 * device gets a light frame before the app repaints itself.
 *
 * It follows the device only. The in-app override lives in storage, which CSS cannot read, so a
 * player who forces dark on a light phone still gets that one light frame. It is also always
 * `classic`, for the same reason — the chosen theme is not knowable this early. Both are safe
 * to be wrong about: the screens paint their own background over this within the first frame,
 * and what stays visible is the overscroll past the end of a page.
 */
const GROUND_CSS = `
  :root { color-scheme: light dark; }
  html, body { background-color: ${THEMES.classic.light.bg}; }
  @media (prefers-color-scheme: dark) {
    html, body { background-color: ${THEMES.classic.dark.bg}; }
  }
`;

/**
 * The document every web page is rendered into. Its only reason to exist is `lang`: the
 * default template hardcodes `en`, and this is a Portuguese-first site — screen readers and
 * search engines both read that attribute. It matches `resolveLanguage(null)`, which is what
 * the catalogue falls back to when there is no device locale, as is the case during static
 * rendering. The app still switches language client-side; one static document serves all
 * three, so this states the default rather than the current choice.
 *
 * Everything else here reproduces what the default template injected, since providing this
 * file replaces it wholesale. Per-page tags stay in `_layout.tsx` under `expo-router/head`.
 */
export default function Root({ children }: { children: ReactNode }) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();

  return (
    <html {...htmlAttributes} lang="pt-PT">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        {headNodes}
        <ScrollViewStyleReset />
        {/* After the reset, which sets its own background on the body. */}
        <style>{GROUND_CSS}</style>
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
