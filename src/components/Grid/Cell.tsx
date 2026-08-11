import { StyleSheet, Text, View } from 'react-native';

export type CellState = 'empty' | 'placed' | 'correct';

interface CellProps {
  size: number;
  clueValue?: number;
  clueColor: string;
  state: CellState;
  emptyColor: string;
  gapColor: string;
}

/**
 * A square of board, and nothing more.
 *
 * Cells used to *be* the placed rectangles: each one painted its share of the fill and the
 * pieces of border that fell on its own edges, and a rectangle was however many of those
 * happened to sit next to each other. That only looks like one shape while the squares abut
 * exactly, and they cannot be relied on to — at any display density where a cell is a
 * fractional number of pixels, every seam leaks a hairline of the board behind it, drawing a
 * grid across shapes that are supposed to be solid.
 *
 * The rectangles are now drawn as whole rectangles, one view each, underneath this layer. A
 * covered cell goes transparent to let its own piece through and keeps only the clue, which
 * has to stay above the fill to be read at all.
 */
export function Cell({ size, clueValue, clueColor, state, emptyColor, gapColor }: CellProps) {
  const isFilled = state !== 'empty';
  const fontSize = size >= 40 ? 17 : size >= 34 ? 14 : size >= 28 ? 12 : 10;
  // Only the empty squares draw the board's lines; a covered one would draw them over its piece.
  const borderWidth = isFilled ? 0 : 0.75;

  return (
    <View
      style={[
        styles.cell,
        {
          width: size,
          height: size,
          backgroundColor: isFilled ? 'transparent' : emptyColor,
          borderWidth,
          borderColor: gapColor,
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
