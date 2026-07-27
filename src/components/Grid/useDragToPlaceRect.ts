import { useEffect } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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

export function useDragToPlaceRect({ rows, columns, cellSize, placed, onPlace, onRemoveAt }: Options) {
  const placedShared = useSharedValue<PlacedRect[]>([]);
  useEffect(() => {
    placedShared.value = placed;
  }, [placed, placedShared]);

  const dragging = useSharedValue(0);
  const startRow = useSharedValue(0);
  const startCol = useSharedValue(0);
  const curRow = useSharedValue(0);
  const curCol = useSharedValue(0);
  const hitRectIndex = useSharedValue(-1);

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
    .minDistance(0)
    .onBegin(e => {
      const row = clampToGrid(e.y, cellSize, rows);
      const col = clampToGrid(e.x, cellSize, columns);
      startRow.value = row;
      startCol.value = col;
      curRow.value = row;
      curCol.value = col;
      dragging.value = 1;
      hitRectIndex.value = rectIndexAt(placedShared.value, row, col);
    })
    .onUpdate(e => {
      curRow.value = clampToGrid(e.y, cellSize, rows);
      curCol.value = clampToGrid(e.x, cellSize, columns);
    })
    .onEnd((_e, success) => {
      if (success) {
        runOnJS(commit)(startRow.value, startCol.value, curRow.value, curCol.value, hitRectIndex.value);
      }
    })
    .onFinalize(() => {
      dragging.value = 0;
    });

  // Only reached when the pan never activated, i.e. a tap with no finger movement.
  const tap = Gesture.Tap().onEnd((e, success) => {
    if (!success) return;
    const row = clampToGrid(e.y, cellSize, rows);
    const col = clampToGrid(e.x, cellSize, columns);
    runOnJS(commit)(row, col, row, col, rectIndexAt(placedShared.value, row, col));
  });

  const gesture = Gesture.Race(pan, tap);

  const previewStyle = useAnimatedStyle(() => {
    const r1 = Math.min(startRow.value, curRow.value);
    const r2 = Math.max(startRow.value, curRow.value) + 1;
    const c1 = Math.min(startCol.value, curCol.value);
    const c2 = Math.max(startCol.value, curCol.value) + 1;
    return {
      opacity: withTiming(dragging.value ? 1 : 0, { duration: dragging.value ? 90 : 130 }),
      top: r1 * cellSize,
      left: c1 * cellSize,
      width: withTiming((c2 - c1) * cellSize, { duration: 90 }),
      height: withTiming((r2 - r1) * cellSize, { duration: 90 }),
      transform: [{ scale: withTiming(dragging.value ? 1 : 0.96, { duration: 110 }) }],
    };
  });

  return { gesture, previewStyle };
}
