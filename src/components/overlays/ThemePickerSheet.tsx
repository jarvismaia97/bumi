import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Check from 'lucide-react-native/icons/check';
import { useThemeStore, useThemeTokens } from '@/state/themeStore';
import { THEME_OPTIONS, THEMES } from '@/theme/themes';
import { useI18n } from '@/i18n';

export interface ThemePickerSheetHandle {
  present: () => void;
}

interface ThemePickerSheetProps {
  onBack: () => void;
}

export const ThemePickerSheet = forwardRef<ThemePickerSheetHandle, ThemePickerSheetProps>(function ThemePickerSheet({ onBack }, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const theme = useThemeTokens();
  const { t } = useI18n();
  const themeName = useThemeStore(state => state.themeName);
  const setThemeName = useThemeStore(state => state.setThemeName);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
  }));

  function selectTheme(name: typeof themeName) {
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
          <Pressable style={[styles.backButton, { borderColor: theme.gridSep }]} onPress={goBack} accessibilityLabel={t('a11y.backToSettings')}>
            <ArrowLeft size={18} color={theme.text} strokeWidth={2.3} />
          </Pressable>
          <Text style={[styles.title, { color: theme.text }]}>{t('theme.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.list}>
          {THEME_OPTIONS.map(option => {
            const selected = option.name === themeName;
            const optionTheme = THEMES[option.name];
            return (
              <Pressable
                key={option.name}
                style={[
                  styles.option,
                  { backgroundColor: optionTheme.bg, borderColor: selected ? optionTheme.accent : optionTheme.gridSep },
                ]}
                onPress={() => selectTheme(option.name)}
                accessibilityLabel={t('a11y.useTheme', { theme: t(`theme.${option.name}`) })}
                accessibilityState={{ selected }}
              >
                <View style={styles.optionCopy}>
                  <View style={styles.swatches}>
                    {option.preview.map(color => <View key={color} style={[styles.swatch, { backgroundColor: color }]} />)}
                  </View>
                  <Text style={[styles.optionLabel, { color: optionTheme.text }]}>{t(`theme.${option.name}`)}</Text>
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
  backButton: { width: 36, height: 36, borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 36 },
  title: { fontSize: 20, fontWeight: '800' },
  list: { gap: 8, marginTop: 18 },
  option: { minHeight: 48, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionCopy: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatches: { flexDirection: 'row', gap: 3 },
  swatch: { width: 15, height: 15, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  optionLabel: { fontSize: 15, fontWeight: '700' },
});
