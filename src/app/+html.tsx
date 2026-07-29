import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { ReactNode } from 'react';

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
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
