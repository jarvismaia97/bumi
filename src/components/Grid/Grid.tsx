import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { rectOk } from '@/game/geometry';
import type { Level, PlacedRect, SolutionRect } from '@/game/types';
import { BD_PAL, BG_PAL } from '@/theme/palette';
import { BD_PAL_CB, BG_PAL_CB } from '@/theme/colorblindPatterns';
import { ColorblindOverlay } from '@/theme/ColorblindOverlay';
import { useThemeTokens } from '@/state/themeStore';
import { Cell, type CellEdges, type CellState } from './Cell';
import { useDragToPlaceRect } from './useDragToPlaceRect';

interface GridProps {
  level: Level;
  placed: PlacedRect[];
  cellSize: number;
  colorblind: boolean;
  onPlace: (rect: SolutionRect) => void;
  onRemoveAt: (index: number) => void;
}

interface CellInfo {
  rectIndex: number;
  correct: boolean;
  edges: CellEdges;
}

const EMPTY_EDGES: CellEdges = { top: false, bottom: false, left: false, right: false };

export function Grid({ level, placed, cellSize, colorblind, onPlace, onRemoveAt }: GridProps) {
  const { size, clues } = level;
  const gridPx = size * cellSize;
  const theme = useThemeTokens();

  const cellInfo = useMemo(() => {
    const grid: (CellInfo | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
    placed.forEach((rect, idx) => {
      const correct = rectOk(rect, level);
      for (let r = rect.r1; r < rect.r2; r++) {
        for (let c = rect.c1; c < rect.c2; c++) {
          grid[r][c] = {
            rectIndex: idx,
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
  }, [placed, level, size]);

  const correctRects = useMemo(
    () =>
      placed
        .map((rect, ci) => ({ rect, ci, correct: rectOk(rect, level) }))
        .filter(r => r.correct)
        .map(({ rect, ci }) => ({ rect, ci })),
    [placed, level],
  );

  const { gesture, previewStyle } = useDragToPlaceRect({ size, cellSize, placed, onPlace, onRemoveAt });

  const fillPal = colorblind ? BG_PAL_CB : BG_PAL;
  const borderPal = colorblind ? BD_PAL_CB : BD_PAL;

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.grid, { width: gridPx, height: gridPx, backgroundColor: theme.gridSep }]}>
        {Array.from({ length: size }).map((_, r) => (
          <View key={r} style={styles.row}>
            {Array.from({ length: size }).map((_, c) => {
              const info = cellInfo[r][c];
              const clue = clues.find(cl => cl.r === r && cl.c === c);
              const state: CellState = info ? (info.correct ? 'correct' : 'placed') : 'empty';

              let fillColor: string | undefined;
              let borderColor: string | undefined;
              if (info) {
                fillColor = fillPal[info.rectIndex % fillPal.length];
                borderColor = borderPal[info.rectIndex % borderPal.length];
              }

              return (
                <Cell
                  key={c}
                  size={cellSize}
                  clueValue={clue && clue.v > 1 ? clue.v : undefined}
                  clueColor={theme.accent}
                  state={state}
                  edges={info?.edges ?? EMPTY_EDGES}
                  fillColor={fillColor}
                  borderColor={borderColor}
                />
              );
            })}
          </View>
        ))}

        {colorblind && (
          <ColorblindOverlay size={size} cellSize={cellSize} correctRects={correctRects} />
        )}

        <Animated.View pointerEvents="none" style={[styles.preview, { borderColor: theme.accent, backgroundColor: theme.accent + '30' }]} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  grid: { position: 'relative', borderRadius: 10, overflow: 'hidden' },
  row: { flexDirection: 'row' },
  preview: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
});
