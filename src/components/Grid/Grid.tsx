import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { rectOk } from '@/game/geometry';
import type { Level, PlacedRect, SolutionRect } from '@/game/types';
import { BD_PAL, BG_PAL } from '@/theme/palette';
import { useThemeTokens } from '@/state/themeStore';
import { Cell, type CellEdges, type CellState } from './Cell';
import { useDragToPlaceRect } from './useDragToPlaceRect';

interface GridProps {
  level: Level;
  placed: PlacedRect[];
  cellSize: number;
  onPlace: (rect: SolutionRect) => void;
  onRemoveAt: (index: number) => void;
  celebrating?: boolean;
}

interface CellInfo {
  colorIndex: number;
  colors?: PlacedRect['colors'];
  correct: boolean;
  edges: CellEdges;
}

const EMPTY_EDGES: CellEdges = { top: false, bottom: false, left: false, right: false };

export function Grid({ level, placed, cellSize, onPlace, onRemoveAt, celebrating = false }: GridProps) {
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

  const { gesture, previewStyle } = useDragToPlaceRect({ rows, columns, cellSize, placed, onPlace, onRemoveAt });

  const fillPal = BG_PAL;
  const borderPal = BD_PAL;

  return (
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
                  emptyColor={level.emptyFillColor}
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
        <CompletionGlow active={celebrating} color={theme.accent} />
      </View>
    </GestureDetector>
  );
}

function CelebrationRect({ rect, cellSize, color, active, index }: { rect: PlacedRect; cellSize: number; color: string; active: boolean; index: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    if (active) {
      progress.value = withDelay(index * 85, withSequence(withTiming(1, { duration: 230 }), withTiming(0, { duration: 280 })));
    }
  }, [active, index, progress]);

  const style = useAnimatedStyle(() => ({
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

function CompletionGlow({ active, color }: { active: boolean; color: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    if (active) progress.value = withDelay(180, withSequence(withTiming(1, { duration: 280 }), withTiming(0, { duration: 420 })));
  }, [active, progress]);

  const style = useAnimatedStyle(() => ({
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
