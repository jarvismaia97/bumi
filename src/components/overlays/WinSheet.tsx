import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapPinned from 'lucide-react-native/icons/map-pinned';
import Share2 from 'lucide-react-native/icons/share-2';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Logo } from '@/components/Logo';
import type { Medal } from '@/game/medals';
import { formatDuration, getNextDailyInMs } from '@/game/daily';
import { useSemanticTokens, useThemeTokens } from '@/state/themeStore';
import { useI18n } from '@/i18n';
import { renderStaticSheetBackdrop } from '@/components/overlays/SheetBackdrop';

export interface WinSheetHandle {
  present: () => void;
  dismiss: () => void;
}

interface WinSheetProps {
  title: string;
  subtitle: string;
  showHintReward: boolean;
  isDaily: boolean;
  campaignMedal?: Medal;
  /** What this result added to the friends board. Zero on a replay that improved nothing. */
  campaignPoints?: number;
  campaignSummary?: string;
  unlockedIslandName?: string;
  dailySummary?: string;
  dailyStreak: number;
  nextLabel: string;
  onReview: () => void;
  onNext: () => void;
  onShareDailyResult?: () => void;
}

/**
 * The wait for tomorrow's puzzle, ticking once a minute — which is as slow as a clock showing
 * minutes can honestly be.
 *
 * It owns the interval rather than taking the string as a prop, and that is the point: the
 * countdown used to be kept alive on the root screen, which is mounted for the whole session,
 * so it re-rendered the whole menu every minute to update a line only shown after a daily is
 * finished. Here it exists exactly as long as the line does.
 */
function DailyCountdown({ color }: { color: string }) {
  const { t } = useI18n();
  const [remaining, setRemaining] = useState(() => formatDuration(getNextDailyInMs()));

  useEffect(() => {
    const id = setInterval(() => setRemaining(formatDuration(getNextDailyInMs())), 60000);
    return () => clearInterval(id);
  }, []);

  return <Text style={[styles.dailyCountdown, { color }]}>{t('win.nextDaily', { time: remaining })}</Text>;
}

