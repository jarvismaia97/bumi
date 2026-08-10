import { ScrollView, StyleSheet } from 'react-native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import { router } from 'expo-router';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeleteAccountPage } from '@/components/DeleteAccountPage';
import { useThemeTokens } from '@/state/themeStore';
import { hitSlopFor } from '@/lib/touchTarget';
import { useI18n } from '@/i18n';

const BACK_BUTTON_SIZE = 38;
const BACK_BUTTON_HIT_SLOP = hitSlopFor({ width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE });

/**
 * One route, in the player's own language, like /privacidade — the guide has a page per
 * language because search engines index it, and this one is a policy URL pasted into a console
 * once. A single stable address is worth more here than three translated ones.
 */
export default function DeleteAccountScreen() {
  const theme = useThemeTokens();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  return (
    <ScrollView style={[styles.screen, { backgroundColor: theme.bg }]} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}>
      <AnimatedPressable accessibilityRole="button" feedback="icon" style={[styles.back, { borderColor: theme.gridSep, backgroundColor: theme.surface }]} hitSlop={BACK_BUTTON_HIT_SLOP} onPress={() => router.back()} accessibilityLabel={t('a11y.back')}>
        <ArrowLeft size={19} color={theme.text} strokeWidth={2.3} />
      </AnimatedPressable>
      <DeleteAccountPage />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 24 },
  back: { width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE, borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
});
