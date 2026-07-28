import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { SettingsChildSheet, type SettingsChildSheetHandle } from '@/components/overlays/SettingsChildSheet';
import { getArchiveMonth, leadingBlanks } from '@/game/archive';
import { useProgressStore } from '@/state/progressStore';
import { useSemanticTokens, useThemeTokens } from '@/state/themeStore';
import { useI18n } from '@/i18n';

export type DailyArchiveSheetHandle = SettingsChildSheetHandle;

interface DailyArchiveSheetProps {
  onSelectDay: (dateKey: string) => void;
}

// The game could always open any day's puzzle — that is how a shared daily link works — but
// there was no way in from the app, so a missed day was gone. The month shown is the one the
// monthly goal counts, which is also as far back as chasing a missed day is worth it.
export const DailyArchiveSheet = forwardRef<DailyArchiveSheetHandle, DailyArchiveSheetProps>(
  function DailyArchiveSheet({ onSelectDay }, ref) {
    const sheetRef = useRef<SettingsChildSheetHandle>(null);
    const theme = useThemeTokens();
    const semantic = useSemanticTokens();
    const { t } = useI18n();
    const completed = useProgressStore(state => state.dailyCompletionDates);
    const days = getArchiveMonth(completed);
    const blanks = leadingBlanks();

    useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    function select(dateKey: string) {
      sheetRef.current?.dismiss();
      onSelectDay(dateKey);
    }

    return (
      <SettingsChildSheet ref={sheetRef} title={t('archive.title')}>
        <View style={styles.grid}>
          {Array.from({ length: blanks }).map((_, index) => (
            <View key={`blank-${index}`} style={styles.day} />
          ))}
          {days.map(day => {
            const done = day.state === 'done';
            const future = day.state === 'future';
            return (
              <AnimatedPressable
                accessibilityRole="button"
                feedback="icon"
                key={day.dateKey}
                disabled={future}
                onPress={() => select(day.dateKey)}
                accessibilityLabel={t(done ? 'a11y.archiveDayDone' : 'a11y.archiveDay', { day: day.day })}
                accessibilityState={{ disabled: future }}
                style={[
                  styles.day,
                  {
                    backgroundColor: done ? semantic.successSurface : theme.surface,
                    borderColor: done ? semantic.successBorder : theme.gridSep,
                    // A puzzle that does not exist yet is shown rather than hidden, so the
                    // month keeps its shape and the player can see what is coming.
                    opacity: future ? 0.35 : 1,
                  },
                ]}
              >
                <Text style={[styles.dayNumber, { color: done ? semantic.success : theme.text }]}>{day.day}</Text>
                {done && <Check size={12} color={semantic.success} strokeWidth={3} />}
              </AnimatedPressable>
            );
          })}
        </View>
      </SettingsChildSheet>
    );
  },
);

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 18 },
  day: { width: '13%', minHeight: 44, borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  dayNumber: { fontSize: 13, fontWeight: '700' },
});
