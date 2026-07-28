import { StyleSheet, Text, View } from 'react-native';

export interface CellEdges {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

export type CellState = 'empty' | 'placed' | 'correct';

interface CellProps {
  size: number;
  clueValue?: number;
  clueColor: string;
  state: CellState;
  edges: CellEdges;
  fillColor?: string;
  borderColor?: string;
  emptyColor: string;
  gapColor: string;
}

const BORDER_W = 3;

export function Cell({ size, clueValue, clueColor, state, edges, fillColor, borderColor, emptyColor, gapColor }: CellProps) {
  const isFilled = state !== 'empty';
  const bg = state === 'empty' ? emptyColor : state === 'correct' ? (fillColor ?? emptyColor) : 'rgba(113,140,195,0.12)';
  const fontSize = size >= 40 ? 17 : size >= 34 ? 14 : size >= 28 ? 12 : 10;

  return (
    <View
      style={[
        styles.cell,
        {
          width: size,
          height: size,
          backgroundColor: bg,
          borderTopWidth: edges.top ? BORDER_W : isFilled ? 0 : 0.75,
          borderBottomWidth: edges.bottom ? BORDER_W : isFilled ? 0 : 0.75,
          borderLeftWidth: edges.left ? BORDER_W : isFilled ? 0 : 0.75,
          borderRightWidth: edges.right ? BORDER_W : isFilled ? 0 : 0.75,
          borderTopColor: edges.top && borderColor ? borderColor : gapColor,
          borderBottomColor: edges.bottom && borderColor ? borderColor : gapColor,
          borderLeftColor: edges.left && borderColor ? borderColor : gapColor,
          borderRightColor: edges.right && borderColor ? borderColor : gapColor,
          borderTopLeftRadius: edges.top && edges.left ? 10 : 0,
          borderTopRightRadius: edges.top && edges.right ? 10 : 0,
          borderBottomLeftRadius: edges.bottom && edges.left ? 10 : 0,
          borderBottomRightRadius: edges.bottom && edges.right ? 10 : 0,
        },
      ]}
    >
      {/* The only capped text in the app: a cell is sized from the board, not from the clue,
          so an unbounded multiplier would push two-digit clues outside their own square.
          1.4 is the most a clue can grow and still sit inside the smallest cell. */}
      {clueValue != null && (
        <Text style={[styles.clue, { fontSize, color: clueColor }]} maxFontSizeMultiplier={1.4}>
          {clueValue}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { alignItems: 'center', justifyContent: 'center' },
  clue: { fontWeight: '800' },
});
