import { Link } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '@/components/Logo';
import { GUIDE_ENDONYMS, GUIDES, type Guide } from '@/content/guide';
import { useThemeTokens } from '@/state/themeStore';

const SITE_URL = 'https://www.jogarbumi.pt';

/**
 * One page per language, rendered into the static document where a crawler can read it.
 *
 * `hreflang` carries the language targeting, because `<html lang>` cannot: `+html.tsx` is one
 * document shared by every route and the static export has no request to vary it by. The
 * effect that corrects `documentElement.lang` after mount is for screen readers rather than
 * search — a reader announcing English prose in a Portuguese voice is the part that hurts.
 */
export function GuidePage({ guide }: { guide: Guide }) {
  const theme = useThemeTokens();
  const insets = useSafeAreaInsets();
  const others = Object.values(GUIDES).filter(other => other.language !== guide.language);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.documentElement.lang = guide.language;
  }, [guide.language]);

  return (
    <>
      <Head>
        <title>{guide.title}</title>
        <meta name="description" content={guide.description} />
        <link rel="canonical" href={`${SITE_URL}${guide.path}`} />
        {/* Every page lists every page, itself included: a set of alternates that does not
            point back at each member is ignored. `x-default` is the Portuguese one, which is
            what the bare domain already serves.

            Written out rather than mapped: `expo-router/head` collects the literal children of
            this element, and an array from `.map()` reached the document as nothing at all —
            the canonical beside it went through, which is what made the omission visible. */}
        <link rel="alternate" hrefLang="pt-PT" href={`${SITE_URL}${GUIDES['pt-PT'].path}`} />
        <link rel="alternate" hrefLang="en" href={`${SITE_URL}${GUIDES.en.path}`} />
        <link rel="alternate" hrefLang="es" href={`${SITE_URL}${GUIDES.es.path}`} />
        <link rel="alternate" hrefLang="x-default" href={`${SITE_URL}${GUIDES['pt-PT'].path}`} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={guide.title} />
        <meta property="og:description" content={guide.description} />
        <meta property="og:url" content={`${SITE_URL}${guide.path}`} />
        <meta property="og:locale" content={guide.ogLocale} />
        <meta property="og:image" content={`${SITE_URL}/share-card.png`} />
      </Head>

      <ScrollView
        style={[styles.screen, { backgroundColor: theme.bg }]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 40 }]}
      >
        <View style={styles.brand}>
          <Logo size={44} />
          <Text style={[styles.wordmark, { color: theme.text }]}>Bumi</Text>
        </View>

        <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>{guide.heading}</Text>
        <Text style={[styles.intro, { color: theme.sub }]}>{guide.intro}</Text>

        {/* Above the rules as well as below them: someone who already knows Shikaku should not
            have to read three rules to find the way in. */}
        <Link href="/" style={[styles.play, { backgroundColor: theme.accent }]}>
          <Text style={styles.playText}>{guide.play}</Text>
        </Link>

        {guide.rules.map(rule => (
          <View key={rule.title} style={styles.section}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.text }]}>{rule.title}</Text>
            <Text style={[styles.body, { color: theme.sub }]}>{rule.body}</Text>
          </View>
        ))}

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.text }]}>{guide.difference.title}</Text>
          <Text style={[styles.body, { color: theme.sub }]}>{guide.difference.body}</Text>
        </View>

        <Text style={[styles.pitch, { color: theme.text }]}>{guide.pitch}</Text>

        <Link href="/" style={[styles.play, { backgroundColor: theme.accent }]}>
          <Text style={styles.playText}>{guide.play}</Text>
        </Link>

        <Text style={[styles.elsewhere, { color: theme.sub }]}>{guide.elsewhere}</Text>
        <View style={styles.languages}>
          {others.map(other => (
            // See `Guide.path`: the generated route union lags a new file, so the cast stands
            // in for a check the build cannot make yet.
            <Link key={other.language} href={other.path as '/'} style={[styles.language, { borderColor: theme.gridSep, color: theme.text }]}>
              {GUIDE_ENDONYMS[other.language]}
            </Link>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 24, maxWidth: 680, width: '100%', alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 22 },
  wordmark: { fontSize: 26, fontWeight: '800' },
  heading: { fontSize: 30, fontWeight: '800', lineHeight: 36 },
  intro: { fontSize: 16, lineHeight: 24, marginTop: 12 },
  play: { alignSelf: 'flex-start', borderRadius: 10, paddingVertical: 13, paddingHorizontal: 22, marginTop: 22, marginBottom: 8 },
  playText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  section: { marginTop: 22 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 23, marginTop: 6 },
  pitch: { fontSize: 15, lineHeight: 23, fontWeight: '600', marginTop: 28 },
  elsewhere: { fontSize: 13, fontWeight: '600', marginTop: 32 },
  languages: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  language: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14, fontSize: 14, fontWeight: '600' },
});
