import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface WinSheetHandle {
  present: () => void;
  dismiss: () => void;
}

interface WinSheetProps {
  title: string;
  subtitle: string;
  showHintReward: boolean;
  isDaily: boolean;
  dailyCountdown: string;
  nextLabel: string;
  onReview: () => void;
  onNext: () => void;
}

export const WinSheet = forwardRef<WinSheetHandle, WinSheetProps>(function WinSheet(
  { title, subtitle, showHintReward, isDaily, dailyCountdown, nextLabel, onReview, onNext },
  ref,
) {
  const sheetRef = useRef<BottomSheetModal>(null);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  return (
    <BottomSheetModal ref={sheetRef} enableDynamicSizing snapPoints={undefined} backgroundStyle={styles.sheetBg}>
      <BottomSheetView style={styles.content}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {showHintReward && <Text style={styles.hintReward}>+1 Hint earned!</Text>}

        {isDaily && (
          <View style={styles.dailyExtra}>
            <Text style={styles.dailyEmoji}>☀️</Text>
            <Text style={styles.dailyCountdown}>Próximo desafio em {dailyCountdown}</Text>
          </View>
        )}

        <View style={styles.actions}>
          <Pressable style={styles.secondaryBtn} onPress={onReview}>
            <Text style={styles.secondaryBtnText}>Review</Text>
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={onNext}>
            <Text style={styles.primaryBtnText}>{nextLabel}</Text>
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: '#faf4fb', borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  content: { padding: 20, paddingBottom: 32, alignItems: 'center' },
  emoji: { fontSize: 52, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#b09abf', marginTop: 4, marginBottom: 14, textAlign: 'center' },
  hintReward: { fontSize: 14, fontWeight: '600', color: '#9b7bb8', marginBottom: 14 },
  dailyExtra: { alignItems: 'center', marginBottom: 14 },
  dailyEmoji: { fontSize: 36, marginBottom: 6 },
  dailyCountdown: { fontSize: 13, color: '#b09abf', marginTop: 6 },
  actions: { flexDirection: 'row', gap: 10, width: '100%' },
  secondaryBtn: { backgroundColor: '#ead5ff', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18 },
  secondaryBtnText: { color: '#3a2d45', fontSize: 15, fontWeight: '600' },
  primaryBtn: { flex: 1, backgroundColor: '#9b7bb8', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
