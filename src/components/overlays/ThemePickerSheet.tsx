import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Check from 'lucide-react-native/icons/check';
import { useAppearance } from '@/state/appearanceStore';
import { useThemeStore, useThemeTokens } from '@/state/themeStore';
import { THEME_OPTIONS, THEMES } from '@/theme/themes';
import { playHaptic } from '@/lib/haptics';
import { hitSlopFor } from '@/lib/touchTarget';
import { useI18n } from '@/i18n';

const BACK_BUTTON_SIZE = 36;
const BACK_BUTTON_HIT_SLOP = hitSlopFor({ width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE });

export interface ThemePickerSheetHandle {
  present: () => void;
}

interface ThemePickerSheetProps {
  onBack: () => void;
}

export const ThemePickerSheet = forwardRef<ThemePickerSheetHandle, ThemePickerSheetProps>(function ThemePickerSheet({ onBack }, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const theme = useThemeTokens();
  const appearance = useAppearance();
  const { t } = useI18n();
  const themeName = useThemeStore(state => state.themeName);
  const setThemeName = useThemeStore(state => state.setThemeName);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
  }));

  function selectTheme(name: typeof themeName) {
    // Picking one of a row of peers, the same gesture a segmented control answers.
    playHaptic('selection');
    setThemeName(name);
    sheetRef.current?.dismiss();
  }

  function goBack() {
    sheetRef.current?.dismiss();
    setTimeout(onBack, 180);
  }

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['70%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: theme.bg }}
      handleIndicatorStyle={{ backgroundColor: theme.gridSep }}
    >
      <BottomSheetView style={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" style={[styles.backButton, { borderColor: theme.gridSep }]} hitSlop={BACK_BUTTON_HIT_SLOP} onPress={goBack} accessibilityLabel={t('a11y.backToSettings')}>
            <ArrowLeft size={18} color={theme.text} strokeWidth={2.3} />
          </Pressable>
          <Text style={[styles.title, { color: theme.text }]}>{t('theme.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.list}>
          {THEME_OPTIONS.map(name => {
            const selected = name === themeName;
            // The row previews the theme as it will look right now, so it follows the
            // appearance the app is painting rather than always showing the light palette.
            const optionTheme = THEMES[name][appearance];
            return (
              <Pressable
                accessibilityRole="button"
                key={name}
                style={[
                  styles.option,
                  { backgroundColor: optionTheme.bg, borderColor: selected ? optionTheme.accent : optionTheme.gridSep },
                ]}
                onPress={() => selectTheme(name)}
                accessibilityLabel={t('a11y.useTheme', { theme: t(`theme.${name}`) })}
                accessibilityState={{ selected }}
              >
                <View style={styles.optionCopy}>
                  <View style={styles.swatches}>
                    {[optionTheme.bg, optionTheme.accent, optionTheme.text].map(color => <View key={color} style={[styles.swatch, { backgroundColor: color }]} />)}
                  </View>
                  <Text style={[styles.optionLabel, { color: optionTheme.text }]}>{t(`theme.${name}`)}</Text>
                </View>
                {selected && <Check size={19} color={optionTheme.accent} strokeWidth={2.8} />}
              </Pressable>
            );
          })}
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Painted at 36 beside a 20pt title; hitSlop, not size, takes the tap area to 44.
  backButton: { width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE, borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: BACK_BUTTON_SIZE },
  // Centred between two 36pt buttons; flex lets a long translated title wrap instead of
  // shoving the back button off the sheet.
  title: { flex: 1, minWidth: 0, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  list: { gap: 8, marginTop: 18 },
  option: { minHeight: 48, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  optionCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatches: { flexShrink: 0, flexDirection: 'row', gap: 3 },
  swatch: { width: 15, height: 15, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  optionLabel: { flexShrink: 1, minWidth: 0, fontSize: 15, fontWeight: '700' },
});
