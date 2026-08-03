import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { rectOk } from '@/game/geometry';
import type { Level, PlacedRect, SolutionRect } from '@/game/types';
import { BD_PAL, BG_PAL, clueInkOn } from '@/theme/palette';
import { useThemeTokens } from '@/state/themeStore';
import { Cell, type CellEdges, type CellState } from './Cell';
import {
  type CelebrationTier,
  GLOW_REPEAT_GAP_MS,
  GLOW_REPEAT_OUT_MS,
  CELEBRATION_IN_MS,
  CELEBRATION_OUT_MS,
  CELEBRATION_STAGGER_MS,
  GLOW_DELAY_MS,
  GLOW_IN_MS,
  GLOW_OUT_MS,
  REDUCED_IN_MS,
  REDUCED_OUT_MS,
} from './celebration';
import { RectBurst } from './RectBurst';
import { useDragToPlaceRect } from './useDragToPlaceRect';

interface GridProps {
  level: Level;
  placed: PlacedRect[];
  cellSize: number;
  onPlace: (rect: SolutionRect) => void;
  onRemoveAt: (index: number) => void;
  celebrating?: boolean;
  /** What the solve was worth. Anything above 'normal' is deliberately rare. */
  celebrationTier?: CelebrationTier;
  /**
   * A solved board is over. Without this the win sheet covers only the lower half of the
   * screen, leaving the grid behind it live: the player could take the puzzle apart while
   * "Next level" was on offer, and re-solving it ran the whole win flow a second time.
   */
  locked?: boolean;
}

interface CellInfo {
  colorIndex: number;
  colors?: PlacedRect['colors'];
  correct: boolean;
  edges: CellEdges;
}

const EMPTY_EDGES: CellEdges = { top: false, bottom: false, left: false, right: false };

export function Grid({ level, placed, cellSize, onPlace, onRemoveAt, celebrating = false, celebrationTier = 'normal', locked = false }: GridProps) {
  const { size, clues } = level;
  const rows = level.rows ?? size;
  const columns = level.columns ?? size;
  const gridWidth = columns * cellSize;
  const gridHeight = rows * cellSize;
  const theme = useThemeTokens();

  const cellInfo = useMemo(() => {
    const grid: (CellInfo | null)[][] = Array.from({ length: rows }, () => Array(columns).fill(null));
    placed.forEach((rect) => {
      const correct = rectOk(rect, level);
      for (let r = rect.r1; r < rect.r2; r++) {
        for (let c = rect.c1; c < rect.c2; c++) {
          grid[r][c] = {
            colorIndex: rect.ci,
            colors: rect.colors,
            correct,
            edges: {
              top: r === rect.r1,
              bottom: r === rect.r2 - 1,
              left: c === rect.c1,
              right: c === rect.c2 - 1,
            },
          };
        }
      }
    });
    return grid;
  }, [placed, level, rows, columns]);

  const { gesture, previewStyle } = useDragToPlaceRect({ rows, columns, cellSize, placed, onPlace, onRemoveAt, locked });

  const fillPal = BG_PAL;
  const borderPal = BD_PAL;

  return (
    // The board clips its own children so the rounded corners hold; the burst has to sit
    // outside that or every particle is cut off at the edge it is trying to fly past.
    <View style={{ width: gridWidth, height: gridHeight }}>
      <GestureDetector gesture={gesture}>
      <View style={[styles.grid, { width: gridWidth, height: gridHeight, backgroundColor: theme.gridSep }]}>
        {Array.from({ length: rows }).map((_, r) => (
          <View key={r} style={styles.row}>
            {Array.from({ length: columns }).map((_, c) => {
              const info = cellInfo[r][c];
              const clue = clues.find(cl => cl.r === r && cl.c === c);
              const state: CellState = info ? (info.correct ? 'correct' : 'placed') : 'empty';

              let fillColor: string | undefined;
              let borderColor: string | undefined;
              if (info) {
                fillColor = info.colors?.fill ?? fillPal[info.colorIndex % fillPal.length];
                borderColor = info.colors?.border ?? borderPal[info.colorIndex % borderPal.length];
              }

              // What the clue is actually painted on. The theme's own surface is left out: there
              // the accent is the intended look and reads on it, so only a colour the level or a
              // placed rectangle brought needs the ink measured against it.
              const clueBackdrop = fillColor ?? level.emptyFillColor;

              return (
                <Cell
                  key={c}
                  size={cellSize}
                  clueValue={clue && clue.v > 1 ? clue.v : undefined}
                  clueColor={clueBackdrop ? clueInkOn(clueBackdrop) : theme.accent}
                  state={state}
                  edges={info?.edges ?? EMPTY_EDGES}
                  fillColor={fillColor}
                  borderColor={borderColor}
                  emptyColor={level.emptyFillColor ?? theme.surface}
                  gapColor={theme.gridSep}
                />
              );
            })}
          </View>
        ))}

        <Animated.View
          pointerEvents="none"
          style={[
            styles.preview,
            previewStyle,
            { borderColor: theme.accent + '70', backgroundColor: theme.accent + '2d' },
          ]}
        />
        {placed.map((rect, index) => (
          <CelebrationRect
            key={`${rect.r1}-${rect.c1}-${rect.r2}-${rect.c2}-${index}`}
            rect={rect}
            cellSize={cellSize}
            color={rect.colors?.border ?? borderPal[rect.ci % borderPal.length]}
            active={celebrating}
            index={index}
          />
        ))}
        <CompletionGlow active={celebrating} color={theme.accent} repeat={celebrationTier === 'milestone'} />
      </View>
      </GestureDetector>
      <RectBurst tier={celebrationTier} active={celebrating} width={gridWidth} height={gridHeight} />
    </View>
  );
}

