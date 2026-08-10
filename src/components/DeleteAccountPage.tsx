import { StyleSheet, Text, View } from 'react-native';
import { useThemeTokens } from '@/state/themeStore';
import { useI18n } from '@/i18n';

const SECTIONS = ['how', 'removed', 'permanent'] as const;

/**
 * The public account-deletion page, which exists because Google Play requires a URL where
 * deletion can be requested *without installing the app* — a policy an in-app settings row
 * cannot satisfy on its own, however complete it is.
 *
 * Bumi answers it honestly rather than with a form: the web build at jogarbumi.pt is the same
 * app, so signing in there and using Settings needs no install and deletes exactly what the
 * phone would. The page's job is to say so, and to list what goes, since "delete my account"
 * is a promise worth spelling out before it is kept.
 */
export function DeleteAccountPage() {
  const theme = useThemeTokens();
  const { t } = useI18n();

  return (
    <View>
      <Text style={[styles.title, { color: theme.text }]}>{t('deleteAccount.title')}</Text>
      <Text style={[styles.intro, { color: theme.sub }]}>{t('deleteAccount.intro')}</Text>

      {SECTIONS.map(section => (
        <View key={section} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t(`deleteAccount.${section}Title`)}</Text>
          <Text style={[styles.body, { color: theme.sub }]}>{t(`deleteAccount.${section}Body`)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800' },
  intro: { fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  body: { fontSize: 14, lineHeight: 21 },
});
