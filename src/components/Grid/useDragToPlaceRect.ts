import { useEffect } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import type { PlacedRect, SolutionRect } from '@/game/types';

// Drag-to-draw + tap-to-delete, proven in the standalone gesture spike (src/app/gesture-spike.tsx).
// Row/col are derived from the pan gesture's view-local coordinates — no elementFromPoint
// equivalent needed. `.minDistance(0)` is required or a zero-movement tap never fires at all.
interface Options {
  size: number;
  cellSize: number;
  placed: PlacedRect[];
  onPlace: (rect: SolutionRect) => void;
  onRemoveAt: (index: number) => void;
}

export function useDragToPlaceRect({ size, cellSize, placed, onPlace, onRemoveAt }: Options) {
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

  const gesture = Gesture.Pan()
    .minDistance(0)
    .onBegin(e => {
      const row = Math.min(size - 1, Math.max(0, Math.floor(e.y / cellSize)));
      const col = Math.min(size - 1, Math.max(0, Math.floor(e.x / cellSize)));
      startRow.value = row;
      startCol.value = col;
      curRow.value = row;
      curCol.value = col;
      dragging.value = 1;

      const rects = placedShared.value;
      let idx = -1;
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (row >= r.r1 && row < r.r2 && col >= r.c1 && col < r.c2) idx = i;
      }
      hitRectIndex.value = idx;
    })
    .onUpdate(e => {
      curRow.value = Math.min(size - 1, Math.max(0, Math.floor(e.y / cellSize)));
      curCol.value = Math.min(size - 1, Math.max(0, Math.floor(e.x / cellSize)));
    })
    .onEnd((_e, success) => {
      if (success) {
        runOnJS(commit)(startRow.value, startCol.value, curRow.value, curCol.value, hitRectIndex.value);
      }
    })
    .onFinalize(() => {
      dragging.value = 0;
    });

  const previewStyle = useAnimatedStyle(() => {
    if (!dragging.value) return { opacity: 0 };
    const r1 = Math.min(startRow.value, curRow.value);
    const r2 = Math.max(startRow.value, curRow.value) + 1;
    const c1 = Math.min(startCol.value, curCol.value);
    const c2 = Math.max(startCol.value, curCol.value) + 1;
    return {
      opacity: 1,
      top: r1 * cellSize,
      left: c1 * cellSize,
      width: (c2 - c1) * cellSize,
      height: (r2 - r1) * cellSize,
    };
  });

  return { gesture, previewStyle };
}
