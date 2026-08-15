import { memo } from 'react';
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
 * Cells used to *be* the placed rectangles, each painting its share of the fill and border.
 * That only reads as one shape while the squares abut exactly, and at any display density
 * where a cell is a fractional number of pixels every seam leaks a hairline of the board
 * behind it, drawing a grid across shapes meant to be solid.
 *
 * A rectangle is now one view, drawn underneath this layer. A covered cell goes transparent to
 * let its piece through and keeps only the clue, which has to stay above the fill to be read.
 *
 * Memoised because there are up to 144 of these and they re-render together: placing one
 * rectangle changes at most a few squares, but the parent rebuilds the whole board on every
 * placement, every theme change and every parent render. Every prop below is a primitive, so
 * the default shallow compare is exact rather than approximate — keep it that way. An object
 * or an inline arrow in this list would make the compare always fail and the memo do nothing.
 */
function CellView({ size, clueValue, clueColor, state, emptyColor, gapColor }: CellProps) {
  const isFilled = state !== 'empty';
  // A 12x12 board on a 360pt phone lands `size` around 25-27, where the old ladder bottomed out
  // at 10px for a number the player reads on every single move. The floor is 11 and the steps
  // moved down with it. It still fits: clues are capped at `MAX_CLUE_VALUE` (16), so two digits
  // at weight 800 is the widest a cell ever has to hold — 12px x the 1.4 multiplier cap x two
  // digits at roughly 0.6em each is about 20pt inside a 26pt square.
  const fontSize = size >= 38 ? 17 : size >= 32 ? 14 : size >= 26 ? 12 : 11;
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

export const Cell = memo(CellView);

const styles = StyleSheet.create({
  cell: { alignItems: 'center', justifyContent: 'center' },
  clue: { fontWeight: '800' },
});
