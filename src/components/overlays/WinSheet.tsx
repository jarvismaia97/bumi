import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapPinned from 'lucide-react-native/icons/map-pinned';
import Share2 from 'lucide-react-native/icons/share-2';
import { Logo } from '@/components/Logo';
import type { Medal } from '@/game/medals';
import { useI18n } from '@/i18n';

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
  campaignSummary?: string;
  unlockedIslandName?: string;
  dailySummary?: string;
  dailyStreak: number;
  dailyCountdown: string;
  nextLabel: string;
  onReview: () => void;
  onNext: () => void;
  onShareDailyResult?: () => void;
}

export const WinSheet = forwardRef<WinSheetHandle, WinSheetProps>(function WinSheet(
  { title, subtitle, showHintReward, isDaily, campaignMedal, campaignSummary, unlockedIslandName, dailySummary, dailyStreak, dailyCountdown, nextLabel, onReview, onNext, onShareDailyResult },
  ref,
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const { t } = useI18n();

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  return (
    <BottomSheetModal ref={sheetRef} enableDynamicSizing snapPoints={undefined} backgroundStyle={styles.sheetBg}>
      <BottomSheetView style={styles.content}>
        <View style={styles.logo}>
          <Logo size={44} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {showHintReward && <Text style={styles.hintReward}>{t('win.hintReward')}</Text>}

        {campaignMedal && (
          <View style={styles.medalResult}>
            <View style={[styles.medalMark, { backgroundColor: MEDAL_COLORS[campaignMedal] }]} />
            <View>
              <Text style={styles.medalTitle}>{t('win.medal', { medal: t(`medal.${campaignMedal}`) })}</Text>
              {!!campaignSummary && <Text style={styles.medalSummary}>{campaignSummary}</Text>}
            </View>
          </View>
        )}

        {unlockedIslandName && (
          <View style={styles.islandUnlock}>
            <MapPinned size={20} color="#5e82be" strokeWidth={2.3} />
            <View>
              <Text style={styles.islandUnlockLabel}>{t('win.islandFound')}</Text>
              <Text style={styles.islandUnlockName}>{unlockedIslandName}</Text>
            </View>
          </View>
        )}

        {isDaily && (
          <View style={styles.dailyExtra}>
            {!!dailySummary && <Text style={styles.dailySummary}>{dailySummary}</Text>}
            <Text style={styles.dailyStreak}>{t('win.streak', { count: dailyStreak, label: t(dailyStreak === 1 ? 'menu.day' : 'menu.days') })}</Text>
            <Text style={styles.dailyCountdown}>{t('win.nextDaily', { time: dailyCountdown })}</Text>
          </View>
        )}

        <View style={styles.actions}>
          {onShareDailyResult && (
            <Pressable accessibilityRole="button" style={styles.shareBtn} onPress={onShareDailyResult} accessibilityLabel={t('a11y.shareResult')}>
              <Share2 size={19} color="#3a2d45" strokeWidth={2.3} />
            </Pressable>
          )}
          <Pressable accessibilityRole="button" style={styles.secondaryBtn} onPress={onReview}>
            <Text style={styles.secondaryBtnText}>{t('win.review')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.primaryBtn} onPress={onNext}>
            <Text style={styles.primaryBtnText}>{nextLabel}</Text>
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const MEDAL_COLORS: Record<Medal, string> = {
  gold: '#d6a72f',
  silver: '#8694a3',
  bronze: '#b9784b',
};

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: '#f7f3f0', borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  content: { padding: 20, paddingBottom: 32, alignItems: 'center' },
  logo: { marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#b09abf', marginTop: 4, marginBottom: 14, textAlign: 'center' },
  hintReward: { fontSize: 14, fontWeight: '600', color: '#5e82be', marginBottom: 14 },
  medalResult: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fffefd', borderColor: '#e8e1dc', borderWidth: 1.5, borderRadius: 10, padding: 12, marginBottom: 14 },
  medalMark: { width: 28, height: 28, borderRadius: 14, borderWidth: 3, borderColor: '#fff' },
  medalTitle: { fontSize: 14, fontWeight: '700', color: '#292827' },
  medalSummary: { fontSize: 11, color: '#827d78', marginTop: 2 },
  islandUnlock: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#e5f2ff', borderColor: '#b9d8ef', borderWidth: 1.5, borderRadius: 10, padding: 12, marginBottom: 14 },
  islandUnlockLabel: { fontSize: 11, fontWeight: '700', color: '#5e82be' },
  islandUnlockName: { fontSize: 15, fontWeight: '800', color: '#293c5e', marginTop: 1 },
  dailyExtra: { alignItems: 'center', marginBottom: 14 },
  dailySummary: { fontSize: 13, fontWeight: '700', color: '#292827', marginBottom: 7 },
  dailyStreak: { fontSize: 14, fontWeight: '700', color: '#2e8a50' },
  dailyCountdown: { fontSize: 13, color: '#b09abf', marginTop: 6 },
  actions: { flexDirection: 'row', gap: 10, width: '100%' },
  shareBtn: { width: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ead5ff', borderRadius: 12 },
  secondaryBtn: { backgroundColor: '#ead5ff', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18 },
  secondaryBtnText: { color: '#3a2d45', fontSize: 15, fontWeight: '600' },
  primaryBtn: { flex: 1, backgroundColor: '#718cc3', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
