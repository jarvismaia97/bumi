import { StyleSheet, Text, View } from 'react-native';
import { useThemeTokens } from '@/state/themeStore';
import { useI18n } from '@/i18n';

// Friends sits after location and before deletion: it is the one place data reaches another
// person, so it is stated before the paragraph about taking it all back.
const SECTIONS = ['stored', 'purpose', 'location', 'friends', 'delete', 'contact'] as const;

/**
 * The same copy is served two ways: as a sheet from Settings, matching how Achievements and
 * Themes open, and as the /privacidade route, which is the public URL declared to the App
 * Store. Only the presentation differs, so the text itself lives here.
 */
export function PrivacyPolicy({ showTitle = true }: { showTitle?: boolean }) {
  const theme = useThemeTokens();
  const { t } = useI18n();

  return (
    <View>
      {showTitle && <Text style={[styles.title, { color: theme.text }]}>{t('privacy.title')}</Text>}
      <Text style={[styles.updated, { color: theme.sub }]}>{t('privacy.updated')}</Text>

      {SECTIONS.map(section => (
        <View key={section} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t(`privacy.${section}Title`)}</Text>
          <Text style={[styles.body, { color: theme.sub }]}>{t(`privacy.${section}Body`)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800' },
  updated: { fontSize: 12, marginTop: 5, marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  body: { fontSize: 14, lineHeight: 21 },
});
