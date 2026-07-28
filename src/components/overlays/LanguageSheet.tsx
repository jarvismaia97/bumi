import { forwardRef, useRef, useImperativeHandle } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { SettingsChildSheet, type SettingsChildSheetHandle } from '@/components/overlays/SettingsChildSheet';
import { playHaptic } from '@/lib/haptics';
import { useLanguageStore, type LanguagePreference } from '@/state/languageStore';
import { useThemeTokens } from '@/state/themeStore';
import { useI18n } from '@/i18n';

export type LanguageSheetHandle = SettingsChildSheetHandle;

/** Native names, so a player who lands in the wrong language can still find their own. */
export const LANGUAGE_OPTIONS: { value: LanguagePreference; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'pt-PT', label: 'Português' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
];

export const LanguageSheet = forwardRef<LanguageSheetHandle>(function LanguageSheet(_, ref) {
  const sheetRef = useRef<SettingsChildSheetHandle>(null);
  const theme = useThemeTokens();
  const { t } = useI18n();
  const preference = useLanguageStore(state => state.preference);
  const setPreference = useLanguageStore(state => state.setPreference);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  function select(value: LanguagePreference) {
    playHaptic('selection');
    setPreference(value);
    sheetRef.current?.dismiss();
  }

  return (
    <SettingsChildSheet ref={sheetRef} title={t('settings.language')}>
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
    </SettingsChildSheet>
  );
});

const styles = StyleSheet.create({
  list: { gap: 8, marginTop: 18 },
  option: { minHeight: 52, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionCopy: { flexShrink: 1, minWidth: 0 },
  optionLabel: { fontSize: 15, fontWeight: '700' },
  optionDetail: { fontSize: 11, lineHeight: 15, marginTop: 2 },
});
