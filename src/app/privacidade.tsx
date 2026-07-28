import { ScrollView, StyleSheet, Text, View } from 'react-native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import { router } from 'expo-router';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeTokens } from '@/state/themeStore';
import { hitSlopFor } from '@/lib/touchTarget';
import { useI18n } from '@/i18n';

const SECTIONS = ['stored', 'purpose', 'location', 'delete', 'contact'] as const;

const BACK_BUTTON_SIZE = 38;
const BACK_BUTTON_HIT_SLOP = hitSlopFor({ width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE });

export default function PrivacyScreen() {
  const theme = useThemeTokens();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  return (
    <ScrollView style={[styles.screen, { backgroundColor: theme.bg }]} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}>
      <AnimatedPressable accessibilityRole="button" feedback="icon" style={[styles.back, { borderColor: theme.gridSep, backgroundColor: theme.surface }]} hitSlop={BACK_BUTTON_HIT_SLOP} onPress={() => router.back()} accessibilityLabel={t('a11y.back')}>
        <ArrowLeft size={19} color={theme.text} strokeWidth={2.3} />
      </AnimatedPressable>
      <Text style={[styles.title, { color: theme.text }]}>{t('privacy.title')}</Text>
      <Text style={[styles.updated, { color: theme.sub }]}>{t('privacy.updated')}</Text>

      {SECTIONS.map(section => (
        <View key={section} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t(`privacy.${section}Title`)}</Text>
          <Text style={[styles.body, { color: theme.sub }]}>{t(`privacy.${section}Body`)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 24 },
  // Painted at 38 above a 28pt heading; hitSlop, not size, takes the tap area to 44.
  back: { width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE, borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  title: { fontSize: 28, fontWeight: '800' },
  updated: { fontSize: 12, marginTop: 5, marginBottom: 28 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  body: { fontSize: 14, lineHeight: 21 },
});
