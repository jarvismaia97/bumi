import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Check from 'lucide-react-native/icons/check';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { playHaptic } from '@/lib/haptics';
import { hitSlopFor } from '@/lib/touchTarget';
import { useLanguageStore, type LanguagePreference } from '@/state/languageStore';
import { useThemeTokens } from '@/state/themeStore';
import { useI18n } from '@/i18n';

export interface LanguageSheetHandle {
  present: () => void;
}

const BACK_BUTTON_SIZE = 36;
const BACK_BUTTON_HIT_SLOP = hitSlopFor({ width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE });

/** Native names, so a player who lands in the wrong language can still find their own. */
export const LANGUAGE_OPTIONS: { value: LanguagePreference; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'pt-PT', label: 'Português' },
  { value: 'en', label: 'English' },
];

// Opens like Themes, Achievements and the privacy policy. It used to expand in place, which
// left one of the four settings rows behaving unlike the other three.
export const LanguageSheet = forwardRef<LanguageSheetHandle>(function LanguageSheet(_, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const theme = useThemeTokens();
  const { t } = useI18n();
  const preference = useLanguageStore(state => state.preference);
  const setPreference = useLanguageStore(state => state.setPreference);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
  }));

  function select(value: LanguagePreference) {
    playHaptic('selection');
    setPreference(value);
    sheetRef.current?.dismiss();
  }

  // Dismissing is enough: the provider restores the settings sheet underneath.
  function goBack() {
    sheetRef.current?.dismiss();
  }

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: theme.bg }}
      handleIndicatorStyle={{ backgroundColor: theme.gridSep }}
    >
      <BottomSheetView style={styles.content}>
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
          <Text style={[styles.title, { color: theme.text }]}>{t('settings.language')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.list}>
          {LANGUAGE_OPTIONS.map(option => {
            const selected = option.value === preference;
            return (
              <AnimatedPressable
                accessibilityRole="button"
                key={option.value}
                style={[styles.option, { backgroundColor: theme.surface, borderColor: selected ? theme.accent : theme.gridSep }]}
                onPress={() => select(option.value)}
                accessibilityState={{ selected }}
              >
                <View style={styles.optionCopy}>
                  <Text style={[styles.optionLabel, { color: theme.text }]}>
                    {option.value === 'auto' ? t('settings.languageAuto') : option.label}
                  </Text>
                  {option.value === 'auto' && (
                    <Text style={[styles.optionDetail, { color: theme.sub }]}>{t('settings.languageAutoDetail')}</Text>
                  )}
                </View>
                {selected && <Check size={19} color={theme.accent} strokeWidth={2.8} />}
              </AnimatedPressable>
            );
          })}
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 34 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  backButton: { minWidth: BACK_BUTTON_SIZE, minHeight: BACK_BUTTON_SIZE, borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { flexShrink: 1, minWidth: 0, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  headerSpacer: { width: BACK_BUTTON_SIZE, flexShrink: 0 },
  list: { gap: 8, marginTop: 18 },
  option: { minHeight: 52, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionCopy: { flexShrink: 1, minWidth: 0 },
  optionLabel: { fontSize: 15, fontWeight: '700' },
  optionDetail: { fontSize: 11, lineHeight: 15, marginTop: 2 },
});
