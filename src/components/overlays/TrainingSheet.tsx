import { forwardRef, useRef, useImperativeHandle } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { SettingsChildSheet, type SettingsChildSheetHandle } from '@/components/overlays/SettingsChildSheet';
import { playHaptic } from '@/lib/haptics';
import { TRAINING_TIERS, type TrainingTier } from '@/game/training';
import { useThemeTokens } from '@/state/themeStore';
import { useI18n } from '@/i18n';

export type TrainingSheetHandle = SettingsChildSheetHandle;

/**
 * Picking a difficulty is the whole of training, so this is the mode's front door rather than a
 * setting buried behind it. The names are the campaign's own — a player who has reached level
 * 400 already knows what `expert` feels like, and this is the first place they get to ask for
 * one on purpose.
 */
export const TrainingSheet = forwardRef<TrainingSheetHandle, { onSelect: (tier: TrainingTier) => void }>(
  function TrainingSheet({ onSelect }, ref) {
    const sheetRef = useRef<SettingsChildSheetHandle>(null);
    const theme = useThemeTokens();
    const { t } = useI18n();

    useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    function select(tier: TrainingTier) {
      playHaptic('selection');
      sheetRef.current?.dismiss();
      onSelect(tier);
    }

    return (
      <SettingsChildSheet ref={sheetRef} title={t('training.title')} subtitle={t('training.subtitle')}>
        <View style={styles.list}>
          {TRAINING_TIERS.map(tier => (
            <AnimatedPressable
              accessibilityRole="button"
              key={tier.label}
              style={[styles.option, { backgroundColor: theme.surface, borderColor: theme.gridSep }]}
              onPress={() => select(tier)}
            >
              <Text style={[styles.optionLabel, { color: theme.text }]}>{t(`difficulty.${tier.label}`)}</Text>
              <Text style={[styles.optionDetail, { color: theme.sub }]}>{tier.size}×{tier.size}</Text>
            </AnimatedPressable>
          ))}
        </View>
      </SettingsChildSheet>
    );
  },
);

const styles = StyleSheet.create({
  list: { gap: 8, marginTop: 18 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 },
  optionLabel: { fontSize: 15, fontWeight: '700' },
  optionDetail: { fontSize: 13, fontWeight: '600' },
});
