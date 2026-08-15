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
import { islandInkFor, type IslandInk } from '@/theme/islands';
import { LEVEL_META } from '@/game/levels';
import type { Medal } from '@/game/medals';
import { useAppearance } from '@/state/appearanceStore';
import { useSemanticTokens, useThemeTokens } from '@/state/themeStore';
import type { SemanticTokens } from '@/theme/themes';
import { hitSlopFor } from '@/lib/touchTarget';
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

// Five hundred of these, painted 40pt square with 7pt between them.
const LEVEL_BUTTON_SIZE = 40;
const LEVEL_BUTTON_HIT_SLOP = hitSlopFor({ width: LEVEL_BUTTON_SIZE, height: LEVEL_BUTTON_SIZE });

/**
 * The ring on a level nobody has finished. Chrome rather than identity, so it stays here rather
 * than joining the island palette — but it still has to know which way is up, because a tenth of
 * black is invisible on a dark card and a tenth of white is invisible on a light one.
 */
const RESTING_EDGE = { light: 'rgba(0,0,0,0.10)', dark: 'rgba(255,255,255,0.14)' } as const;

interface LevelButtonProps {
  idx: number;
  active: boolean;
  done: boolean;
  medal: Medal | undefined;
  locked: boolean;
  progressionLocked: boolean;
  /**
   * The island's palette, not one colour: the button has to fill with something white can be
   * read on and outline with something that keeps the island's identity, and `color` is only
   * ever the second of those.
   */
  ink: IslandInk;
  /**
   * Passed rather than hooked. `SEMANTIC[appearance]` is a stable module object, so it costs
   * `memo` nothing — where calling the hook would subscribe five hundred buttons to the store.
   */
  semantic: SemanticTokens;
  restingEdge: string;
  milestone: boolean;
  /**
   * Built by the parent, which already holds `t`. Calling `useI18n` here instead subscribed
   * five hundred buttons to the language store to render five hundred strings that only a
   * screen reader ever hears — paid in full every time the sheet opens.
   */
  label: string;
  onPress: () => void;
}

/**
 * Three states, and each one is told by a different part of the button rather than by the same
 * part shading darker: an untouched level is a plain slot with a hairline ring, a finished one
 * keeps the slot and takes a solid ring in the island's colour, and the one you are on is
 * filled. Solved used to be a wash of `color` over the card instead, which is the one thing
 * that cannot work here — any tint dims the ground the number is read against, and even at 7%
 * it held the number to 4.20:1. The ring says the same thing and costs the number nothing.
 */
