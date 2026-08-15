import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { rectOk } from '@/game/geometry';
import type { Level, PlacedRect, SolutionRect } from '@/game/types';
import { useI18n } from '@/i18n';
import { BD_PAL, BG_PAL, clueInkOn } from '@/theme/palette';
import { useThemeTokens } from '@/state/themeStore';
import { Cell, type CellState } from './Cell';
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

/**
 * Which rectangle covers a square, which is all the squares still need to know — already
 * resolved down to the two values a `Cell` takes, so nothing per-square is left to compute.
 */
interface CellInfo {
  correct: boolean;
  /**
   * The ink for a clue landing on this rectangle. It lives here because `clueInkOn` is a regex,
   * three `parseInt`s and two luminance computations, and it used to run once per *covered
   * square* — the same answer recomputed for every square of the same rectangle.
   */
  clueColor: string;
}

/** A placed rectangle with its colours resolved, so the render pass only positions it. */
interface PieceInfo {
  rect: PlacedRect;
  correct: boolean;
  fill: string;
  border: string;
}

/**
 * The label the board answers a screen reader with. `a11y.board` is not in the catalogue yet
 * and `src/i18n` is not this change's to edit; `translate` answers an unknown key with the key
 * itself, which would be read out loud as "a11y dot board", so an absent string falls back to
 * the board's own dimensions. It is not prose, but it is true in every language and it tells
 * the user this is a picture rather than something they can operate.
 *
 * Strings wanted: pt "Tabuleiro de {rows} por {columns}", en "{rows} by {columns} board",
 * es "Tablero de {rows} por {columns}".
 */
const BOARD_LABEL_KEY = 'a11y.board';

