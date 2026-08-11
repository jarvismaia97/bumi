import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { InteractionManager, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, interpolate, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import MapPinned from 'lucide-react-native/icons/map-pinned';
import Flame from 'lucide-react-native/icons/flame';
import Lock from 'lucide-react-native/icons/lock';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { DIFFS } from '@/game/difficulty';
import { useI18n } from '@/i18n';
import { ISLANDS } from '@/game/islands';
import { LEVEL_META } from '@/game/levels';
import type { Medal } from '@/game/medals';
import { useThemeTokens } from '@/state/themeStore';
import { SEMANTIC } from '@/theme/themes';
import { renderSheetBackdrop } from '@/components/overlays/SheetBackdrop';

export interface LevelPickerSheetHandle {
  present: () => void;
  dismiss: () => void;
}

interface LevelPickerSheetProps {
  curLvl: number;
  isSolved: (idx: number) => boolean;
  getLevelMedal: (idx: number) => Medal | undefined;
  solvedCount: number;
  isLevelLocked?: (idx: number) => boolean;
  isLevelLoginRequired?: (idx: number) => boolean;
  onSelectLevel: (idx: number) => void;
}

interface TierRange {
  startIdx: number;
  endIdx: number; // exclusive
}

function CascadeCard({ index, entranceKey, children }: { index: number; entranceKey: number; children: React.ReactNode }) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    progress.value = 0;
    // Thirteen cards lifting into place one after another is the shape reduced motion exists to
    // stop, and the stagger is the worse half: a wave travelling down the list is read as motion
    // even once each card stops moving. What survives is one cross-fade, all cards together, so
    // the list still announces itself instead of being there before the sheet finishes opening.
    progress.value = reduceMotion
      ? withTiming(1, { duration: 160, reduceMotion: ReduceMotion.Never })
      : withDelay(
          Math.min(index * 65, 520),
          withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }),
        );
  }, [entranceKey, index, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => (reduceMotion
    ? { opacity: progress.value }
    : {
        opacity: progress.value,
        transform: [
          { translateY: interpolate(progress.value, [0, 1], [14, 0]) },
          { scale: interpolate(progress.value, [0, 1], [0.98, 1]) },
        ],
      }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

interface LevelButtonProps {
  idx: number;
  active: boolean;
  done: boolean;
  medal: Medal | undefined;
  locked: boolean;
  progressionLocked: boolean;
  islandColor: string;
  milestone: boolean;
  /**
   * Built by the parent, which already holds `t`. Calling `useI18n` here instead subscribed
   * five hundred buttons to the language store to render five hundred strings that only a
   * screen reader ever hears — paid in full every time the sheet opens.
   */
  label: string;
  onPress: () => void;
}

const LevelButton = memo(function LevelButton({ active, done, medal, locked, progressionLocked, islandColor, milestone, label, idx, onPress }: LevelButtonProps) {
  // Island cards are painted from the island art, which stays light in both appearances,
  // so everything sitting on one reads against the light palette.
  const semantic = SEMANTIC.light;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      feedback="icon"
      style={[
        styles.lvlBtn,
        active && { backgroundColor: islandColor, borderColor: islandColor },
        !active && done && { backgroundColor: `${islandColor}30`, borderColor: islandColor },
        locked && styles.lvlBtnLocked,
      ]}
      disabled={progressionLocked}
      onPress={onPress}
      accessibilityLabel={label}
    >
      {locked ? (
        <Lock size={13} color="#827d78" strokeWidth={2.4} />
      ) : (
        <>
          <Text style={[styles.lvlBtnText, { color: active ? '#fff' : islandColor }]}>{idx + 1}</Text>
          {milestone && <Flame style={styles.milestoneIcon} size={10} color={active ? '#fff' : semantic.streak} strokeWidth={2.6} />}
          {medal && <View style={[styles.medalDot, { backgroundColor: semantic[medal] }]} />}
        </>
      )}
    </AnimatedPressable>
  );
});

export const LevelPickerSheet = forwardRef<LevelPickerSheetHandle, LevelPickerSheetProps>(function LevelPickerSheet(
  { curLvl, isSolved, getLevelMedal, solvedCount, isLevelLocked = () => false, isLevelLoginRequired = () => false, onSelectLevel },
  ref,
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [entranceKey, setEntranceKey] = useState(0);
  /**
   * Five hundred buttons cannot mount inside the frame budget of an opening sheet, and trying
   * made the sheet itself late — the cost was paid before anything appeared. The header and the
   * progress bar come up immediately and the islands follow once the animation is done, which
   * is also the order they are read in.
   */
  const [showIslands, setShowIslands] = useState(false);
  const theme = useThemeTokens();
  const { t } = useI18n();

  useImperativeHandle(ref, () => ({
    present: () => {
      setEntranceKey(key => key + 1);
      setShowIslands(false);
      requestAnimationFrame(() => sheetRef.current?.present());
      InteractionManager.runAfterInteractions(() => setShowIslands(true));
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const levelLabelFor = useCallback(
    (idx: number, progressionLocked: boolean, locked: boolean, milestone: boolean) =>
      t(
        progressionLocked
          ? 'a11y.levelLocked'
          : locked
            ? 'a11y.levelLoginRequired'
            : milestone
              ? 'a11y.levelMilestone'
              : 'a11y.levelButton',
        { level: idx + 1 },
      ),
    [t],
  );

  const tierRanges = useMemo<TierRange[]>(
    () => DIFFS.reduce<TierRange[]>((ranges, diff) => {
      const startIdx = ranges.at(-1)?.endIdx ?? 0;
      return [...ranges, { startIdx, endIdx: startIdx + diff.count }];
    }, []),
    [],
  );

  const total = LEVEL_META.length;

  return (
    <BottomSheetModal
      backdropComponent={renderSheetBackdrop}
      ref={sheetRef}
      snapPoints={['94%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      backgroundStyle={[styles.sheetBg, { backgroundColor: theme.bg }]}
      handleIndicatorStyle={[styles.handle, { backgroundColor: theme.gridSep }]}
    >
      <BottomSheetScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator
      >
        <View style={[styles.topRow, { backgroundColor: theme.bg }]}>
          <Text style={[styles.h2, { color: theme.text }]}>{t('levels.title')}</Text>
        </View>

        <View style={[styles.hero, { backgroundColor: `${theme.accent}26` }]}>
          <Text style={[styles.heroTitle, { color: theme.accent }]}>{t('levels.adventure')}</Text>
          <Text style={[styles.heroCount, { color: theme.text }]}>
            {solvedCount} <Text style={[styles.heroCountSub, { color: theme.sub }]}>{t('levels.progressCount', { total })}</Text>
          </Text>
          <View style={[styles.heroBarWrap, { backgroundColor: `${theme.accent}26` }]}>
            <View style={[styles.heroBarFill, { width: `${(solvedCount / total) * 100}%`, backgroundColor: theme.accent }]} />
          </View>
        </View>

        {showIslands && DIFFS.map((d, di) => {
          const island = ISLANDS[di] ?? { id: d.label, color: '#718cc3', bg: '#edf1f8' };
          const { startIdx, endIdx } = tierRanges[di];
          let doneCount = 0;
          for (let i = startIdx; i < endIdx; i++) if (isSolved(i)) doneCount++;
          const pct = (doneCount / d.count) * 100;

          return (
            <View key={di}>
              {di > 0 && <View style={[styles.connector, { backgroundColor: theme.gridSep }]} />}
              <CascadeCard index={di} entranceKey={entranceKey}>
              <View style={[styles.card, { borderColor: `${island.color}55`, backgroundColor: island.bg }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardBadge2, { backgroundColor: island.color }]}>
                    <Text style={styles.cardBadge2Text}>{di + 1}</Text>
                  </View>
                  <View style={styles.cardMeta}>
                    <Text style={[styles.cardName, { color: island.color }]}>{t(`island.${island.id}.name`)}</Text>
                    <Text style={[styles.cardGridLabel, { color: island.color }]}>
                      {d.size}×{d.size} · {t(`difficulty.${d.label}`)}
                    </Text>
                  </View>
                  <View style={[styles.cardBadge, { borderColor: island.color }]}>
                    <Text style={[styles.cardBadgeText, { color: island.color }]}>
                      {doneCount}/{d.count}
                    </Text>
                  </View>
                </View>

                <Text style={styles.cardStory}>&quot;{t(`island.${island.id}.story`)}&quot;</Text>

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
                    const medal = getLevelMedal(idx);
                    const progressionLocked = isLevelLocked(idx);
                    const loginRequired = !progressionLocked && isLevelLoginRequired(idx);
                    const locked = progressionLocked || loginRequired;
                    return (
                      <LevelButton
                        key={idx}
                        idx={idx}
                        active={active}
                        done={done}
                        medal={medal}
                        locked={locked}
                        progressionLocked={progressionLocked}
                        islandColor={island.color}
                        milestone={LEVEL_META[idx].milestone}
                        label={levelLabelFor(idx, progressionLocked, locked, LEVEL_META[idx].milestone)}
                        onPress={() => {
                          sheetRef.current?.dismiss();
                          onSelectLevel(idx);
                        }}
                      />
                    );
                  })}
                </View>

                {doneCount === d.count && (
                  <View style={styles.completeBanner}>
                    <MapPinned size={14} color={island.color} strokeWidth={2.5} />
                    <Text style={[styles.completeBannerText, { color: island.color }]}>{t('levels.islandFound')}</Text>
                  </View>
                )}
              </View>
              </CascadeCard>
            </View>
          );
        })}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  sheetBg: { borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  handle: { width: 38 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 112 },
  // Sticky sheet header: the drag handle and pan-down-to-close already dismiss it.
  topRow: { marginBottom: 12, paddingBottom: 8, zIndex: 1 },
  h2: { fontSize: 18, fontWeight: '700' },
  hero: {
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    marginBottom: 14,
    alignItems: 'center',
  },
  heroTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  heroCount: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  heroCountSub: { fontSize: 15, fontWeight: '500' },
  heroBarWrap: { height: 7, width: '100%', borderRadius: 4, overflow: 'hidden' },
  heroBarFill: { height: '100%', borderRadius: 4 },
  connector: { height: 18, width: 2, alignSelf: 'center' },
  card: { borderRadius: 16, borderWidth: 1.5, padding: 14, marginBottom: 0 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  cardBadge2: { minWidth: 36, minHeight: 36, borderRadius: 18, paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  cardBadge2Text: { fontSize: 15, fontWeight: '800', color: '#fff' },
  cardMeta: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 16, fontWeight: '800' },
  cardGridLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', opacity: 0.75, marginTop: 1 },
  cardBadge: { flexShrink: 0, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 2 },
  cardBadgeText: { fontSize: 11, fontWeight: '700' },
  cardStory: { fontSize: 12, fontStyle: 'italic', opacity: 0.72, marginBottom: 10, lineHeight: 17, color: '#3a2d45' },
  cardProgress: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardBarWrap: { flex: 1, height: 5, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' },
  cardBarFill: { height: '100%', borderRadius: 3 },
  cardProgText: { flexShrink: 0, fontSize: 11, fontWeight: '700' },
  lvlGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  // The grid wraps, so a level number that grows widens its own button and reflows the rest
  // rather than spilling out of a fixed 40pt circle.
  lvlBtn: {
    minWidth: 40,
    minHeight: 40,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lvlBtnText: { fontSize: 11, fontWeight: '700' },
  lvlBtnLocked: { backgroundColor: 'rgba(255,255,255,0.35)', borderColor: 'rgba(0,0,0,0.08)' },
  milestoneIcon: { position: 'absolute', top: 3, right: 3 },
  medalDot: { position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: '#fff' },
  completeBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10, opacity: 0.8 },
  completeBannerText: { flexShrink: 1, minWidth: 0, fontSize: 12, fontWeight: '700' },
});