// Solving the puzzle is what the whole app is for, so the celebration is not allowed to become
// nothing. Reanimated disables a timing outright under the system setting, which for a sequence
// that returns to 0 means the win passes unmarked — hence `Never` plus a version with no movement
// left in it: the rectangles hold a lit border and fade, all at once. The stagger goes because a
// wave crossing the grid is apparent motion even when nothing in it moves.
const REDUCED_CELEBRATION = {
  in: { duration: REDUCED_IN_MS, reduceMotion: ReduceMotion.Never },
  out: { duration: REDUCED_OUT_MS, reduceMotion: ReduceMotion.Never },
} as const;

function CelebrationRect({ rect, cellSize, color, active, index }: { rect: PlacedRect; cellSize: number; color: string; active: boolean; index: number }) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    progress.value = 0;
    if (!active) return;
    progress.value = reduceMotion
      ? withSequence(withTiming(1, REDUCED_CELEBRATION.in), withTiming(0, REDUCED_CELEBRATION.out))
      : withDelay(
          index * CELEBRATION_STAGGER_MS,
          withSequence(withTiming(1, { duration: CELEBRATION_IN_MS }), withTiming(0, { duration: CELEBRATION_OUT_MS })),
        );
  }, [active, index, progress, reduceMotion]);

  const style = useAnimatedStyle(() => (reduceMotion
    ? { opacity: interpolate(progress.value, [0, 1], [0, 0.95]) }
    : {
        opacity: interpolate(progress.value, [0, 0.3, 1], [0, 0.95, 0]),
        transform: [{ scale: interpolate(progress.value, [0, 0.35, 1], [0.92, 1.04, 1.1]) }],
      }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.celebrationRect,
        style,
        {
          top: rect.r1 * cellSize,
          left: rect.c1 * cellSize,
          width: (rect.c2 - rect.c1) * cellSize,
          height: (rect.r2 - rect.r1) * cellSize,
          borderColor: color,
        },
      ]}
    />
  );
}

// A milestone level earns a second glow rather than a new effect on screen: it reads as
// emphasis on what already happened, and costs no extra vocabulary.
function CompletionGlow({ active, color, repeat = false }: { active: boolean; color: string; repeat?: boolean }) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    progress.value = 0;
    if (!active) return;
    // The 180ms lead-in exists to let the rectangles start first; with the stagger gone that
    // would only split one glow into two beats, so the reduced grid lights as a single event.
    if (reduceMotion) {
      progress.value = withSequence(withTiming(1, REDUCED_CELEBRATION.in), withTiming(0, REDUCED_CELEBRATION.out));
      return;
    }
    const beat = [withTiming(1, { duration: GLOW_IN_MS }), withTiming(0, { duration: GLOW_OUT_MS })] as const;
    progress.value = withDelay(
      GLOW_DELAY_MS,
      repeat
        ? withSequence(
            ...beat,
            withDelay(GLOW_REPEAT_GAP_MS, withTiming(1, { duration: GLOW_IN_MS })),
            withTiming(0, { duration: GLOW_REPEAT_OUT_MS }),
          )
        : withSequence(...beat),
    );
  }, [active, progress, reduceMotion, repeat]);

  const style = useAnimatedStyle(() => (reduceMotion
    ? { opacity: interpolate(progress.value, [0, 1], [0, 0.45]) }
    : {
        opacity: interpolate(progress.value, [0, 0.35, 1], [0, 0.45, 0]),
        transform: [{ scale: interpolate(progress.value, [0, 0.4, 1], [0.98, 1.025, 1.05]) }],
      }));

  return <Animated.View pointerEvents="none" style={[styles.completionGlow, style, { borderColor: color }]} />;
}

const styles = StyleSheet.create({
  grid: { position: 'relative', borderRadius: 10, overflow: 'hidden' },
  row: { flexDirection: 'row' },
  preview: {
    position: 'absolute',
    borderWidth: 2.5,
    borderRadius: 10,
    shadowColor: '#4f6794',
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  celebrationRect: { position: 'absolute', borderWidth: 3, borderRadius: 10 },
  completionGlow: { position: 'absolute', inset: 2, borderWidth: 3, borderRadius: 10 },
});
