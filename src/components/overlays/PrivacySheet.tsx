import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { PrivacyPolicy } from '@/components/PrivacyPolicy';
import { hitSlopFor } from '@/lib/touchTarget';
import { useThemeTokens } from '@/state/themeStore';
import { useI18n } from '@/i18n';

export interface PrivacySheetHandle {
  present: () => void;
}

const BACK_BUTTON_SIZE = 36;
const BACK_BUTTON_HIT_SLOP = hitSlopFor({ width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE });

// Opens like Achievements and Themes so the three rows in Settings behave alike; the policy
// used to push a full screen whose back arrow returned to the game rather than to Settings.
export const PrivacySheet = forwardRef<PrivacySheetHandle>(function PrivacySheet(_, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const theme = useThemeTokens();
  const { t } = useI18n();

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
  }));

  // Dismissing is enough: the provider restores the settings sheet underneath.
  function goBack() {
    sheetRef.current?.dismiss();
  }

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['86%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: theme.bg }}
      handleIndicatorStyle={{ backgroundColor: theme.gridSep }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <AnimatedPressable
            accessibilityRole="button"
            feedback="icon"
            style={[styles.backButton, { borderColor: theme.gridSep }]}
            hitSlop={BACK_BUTTON_HIT_SLOP}
            onPress={goBack}
            accessibilityLabel={t('a11y.backToSettings')}
          >
            <ArrowLeft size={18} color={theme.text} strokeWidth={2.3} />
          </AnimatedPressable>
          <Text style={[styles.title, { color: theme.text }]}>{t('privacy.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <PrivacyPolicy showTitle={false} />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 10 },
  backButton: { minWidth: BACK_BUTTON_SIZE, minHeight: BACK_BUTTON_SIZE, borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { flexShrink: 1, minWidth: 0, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  headerSpacer: { width: BACK_BUTTON_SIZE, flexShrink: 0 },
});
