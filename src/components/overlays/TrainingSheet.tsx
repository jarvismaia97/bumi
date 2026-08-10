import { forwardRef, useRef, useImperativeHandle } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { SettingsChildSheet, type SettingsChildSheetHandle } from '@/components/overlays/SettingsChildSheet';
import { playHaptic } from '@/lib/haptics';
import Lock from 'lucide-react-native/icons/lock';
import { isTierLocked, TRAINING_TIERS, type TrainingTier } from '@/game/training';
import { useAuthStore } from '@/state/authStore';
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
    const signedIn = !!useAuthStore(state => state.user);

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
        {/* Hints are free here and the button no longer pretends otherwise, so the sheet says
            it once rather than leaving it to be discovered. */}
        <Text style={[styles.note, { color: theme.sub }]}>{t('training.freeHints')}</Text>
        <View style={styles.list}>
          {TRAINING_TIERS.map(tier => {
            const locked = isTierLocked(tier, signedIn);
            return (
              <AnimatedPressable
                accessibilityRole="button"
                key={tier.label}
                // Shown rather than hidden: a name the player cannot pick is a reason to sign
                // in, and a name that is simply absent is nothing at all.
                style={[styles.option, { backgroundColor: theme.surface, borderColor: theme.gridSep, opacity: locked ? 0.55 : 1 }]}
                onPress={() => !locked && select(tier)}
                disabled={locked}
                accessibilityState={{ disabled: locked }}
                accessibilityLabel={locked ? `${t(`difficulty.${tier.label}`)}. ${t('training.locked')}` : undefined}
              >
                <View style={styles.optionCopy}>
                  <Text style={[styles.optionLabel, { color: theme.text }]}>{t(`difficulty.${tier.label}`)}</Text>
                  {locked && <Text style={[styles.optionLock, { color: theme.sub }]}>{t('training.locked')}</Text>}
                </View>
                {locked
                  ? <Lock size={16} color={theme.sub} strokeWidth={2.3} />
                  : <Text style={[styles.optionDetail, { color: theme.sub }]}>{tier.size}×{tier.size}</Text>}
              </AnimatedPressable>
            );
          })}
        </View>
      </SettingsChildSheet>
    );
  },
);

const styles = StyleSheet.create({
  note: { fontSize: 12, lineHeight: 17, marginTop: 16 },
  list: { gap: 8, marginTop: 12 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 },
  optionCopy: { flex: 1, minWidth: 0 },
  optionLabel: { fontSize: 15, fontWeight: '700' },
  optionLock: { fontSize: 11, marginTop: 2 },
  optionDetail: { fontSize: 13, fontWeight: '600' },
});