export function Grid({ level, placed, cellSize, onPlace, onRemoveAt, celebrating = false, celebrationTier = 'normal', locked = false }: GridProps) {
  const { size, clues } = level;
  const rows = level.rows ?? size;
  const columns = level.columns ?? size;
  const gridWidth = columns * cellSize;
  const gridHeight = rows * cellSize;
  const theme = useThemeTokens();
  const { t } = useI18n();

  /**
   * A rectangle that does not yet satisfy its clue is held rather than solved, so it reads as a
   * wash instead of as its own colour. The wash was the literal `rgba(113,140,195,0.12)` —
   * classic's light accent — so it stayed blue under the red or the amber theme, and at 12% it
   * measured 1.10-1.18:1 against the board it sits on, which is to say the fill said nothing and
   * only the border carried the state. Derived from the live accent at 22% it measures
   * 1.25-1.57:1 against the board and 1.62-2.04:1 against the empty squares beside it. It stops
   * there rather than going further because a solved fill only reaches 2.56:1 in the light
   * themes: any stronger and the held state would read as the solved one.
   */
  const heldWash = theme.accent + '38';

  const board = useMemo(() => {
    /**
     * Clues arrive as a flat list, so finding the one on a square was a linear scan *inside* the
     * square loop: 144 squares against ~52 clues is about 7,500 comparisons, redone on every
     * drag-end, every theme change and every parent render. Keyed by `r * columns + c` it is one
     * hash lookup. Clues of 1 are dropped here rather than at the call site — a one-square
     * rectangle needs no number on it.
     */
    const clueAt = new Map<number, number>();
    for (const clue of clues) {
      if (clue.v > 1) clueAt.set(clue.r * columns + clue.c, clue.v);
    }

    const cells: (CellInfo | null)[][] = Array.from({ length: rows }, () => Array(columns).fill(null));
    const pieces: PieceInfo[] = placed.map((rect) => {
      // `rectOk` used to run twice for every rectangle — once here and once again in the render
      // pass that draws the piece — and `clueInkOn` once per covered square. Both are facts
      // about the whole rectangle, so both are settled once, here.
      const correct = rectOk(rect, level);
      const fill = rect.colors?.fill ?? BG_PAL[rect.ci % BG_PAL.length];
      const border = rect.colors?.border ?? BD_PAL[rect.ci % BD_PAL.length];
      // What the clue is actually painted on, which is the fill only once the rectangle is
      // solved. A held one is painted in `heldWash`, which is the board tinted — so the clue on
      // it belongs to the board and takes the board's own ink. Measuring against the fill
      // regardless is what put near-black clues on the dark themes' held rectangles at
      // 1.83-2.29:1; `theme.text` reads 5.17-9.22:1 on the wash across all twenty-two pairs.
      const info: CellInfo = { correct, clueColor: correct ? clueInkOn(fill) : theme.text };
      for (let r = rect.r1; r < rect.r2; r++) {
        for (let c = rect.c1; c < rect.c2; c++) {
          cells[r][c] = info;
        }
      }
      return { rect, correct, fill, border };
    });

    // An uncovered square shows the theme's own surface, where the accent is the intended look
    // and reads on it, unless the level brought a colour of its own — the tutorial paints the
    // logo out of them — in which case the ink is measured against that.
    const emptyClueColor = level.emptyFillColor ? clueInkOn(level.emptyFillColor) : theme.accent;

    return { clueAt, cells, pieces, emptyClueColor };
  }, [placed, level, clues, rows, columns, theme]);

  const { gesture, previewStyle } = useDragToPlaceRect({ rows, columns, cellSize, placed, onPlace, onRemoveAt, locked });

  const emptyColor = level.emptyFillColor ?? theme.surface;
  const described = t(BOARD_LABEL_KEY, { rows, columns });
  const boardLabel = described === BOARD_LABEL_KEY ? `${rows} × ${columns}` : described;

  return (
    // The board clips its own children so the rounded corners hold; the burst has to sit
    // outside that or every particle is cut off at the edge it is trying to fly past.
    //
    // One accessible node rather than 144: the board is drawn from squares and clue numbers,
    // and a screen reader walking them one at a time reads out a column of unlabelled digits
    // with nothing saying what they belong to. Rolled up under `image` because that is the
    // honest answer — the board is drawn with a drag, which assistive touch takes over, so a
    // screen-reader user needs to know it is a picture and not something they failed to operate.
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={boardLabel}
      style={{ width: gridWidth, height: gridHeight }}
    >
      <GestureDetector gesture={gesture}>
      <View style={[styles.grid, { width: gridWidth, height: gridHeight, backgroundColor: theme.gridSep }]}>
        {/* One view per rectangle, before the squares so it paints underneath them: a covered
            square is transparent and lets its piece show through, while its clue still draws on
            top. See `Cell` for why a rectangle cannot be composed out of the squares. */}
        {board.pieces.map(({ rect, correct, fill, border }, index) => (
          <View
            key={`${rect.r1}-${rect.c1}-${index}`}
            // Named so the overlay tests can tell a piece, which never moves, from the
            // preview and the celebration, which are the animated layers they are about.
            testID="grid-piece"
            pointerEvents="none"
            style={[
              styles.piece,
              {
                left: rect.c1 * cellSize,
                top: rect.r1 * cellSize,
                width: (rect.c2 - rect.c1) * cellSize,
                height: (rect.r2 - rect.r1) * cellSize,
                backgroundColor: correct ? fill : heldWash,
                borderColor: border,
              },
            ]}
          />
        ))}
        {Array.from({ length: rows }).map((_, r) => (
          <View key={r} style={styles.row}>
            {Array.from({ length: columns }).map((_, c) => {
              const info = board.cells[r][c];
              const state: CellState = info ? (info.correct ? 'correct' : 'placed') : 'empty';

              return (
                <Cell
                  key={c}
                  size={cellSize}
                  clueValue={board.clueAt.get(r * columns + c)}
                  clueColor={info ? info.clueColor : board.emptyClueColor}
                  state={state}
                  emptyColor={emptyColor}
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
            {
              // The border is the drag's whole affordance, and at 44% alpha it measured
              // 1.58-2.73:1 against the board in all twenty-two theme/appearance pairs — under
              // the 3:1 a non-text control is held to, everywhere. Solid, the same accent reads
              // 3.22-6.63:1 against the board's own lines and 4.52-8.82:1 against an empty
              // square. The fill stays at 18% so the preview still reads as a rectangle being
              // drawn rather than one already placed.
              borderColor: theme.accent,
              backgroundColor: theme.accent + '2d',
              // The shadow used to be a hardcoded slate belonging to no theme, declared through
              // the legacy `shadow*` props — which react-native-web deprecates outright and
              // Android only honours in part (`shadowOffset`, `shadowOpacity` and `shadowRadius`
              // are iOS-only). One `boxShadow` string is the documented form and is the same
              // shadow on all three platforms. `24` is the 0.14 opacity it replaced.
              boxShadow: `0px 3px 6px ${theme.accent}24`,
            },
          ]}
        />
        {board.pieces.map(({ rect, border }, index) => (
          <CelebrationRect
            key={`${rect.r1}-${rect.c1}-${rect.r2}-${rect.c2}-${index}`}
            rect={rect}
            cellSize={cellSize}
            color={border}
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
  // The shadow is not here because it is drawn in the theme's own accent; see the preview.
  preview: { position: 'absolute', borderWidth: 2.5, borderRadius: 10 },
  piece: { position: 'absolute', borderWidth: 3, borderRadius: 10 },
  celebrationRect: { position: 'absolute', borderWidth: 3, borderRadius: 10 },
  completionGlow: { position: 'absolute', inset: 2, borderWidth: 3, borderRadius: 10 },
});
