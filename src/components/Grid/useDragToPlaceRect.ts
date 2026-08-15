import { useEffect } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { ReduceMotion, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import type { PlacedRect, SolutionRect } from '@/game/types';

// Drag-to-draw + tap-to-delete. Row/col are derived from the gesture's view-local
// coordinates — no elementFromPoint equivalent needed.
//
// Two gestures raced instead of one pan: on iOS `minDistance(0)` still sets custom
// activation criteria, so RNPanHandler parks `minimumNumberOfTouches` at 20 on touch-down
// and only re-checks activation from `touchesMoved`. A tap that never moves therefore
// never activates the pan and never reaches `onEnd`. The pan wins the race as soon as the
// finger moves; the tap covers the zero-movement case.
interface Options {
  rows: number;
  columns: number;
  cellSize: number;
  placed: PlacedRect[];
  onPlace: (rect: SolutionRect) => void;
  onRemoveAt: (index: number) => void;
  /** A solved board takes no more input; see the `locked` prop on `Grid`. */
  locked?: boolean;
}

function clampToGrid(value: number, cellSize: number, count: number): number {
  'worklet';
  return Math.min(count - 1, Math.max(0, Math.floor(value / cellSize)));
}

function rectIndexAt(rects: PlacedRect[], row: number, col: number): number {
  'worklet';
  let idx = -1;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (row >= r.r1 && row < r.r2 && col >= r.c1 && col < r.c2) idx = i;
  }
  return idx;
}