export const WinSheet = forwardRef<WinSheetHandle, WinSheetProps>(function WinSheet(
  { title, subtitle, showHintReward, isDaily, campaignMedal, campaignPoints, campaignSummary, unlockedIslandName, dailySummary, dailyStreak, nextLabel, onReview, onNext, onShareDailyResult },
  ref,
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const theme = useThemeTokens();
  const semantic = useSemanticTokens();
  const { t } = useI18n();

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  return (
    <BottomSheetModal
      backdropComponent={renderStaticSheetBackdrop}
      ref={sheetRef}
      enableDynamicSizing
      snapPoints={undefined}
      backgroundStyle={[styles.sheetBg, { backgroundColor: theme.bg }]}
      handleIndicatorStyle={{ backgroundColor: theme.gridSep }}
    >
      <BottomSheetView style={styles.content}>
        <View style={styles.logo}>
          <Logo size={44} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: theme.sub }]}>{subtitle}</Text>

        {showHintReward && <Text style={[styles.hintReward, { color: theme.accent }]}>{t('win.hintReward')}</Text>}

        {campaignMedal && (
          <View style={[styles.medalResult, { backgroundColor: theme.surface, borderColor: theme.gridSep }]}>
            <View style={[styles.medalMark, { backgroundColor: semantic[campaignMedal], borderColor: theme.surface }]} />
            <View style={styles.resultCopy}>
              <Text style={[styles.medalTitle, { color: theme.text }]}>{t('win.medal', { medal: t(`medal.${campaignMedal}`) })}</Text>
              {!!campaignSummary && <Text style={[styles.medalSummary, { color: theme.sub }]}>{campaignSummary}</Text>}
            </View>
            {/* Says where the medal goes. A replay that improved nothing gains nothing, and
                claiming otherwise would promise points the board is never going to show. */}
            {!!campaignPoints && (
              <Text style={[styles.medalPoints, { color: semantic.gold }]}>{t('win.points', { count: campaignPoints })}</Text>
            )}
          </View>
        )}

        {unlockedIslandName && (
          <View style={[styles.islandUnlock, { backgroundColor: semantic.infoSurface, borderColor: semantic.infoBorder }]}>
            <MapPinned size={20} color={semantic.info} strokeWidth={2.3} />
            <View style={styles.resultCopy}>
              <Text style={[styles.islandUnlockLabel, { color: semantic.info }]}>{t('win.islandFound')}</Text>
              <Text style={[styles.islandUnlockName, { color: theme.text }]}>{unlockedIslandName}</Text>
            </View>
          </View>
        )}

        {isDaily && (
          <View style={styles.dailyExtra}>
            {!!dailySummary && <Text style={[styles.dailySummary, { color: theme.text }]}>{dailySummary}</Text>}
            <Text style={[styles.dailyStreak, { color: semantic.success }]}>{t('win.streak', { count: dailyStreak, label: t(dailyStreak === 1 ? 'menu.day' : 'menu.days') })}</Text>
            <DailyCountdown color={theme.sub} />
          </View>
        )}

        <View style={styles.actions}>
          {onShareDailyResult && (
            <AnimatedPressable accessibilityRole="button" feedback="icon" style={[styles.shareBtn, { backgroundColor: `${theme.accent}26` }]} onPress={onShareDailyResult} accessibilityLabel={t('a11y.shareResult')}>
              <Share2 size={19} color={theme.text} strokeWidth={2.3} />
            </AnimatedPressable>
          )}
          <AnimatedPressable accessibilityRole="button" feedback="control" style={[styles.secondaryBtn, { backgroundColor: `${theme.accent}26` }]} onPress={onReview}>
            <Text style={[styles.secondaryBtnText, { color: theme.text }]}>{t('win.review')}</Text>
          </AnimatedPressable>
          <AnimatedPressable accessibilityRole="button" style={[styles.primaryBtn, { backgroundColor: theme.accent }]} onPress={onNext}>
            <Text style={[styles.primaryBtnText, { color: theme.onAccent }]}>{nextLabel}</Text>
          </AnimatedPressable>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  sheetBg: { borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  content: { padding: 20, paddingBottom: 32, alignItems: 'center' },
  logo: { marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 14, marginTop: 4, marginBottom: 14, textAlign: 'center' },
  hintReward: { fontSize: 14, fontWeight: '600', marginBottom: 14 },
  medalResult: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 10, padding: 12, marginBottom: 14 },
  // The copy beside the mark/icon owns the remaining width so it wraps there instead of
  // overflowing the card.
  resultCopy: { flex: 1, minWidth: 0 },
  medalMark: { flexShrink: 0, width: 28, height: 28, borderRadius: 14, borderWidth: 3 },
  medalTitle: { fontSize: 14, fontWeight: '700' },
  medalPoints: { flexShrink: 0, fontSize: 14, fontWeight: '800' },
  medalSummary: { fontSize: 11, marginTop: 2 },
  islandUnlock: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 10, padding: 12, marginBottom: 14 },
  islandUnlockLabel: { fontSize: 11, fontWeight: '700' },
  islandUnlockName: { fontSize: 15, fontWeight: '800', marginTop: 1 },
  dailyExtra: { alignItems: 'center', marginBottom: 14 },
  dailySummary: { fontSize: 13, fontWeight: '700', marginBottom: 7 },
  dailyStreak: { fontSize: 14, fontWeight: '700' },
  dailyCountdown: { fontSize: 13, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 10, width: '100%' },
  shareBtn: { flexShrink: 0, width: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  // "Rever" is sized by its own label, so it has to yield width before the primary action does.
  secondaryBtn: { flexShrink: 1, minWidth: 0, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center' },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  primaryBtn: { flex: 1, minWidth: 0, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
