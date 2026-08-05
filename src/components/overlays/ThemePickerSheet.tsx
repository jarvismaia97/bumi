import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import Lock from 'lucide-react-native/icons/lock';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { SettingsChildSheet, type SettingsChildSheetHandle } from '@/components/overlays/SettingsChildSheet';
import { useAppearance } from '@/state/appearanceStore';
import { useThemeStore } from '@/state/themeStore';
import { THEME_OPTIONS, THEMES } from '@/theme/themes';
import { getUnlockStats, isThemeUnlocked, remainingFor, THEME_REQUIREMENTS } from '@/game/unlocks';
import { useProgressStore } from '@/state/progressStore';
import { playHaptic } from '@/lib/haptics';
import { useI18n } from '@/i18n';

export type ThemePickerSheetHandle = SettingsChildSheetHandle;

export const ThemePickerSheet = forwardRef<ThemePickerSheetHandle>(function ThemePickerSheet(_, ref) {
  const sheetRef = useRef<SettingsChildSheetHandle>(null);
  const appearance = useAppearance();
  const { t } = useI18n();
  const solvedMap = useProgressStore(state => state.solvedMap);
  const solvedDateMap = useProgressStore(state => state.solvedDateMap);
  const levelMedals = useProgressStore(state => state.levelMedals);
  const dailyStreak = useProgressStore(state => state.dailyStreak);
  const dailyCompletionDates = useProgressStore(state => state.dailyCompletionDates);
  const unlockStats = getUnlockStats({ solvedMap, solvedDateMap, levelMedals, dailyStreak: dailyStreak() }, dailyCompletionDates);

  /** Says what the lock is waiting on, so it reads as a goal rather than a wall. */
  function lockHint(name: (typeof THEME_OPTIONS)[number]): string {
    const missing = remainingFor(THEME_REQUIREMENTS[name], unlockStats);
    if (missing.islands) return t('theme.needIslands', { count: missing.islands, label: t(missing.islands === 1 ? 'theme.island' : 'theme.islands') });
    if (missing.achievements) return t('theme.needAchievements', { count: missing.achievements, label: t(missing.achievements === 1 ? 'theme.achievement' : 'theme.achievements') });
    if (missing.goldMedals) return t('theme.needGold', { count: missing.goldMedals });
    if (missing.dailyInMonth) return t('theme.needSeason', { month: t(`month.${missing.dailyInMonth}`) });
    return t('theme.locked');
  }
  const themeName = useThemeStore(state => state.themeName);
  const setThemeName = useThemeStore(state => state.setThemeName);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  function selectTheme(name: typeof themeName) {
    // Picking one of a row of peers, the same gesture a segmented control answers.
    playHaptic('selection');
    setThemeName(name);
    sheetRef.current?.dismiss();
  }

  return (
    <SettingsChildSheet ref={sheetRef} title={t('theme.title')} snapPoints={['70%']}>
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
    </SettingsChildSheet>
  );
});

const styles = StyleSheet.create({
  // Painted at 36 beside a 20pt title; hitSlop, not size, takes the tap area to 44.
  // Centred between two 36pt buttons; flex lets a long translated title wrap instead of
  // shoving the back button off the sheet.
  list: { gap: 8, marginTop: 18 },
  option: { minHeight: 48, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  optionCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatches: { flexShrink: 0, flexDirection: 'row', gap: 3 },
  swatch: { width: 15, height: 15, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  optionText: { flexShrink: 1, minWidth: 0 },
  optionLabel: { flexShrink: 1, minWidth: 0, fontSize: 15, fontWeight: '700' },
  lockHint: { fontSize: 11, marginTop: 2 },
});
