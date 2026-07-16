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
  clueColor?: string;
  state: CellState;
  edges: CellEdges;
  fillColor?: string;
  borderColor?: string;
}

const BORDER_W = 2.5;
const GAP_COLOR = '#f0eaf5';

export function Cell({ size, clueValue, clueColor, state, edges, fillColor, borderColor }: CellProps) {
  const bg = state === 'empty' ? '#ffffff' : state === 'correct' ? (fillColor ?? '#f5f0e8') : 'rgba(120,100,160,0.06)';
  const fontSize = size >= 40 ? 17 : size >= 34 ? 14 : size >= 28 ? 12 : 10;

  return (
    <View
      style={[
        styles.cell,
        {
          width: size,
          height: size,
          backgroundColor: bg,
          borderTopWidth: edges.top ? BORDER_W : 0.5,
          borderBottomWidth: edges.bottom ? BORDER_W : 0.5,
          borderLeftWidth: edges.left ? BORDER_W : 0.5,
          borderRightWidth: edges.right ? BORDER_W : 0.5,
          borderTopColor: edges.top && borderColor ? borderColor : GAP_COLOR,
          borderBottomColor: edges.bottom && borderColor ? borderColor : GAP_COLOR,
          borderLeftColor: edges.left && borderColor ? borderColor : GAP_COLOR,
          borderRightColor: edges.right && borderColor ? borderColor : GAP_COLOR,
        },
      ]}
    >
      {clueValue != null && <Text style={[styles.clue, { fontSize, color: clueColor ?? '#3a2d45' }]}>{clueValue}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { alignItems: 'center', justifyContent: 'center' },
  clue: { fontWeight: '800', color: '#3a2d45' },
});