export function useDragToPlaceRect({ rows, columns, cellSize, placed, onPlace, onRemoveAt, locked = false }: Options) {
  const reduceMotion = useReducedMotion();
  const placedShared = useSharedValue<PlacedRect[]>([]);
  useEffect(() => {
    placedShared.value = placed;
  }, [placed, placedShared]);

  const dragging = useSharedValue(0);
  /** Its own value rather than a tween read off `dragging`; see `onFinalize` for why. */
  const previewOpacity = useSharedValue(0);
  const startRow = useSharedValue(0);
  const startCol = useSharedValue(0);
  const curRow = useSharedValue(0);
  const curCol = useSharedValue(0);
  const hitRectIndex = useSharedValue(-1);
  /**
   * One touch, one placement. Neither `Race` nor `Exclusive` stops the tap from ending after
   * the pan on the web build: a single drag reached both handlers, so the board took the
   * rectangle the finger drew *and* a one-cell rectangle at the point it lifted. The second is
   * never a legal placement, so every drag also buzzed and counted a mistake — which is what
   * made a quick, correct drag look like it had been ignored until it was held. Whichever
   * handler commits first closes the door on the other.
   */
  const handled = useSharedValue(0);

  function commit(sr: number, sc: number, cr: number, cc: number, hitIdx: number) {
    const r1 = Math.min(sr, cr);
    const r2 = Math.max(sr, cr) + 1;
    const c1 = Math.min(sc, cc);
    const c2 = Math.max(sc, cc) + 1;
    const isTap = r2 - r1 === 1 && c2 - c1 === 1;

    if (isTap && hitIdx >= 0) {
      onRemoveAt(hitIdx);
      return;
    }
    onPlace({ r1, c1, r2, c2 });
  }

  const pan = Gesture.Pan()
    .enabled(!locked)
    .minDistance(0)
    .onBegin(e => {
      handled.value = 0;
      const row = clampToGrid(e.y, cellSize, rows);
      const col = clampToGrid(e.x, cellSize, columns);
      startRow.value = row;
      startCol.value = col;
      curRow.value = row;
      curCol.value = col;
      dragging.value = 1;
      previewOpacity.value = withTiming(1, { duration: 90, reduceMotion: ReduceMotion.Never });
      hitRectIndex.value = rectIndexAt(placedShared.value, row, col);
    })
    // Touch callbacks run whether or not the gesture has activated yet. `onUpdate` does not,
    // and a quick drag can be lifted before activation: the preview then never moved and the
    // rectangle collapsed to the single cell the finger started on — which is not a legal
    // placement, so a fast, correct drag buzzed and counted as a mistake instead of placing
    // anything. Holding still worked, which is what made it look like the board was slow.
    .onTouchesMove(e => {
      const touch = e.changedTouches[0];
      if (!touch) return;
      curRow.value = clampToGrid(touch.y, cellSize, rows);
      curCol.value = clampToGrid(touch.x, cellSize, columns);
    })
    .onUpdate(e => {
      curRow.value = clampToGrid(e.y, cellSize, rows);
      curCol.value = clampToGrid(e.x, cellSize, columns);
    })
    .onEnd((e, success) => {
      if (!success || handled.value) return;
      handled.value = 1;
      // The end event carries where the finger actually left the board, so the commit no longer
      // depends on an update having been delivered first.
      runOnJS(commit)(
        startRow.value,
        startCol.value,
        clampToGrid(e.y, cellSize, rows),
        clampToGrid(e.x, cellSize, columns),
        hitRectIndex.value,
      );
    })
    .onFinalize(() => {
      dragging.value = 0;
      // Opacity is the one property here that carries no movement, so it keeps its fade under
      // the setting: `Never` overrides Reanimated's default, which would otherwise blink the
      // preview out. Driven from the gesture rather than from inside `useAnimatedStyle`, where
      // a `withTiming` is re-evaluated on every style pass and so restarts its tween whenever
      // any other captured value changes — which for a style that also reads the current row
      // and column is on every frame of the drag.
      previewOpacity.value = withTiming(0, { duration: 130, reduceMotion: ReduceMotion.Never });
    });

  // Covers the touch that never moved, which on iOS never activates the pan and so never
  // reaches its end.
  const tap = Gesture.Tap()
    .enabled(!locked)
    .onBegin(() => {
      handled.value = 0;
    })
    .onEnd((e, success) => {
      if (!success || handled.value) return;
      handled.value = 1;
      const row = clampToGrid(e.y, cellSize, rows);
      const col = clampToGrid(e.x, cellSize, columns);
      runOnJS(commit)(row, col, row, col, rectIndexAt(placedShared.value, row, col));
    });

  // Exclusive rather than Race so the pan has priority; the shared flag above is what actually
  // guarantees a single placement, since neither combinator does on every platform.
  const gesture = Gesture.Exclusive(pan, tap);

  const previewStyle = useAnimatedStyle(() => {
    const r1 = Math.min(startRow.value, curRow.value);
    const r2 = Math.max(startRow.value, curRow.value) + 1;
    const c1 = Math.min(startCol.value, curCol.value);
    const c2 = Math.max(startCol.value, curCol.value) + 1;
    const width = (c2 - c1) * cellSize;
    const height = (r2 - r1) * cellSize;
    const opacity = previewOpacity.value;

    // This rectangle is where the player's finger is, not a flourish about it, so reduced motion
    // takes away only the entrance scale and the 90ms tween that let the edges lag the drag.
    if (reduceMotion) return { opacity, top: r1 * cellSize, left: c1 * cellSize, width, height };

    // `width`/`height` are animated rather than a fixed box scaled with `scaleX`/`scaleY`, which
    // would keep the whole thing off the layout pass. It is deliberate and it stays: the preview
    // is a 2.5pt border, and scaling a box from one cell to twelve smears that border by the
    // same factor — a 30pt edge on one side and a hairline on the other. Whether the layout cost
    // is real here has not been measured on a low-end Android, and a rewrite that is visibly
    // wrong to buy an unmeasured win is the worse trade. Profile it before touching this.
    return {
      opacity,
      top: r1 * cellSize,
      left: c1 * cellSize,
      width: withTiming(width, { duration: 90 }),
      height: withTiming(height, { duration: 90 }),
      transform: [{ scale: withTiming(dragging.value ? 1 : 0.96, { duration: 110 }) }],
    };
  });

  return { gesture, previewStyle };
}