const LevelButton = memo(function LevelButton({ active, done, medal, locked, progressionLocked, ink, semantic, restingEdge, milestone, label, idx, onPress }: LevelButtonProps) {
  return (
    <AnimatedPressable
      accessibilityRole="button"
      feedback="icon"
      style={[
        styles.lvlBtn,
        { backgroundColor: ink.well, borderColor: restingEdge },
        !active && done && { borderColor: ink.color },
        active && { backgroundColor: ink.ink, borderColor: ink.ink },
        // A level that cannot be opened yet recedes into the card rather than sitting on it,
        // which leaves the lock as the only thing in the slot — and that glyph is the state.
        locked && { backgroundColor: ink.bg, borderColor: restingEdge },
      ]}
      // 40pt square in a 7pt gap: 2 each side is what reaches 44 without two neighbouring
      // targets meeting, which would make the tap between them ambiguous instead of small.
      hitSlop={LEVEL_BUTTON_HIT_SLOP}
      disabled={progressionLocked}
      onPress={onPress}
      accessibilityLabel={label}
    >
      {locked ? (
        <Lock size={13} color={ink.color} strokeWidth={2.4} />
      ) : (
        <>
          <Text style={[styles.lvlBtnText, done || active ? styles.lvlBtnTextDone : null, { color: active ? ink.onInk : ink.ink }]}>{idx + 1}</Text>
          {milestone && <Flame style={styles.milestoneIcon} size={10} color={active ? ink.onInk : semantic.streak} strokeWidth={2.6} />}
          {medal && <View style={[styles.medalDot, { backgroundColor: semantic[medal], borderColor: ink.well }]} />}
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
  const appearance = useAppearance();
  const semantic = useSemanticTokens();
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
          <View
            accessibilityRole="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={solvedCount}
            style={[styles.heroBarWrap, { backgroundColor: `${theme.accent}26` }]}
          >
            <View style={[styles.heroBarFill, { width: `${(solvedCount / total) * 100}%`, backgroundColor: theme.accent }]} />
          </View>
        </View>

        {showIslands && DIFFS.map((d, di) => {
          // A tier can outlive the island that named it, and `islandInkFor` answers for that
          // case with the neutral card rather than a colour picked here — which was `#718cc3`
          // on `#edf1f8`, below even the 3:1 a border needs.
          const islandId = ISLANDS[di]?.id ?? d.label;
          const ink = islandInkFor(islandId, appearance);
          const { startIdx, endIdx } = tierRanges[di];
          let doneCount = 0;
          for (let i = startIdx; i < endIdx; i++) if (isSolved(i)) doneCount++;
          const pct = (doneCount / d.count) * 100;

          return (
            <View key={di}>
              {di > 0 && <View style={[styles.connector, { backgroundColor: theme.gridSep }]} />}
              <CascadeCard index={di} entranceKey={entranceKey}>
              {/* Two of the island's three tokens are load-bearing here and they are not
                  interchangeable: `ink` carries everything made of words and every fill that
                  has white on it, `color` carries the things read by shape alone. The card
                  used to paint both out of `color`, which is picked to look like the place. */}
              <View style={[styles.card, { borderColor: ink.color, backgroundColor: ink.bg }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardBadge2, { backgroundColor: ink.ink }]}>
    <Text style={[styles.cardBadge2Text, { color: ink.onInk }]}>{di + 1}</Text>
                  </View>
                  <View style={styles.cardMeta}>
                    <Text style={[styles.cardName, { color: ink.ink }]}>{t(`island.${islandId}.name`)}</Text>
                    <Text style={[styles.cardGridLabel, { color: ink.ink }]}>
                      {d.size}×{d.size} · {t(`difficulty.${d.label}`)}
                    </Text>
                  </View>
                  <View style={[styles.cardBadge, { borderColor: ink.color }]}>
                    <Text style={[styles.cardBadgeText, { color: ink.ink }]}>
                      {doneCount}/{d.count}
                    </Text>
                  </View>
                </View>

                {/* No opacity here either: the story is told apart from the name by being
                    italic, smaller and looser, which survives being read. */}
                <Text style={[styles.cardStory, { color: ink.ink }]}>&quot;{t(`island.${islandId}.story`)}&quot;</Text>

                <View style={styles.cardProgress}>
                  <View
                    accessibilityRole="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={d.count}
                    aria-valuenow={doneCount}
                    style={[styles.cardBarWrap, { backgroundColor: ink.well }]}
                  >
                    <View style={[styles.cardBarFill, { width: `${pct}%`, backgroundColor: ink.color }]} />
                  </View>
                  <Text style={[styles.cardProgText, { color: ink.ink }]}>{Math.round(pct)}%</Text>
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
                        ink={ink}
                        semantic={semantic}
                        restingEdge={RESTING_EDGE[appearance]}
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
                    <MapPinned size={14} color={ink.color} strokeWidth={2.5} />
                    <Text style={[styles.completeBannerText, { color: ink.ink }]}>{t('levels.islandFound')}</Text>
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
  cardBadge2Text: { fontSize: 15, fontWeight: '800' },
  cardMeta: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 16, fontWeight: '800' },
  // No opacity, and a point larger. Compositing correct ink at 0.75 put this line back at
  // 2.9-3.5:1 on the card — the fix would have been made and undone in the same file.
  cardGridLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 1 },
  cardBadge: { flexShrink: 0, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 2 },
  cardBadgeText: { fontSize: 11, fontWeight: '700' },
  cardStory: { fontSize: 12, fontStyle: 'italic', marginBottom: 10, lineHeight: 17 },
  cardProgress: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  // The track is the island's `well`, the same ground the resting level buttons sit in — the
  // bar is set into the card rather than drawn on it, and `color` is held to 3:1 against that
  // ground as well as against the card. It used to be `rgba(0,0,0,0.08)`, a track darker than
  // the card, which spent exactly the margin the fill needed.
  cardBarWrap: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  cardBarFill: { height: '100%', borderRadius: 3 },
  cardProgText: { flexShrink: 0, fontSize: 11, fontWeight: '700' },
  lvlGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  // The grid wraps, so a level number that grows widens its own button and reflows the rest
  // rather than spilling out of a fixed 40pt circle.
  lvlBtn: {
    minWidth: LEVEL_BUTTON_SIZE,
    minHeight: LEVEL_BUTTON_SIZE,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lvlBtnText: { fontSize: 11, fontWeight: '700' },
  // The second half of the ladder's top two rungs: a finished level is heavier as well as
  // ringed, so the three states differ without any of them depending on colour alone.
  lvlBtnTextDone: { fontWeight: '800' },
  milestoneIcon: { position: 'absolute', top: 3, right: 3 },
  medalDot: { position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 4, borderWidth: 1 },
  // Opacity dropped for the same reason it came off the grid label: it composited the banner's
  // ink back down to 3.2:1 and its pin to 2.4:1, on a card that had just been fixed.
  completeBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10 },
  completeBannerText: { flexShrink: 1, minWidth: 0, fontSize: 12, fontWeight: '700' },
});
