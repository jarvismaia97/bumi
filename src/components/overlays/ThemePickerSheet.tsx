import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Check from 'lucide-react-native/icons/check';
import Lock from 'lucide-react-native/icons/lock';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { useAppearance } from '@/state/appearanceStore';
import { useThemeStore, useThemeTokens } from '@/state/themeStore';
import { THEME_OPTIONS, THEMES } from '@/theme/themes';
import { getUnlockStats, isThemeUnlocked, remainingFor, THEME_REQUIREMENTS } from '@/game/unlocks';
import { useProgressStore } from '@/state/progressStore';
import { playHaptic } from '@/lib/haptics';
import { hitSlopFor } from '@/lib/touchTarget';
import { useI18n } from '@/i18n';

const BACK_BUTTON_SIZE = 36;
const BACK_BUTTON_HIT_SLOP = hitSlopFor({ width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE });

export interface ThemePickerSheetHandle {
  present: () => void;
}

export const ThemePickerSheet = forwardRef<ThemePickerSheetHandle>(function ThemePickerSheet(_, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const theme = useThemeTokens();
  const appearance = useAppearance();
  const { t } = useI18n();
  const solvedMap = useProgressStore(state => state.solvedMap);
  const solvedDateMap = useProgressStore(state => state.solvedDateMap);
  const levelMedals = useProgressStore(state => state.levelMedals);
  const dailyStreak = useProgressStore(state => state.dailyStreak);
  const unlockStats = getUnlockStats({ solvedMap, solvedDateMap, levelMedals, dailyStreak: dailyStreak() });

  /** Says what the lock is waiting on, so it reads as a goal rather than a wall. */
  function lockHint(name: (typeof THEME_OPTIONS)[number]): string {
    const missing = remainingFor(THEME_REQUIREMENTS[name], unlockStats);
    if (missing.islands) return t('theme.needIslands', { count: missing.islands, label: t(missing.islands === 1 ? 'theme.island' : 'theme.islands') });
    if (missing.achievements) return t('theme.needAchievements', { count: missing.achievements, label: t(missing.achievements === 1 ? 'theme.achievement' : 'theme.achievements') });
    if (missing.goldMedals) return t('theme.needGold', { count: missing.goldMedals });
    return t('theme.locked');
  }
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

  // Dismissing is enough: the provider restores the settings sheet underneath.
  function goBack() {
    sheetRef.current?.dismiss();
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
          <AnimatedPressable accessibilityRole="button" feedback="icon" style={[styles.backButton, { borderColor: theme.gridSep }]} hitSlop={BACK_BUTTON_HIT_SLOP} onPress={goBack} accessibilityLabel={t('a11y.backToSettings')}>
            <ArrowLeft size={18} color={theme.text} strokeWidth={2.3} />
          </AnimatedPressable>
          <Text style={[styles.title, { color: theme.text }]}>{t('theme.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.list}>
          {THEME_OPTIONS.map(name => {
            const selected = name === themeName;
            const unlocked = isThemeUnlocked(name, unlockStats);
            // The row previews the theme as it will look right now, so it follows the
            // appearance the app is painting rather than always showing the light palette.
            const optionTheme = THEMES[name][appearance];
            return (
              <AnimatedPressable
                accessibilityRole="button"
                key={name}
                style={[
                  styles.option,
                  { backgroundColor: optionTheme.bg, borderColor: selected ? optionTheme.accent : optionTheme.gridSep },
                ]}
                onPress={() => unlocked && selectTheme(name)}
                disabled={!unlocked}
                accessibilityLabel={unlocked ? t('a11y.useTheme', { theme: t(`theme.${name}`) }) : `${t(`theme.${name}`)}. ${lockHint(name)}`}
                accessibilityState={{ selected, disabled: !unlocked }}
              >
                <View style={styles.optionCopy}>
                  <View style={styles.swatches}>
                    {[optionTheme.bg, optionTheme.accent, optionTheme.text].map(color => <View key={color} style={[styles.swatch, { backgroundColor: color, opacity: unlocked ? 1 : 0.45 }]} />)}
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, { color: optionTheme.text, opacity: unlocked ? 1 : 0.5 }]}>{t(`theme.${name}`)}</Text>
                    {!unlocked && <Text style={[styles.lockHint, { color: optionTheme.sub }]}>{lockHint(name)}</Text>}
                  </View>
                </View>
                {selected && unlocked && <Check size={19} color={optionTheme.accent} strokeWidth={2.8} />}
                {!unlocked && <Lock size={17} color={optionTheme.sub} strokeWidth={2.3} />}
              </AnimatedPressable>
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
  optionText: { flexShrink: 1, minWidth: 0 },
  optionLabel: { flexShrink: 1, minWidth: 0, fontSize: 15, fontWeight: '700' },
  lockHint: { fontSize: 11, marginTop: 2 },
});
