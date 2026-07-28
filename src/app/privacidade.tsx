import { ScrollView, StyleSheet } from 'react-native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import { router } from 'expo-router';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrivacyPolicy } from '@/components/PrivacyPolicy';
import { useThemeTokens } from '@/state/themeStore';
import { hitSlopFor } from '@/lib/touchTarget';
import { useI18n } from '@/i18n';

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
      <PrivacyPolicy />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 24 },
  // Painted at 38 above a 28pt heading; hitSlop, not size, takes the tap area to 44.
  back: { width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE, borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
});
