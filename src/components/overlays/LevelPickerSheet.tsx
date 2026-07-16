import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DIFFS } from '@/game/difficulty';
import { ISLANDS } from '@/game/islands';
import { LEVEL_META } from '@/game/levels';

export interface LevelPickerSheetHandle {
  present: () => void;
  dismiss: () => void;
}

interface LevelPickerSheetProps {
  curLvl: number;
  isSolved: (idx: number) => boolean;
  solvedCount: number;
  onSelectLevel: (idx: number) => void;
  onGoMenu: () => void;
}

interface TierRange {
  startIdx: number;
  endIdx: number; // exclusive
}

export const LevelPickerSheet = forwardRef<LevelPickerSheetHandle, LevelPickerSheetProps>(function LevelPickerSheet(
  { curLvl, isSolved, solvedCount, onSelectLevel, onGoMenu },
  ref,
) {
  const sheetRef = useRef<BottomSheetModal>(null);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const tierRanges = useMemo<TierRange[]>(() => {
    let idx = 0;
    return DIFFS.map(d => {
      const startIdx = idx;
      idx += d.count;
      return { startIdx, endIdx: idx };
    });
  }, []);

  const total = LEVEL_META.length;

  return (
    <BottomSheetModal ref={sheetRef} snapPoints={['85%']} backgroundStyle={styles.sheetBg}>
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.h2}>Caminho</Text>
          <Pressable
            style={styles.backMenuBtn}
            onPress={() => {
              sheetRef.current?.dismiss();
              onGoMenu();
            }}
          >
            <Text style={styles.backMenuText}>⌂ Menu</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>A TUA AVENTURA</Text>
          <Text style={styles.heroCount}>
            {solvedCount} <Text style={styles.heroCountSub}>/ {total} ilhas</Text>
          </Text>
          <View style={styles.heroBarWrap}>
            <View style={[styles.heroBarFill, { width: `${(solvedCount / total) * 100}%` }]} />
          </View>
        </View>

        {DIFFS.map((d, di) => {
          const island = ISLANDS[di] ?? { name: d.label, icon: '🗺️', story: '', color: '#9b7bb8', bg: '#f3eaff' };
          const { startIdx, endIdx } = tierRanges[di];
          let doneCount = 0;
          for (let i = startIdx; i < endIdx; i++) if (isSolved(i)) doneCount++;
          const pct = (doneCount / d.count) * 100;

          return (
            <View key={di}>
              {di > 0 && <View style={styles.connector} />}
              <View style={[styles.card, { borderColor: `${island.color}55`, backgroundColor: island.bg }]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIcon}>{island.icon}</Text>
                  <View style={styles.cardMeta}>
                    <Text style={[styles.cardName, { color: island.color }]}>{island.name}</Text>
                    <Text style={[styles.cardGridLabel, { color: island.color }]}>
                      {d.size}×{d.size} · {d.label}
                    </Text>
                  </View>
                  <View style={[styles.cardBadge, { borderColor: island.color }]}>
                    <Text style={[styles.cardBadgeText, { color: island.color }]}>
                      {doneCount}/{d.count}
                    </Text>
                  </View>
                </View>

                <Text style={styles.cardStory}>&quot;{island.story}&quot;</Text>

                <View style={styles.cardProgress}>
                  <View style={styles.cardBarWrap}>
                    <View style={[styles.cardBarFill, { width: `${pct}%`, backgroundColor: island.color }]} />
                  </View>
                  <Text style={[styles.cardProgText, { color: island.color }]}>{Math.round(pct)}%</Text>
                </View>

                <View style={styles.lvlGrid}>
                  {Array.from({ length: d.count }).map((_, i) => {
                    const idx = startIdx + i;
                    const active = idx === curLvl;
                    const done = isSolved(idx);
                    return (
                      <Pressable
                        key={idx}
                        style={[
                          styles.lvlBtn,
                          active && { backgroundColor: island.color, borderColor: island.color },
                          !active && done && { backgroundColor: `${island.color}30`, borderColor: island.color },
                        ]}
                        onPress={() => {
                          sheetRef.current?.dismiss();
                          onSelectLevel(idx);
                        }}
                      >
                        <Text
                          style={[
                            styles.lvlBtnText,
                            { color: active ? '#fff' : island.color },
                          ]}
                        >
                          {idx + 1}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {doneCount === d.count && (
                  <Text style={[styles.completeBanner, { color: island.color }]}>✓ Ilha conquistada</Text>
                )}
              </View>
            </View>
          );
        })}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: '#faf4fb', borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  content: { padding: 20, paddingBottom: 40 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  h2: { fontSize: 18, fontWeight: '700' },
  backMenuBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e0d4e8', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
  backMenuText: { fontSize: 13, fontWeight: '600', color: '#3a2d45' },
  hero: {
    backgroundColor: '#ead5ff',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    marginBottom: 20,
    alignItems: 'center',
  },
  heroTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: '#9b7bb8', marginBottom: 6 },
  heroCount: { fontSize: 28, fontWeight: '800', color: '#7b5aa0', marginBottom: 8 },
  heroCountSub: { fontSize: 15, fontWeight: '500', color: '#9b7bb8' },
  heroBarWrap: { height: 7, width: '100%', backgroundColor: 'rgba(155,123,184,0.2)', borderRadius: 4, overflow: 'hidden' },
  heroBarFill: { height: '100%', backgroundColor: '#7b5aa0', borderRadius: 4 },
  connector: { height: 28, width: 2, alignSelf: 'center', backgroundColor: '#d0c4e0' },
  card: { borderRadius: 20, borderWidth: 2, padding: 16, marginBottom: 0 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  cardIcon: { fontSize: 28 },
  cardMeta: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '800' },
  cardGridLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', opacity: 0.75, marginTop: 1 },
  cardBadge: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 2 },
  cardBadgeText: { fontSize: 11, fontWeight: '700' },
  cardStory: { fontSize: 12, fontStyle: 'italic', opacity: 0.72, marginBottom: 10, lineHeight: 17, color: '#3a2d45' },
  cardProgress: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardBarWrap: { flex: 1, height: 5, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' },
  cardBarFill: { height: '100%', borderRadius: 3 },
  cardProgText: { fontSize: 11, fontWeight: '700' },
  lvlGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  lvlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lvlBtnText: { fontSize: 11, fontWeight: '700' },
  completeBanner: { textAlign: 'center', marginTop: 10, fontSize: 12, fontWeight: '700', opacity: 0.8 },
});
