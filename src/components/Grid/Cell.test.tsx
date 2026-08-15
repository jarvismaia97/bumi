import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MAX_CLUE_VALUE } from '@/game/generator';
import { Cell } from './Cell';

const PROPS = { clueColor: '#000000', state: 'empty', emptyColor: '#ffffff', gapColor: '#eeeeee' } as const;

function clueFontSize(size: number, clueValue = MAX_CLUE_VALUE): number {
  const { container } = render(<Cell {...PROPS} size={size} clueValue={clueValue} />);
  const text = container.querySelector('div')!.firstElementChild as HTMLElement;
  return parseFloat(getComputedStyle(text).fontSize);
}

describe('the clue ladder', () => {
  // A 12x12 board on a 360pt phone lands the cell around 25-27, where the ladder used to bottom
  // out at 10px — for the one number the player has to read on every move.
  it('never draws a clue smaller than 11', () => {
    for (let size = 11; size <= 60; size++) {
      expect(clueFontSize(size), `size ${size}`).toBeGreaterThanOrEqual(11);
    }
  });

  it('grows with the cell and never shrinks as it does', () => {
    let previous = 0;
    for (let size = 11; size <= 60; size++) {
      const current = clueFontSize(size);
      expect(current, `size ${size}`).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  /**
   * The cell is sized from the board, not from the clue, so raising the floor has to be checked
   * against the square rather than assumed to fit. Clues are capped at `MAX_CLUE_VALUE`, so two
   * digits is the widest case; 0.6em is a generous advance for a digit at weight 800, and 1.4 is
   * the multiplier cap the `Text` already carries for a player who has enlarged their type.
   *
   * From 19pt up, which is under anything the game lays out: the narrowest shipping phone gives
   * a 12-column board a 22pt cell. Below 19 the ladder overflows — but it overflowed at 10px
   * too, and a square that small is under half a fingertip, so it is the layout's floor to
   * defend and not this one's.
   */
  it('leaves two digits inside the smallest square the board lays out', () => {
    expect(String(MAX_CLUE_VALUE).length).toBe(2);
    for (let size = 19; size <= 60; size++) {
      expect(clueFontSize(size) * 1.4 * 0.6 * 2, `size ${size}`).toBeLessThan(size);
    }
  });
});

describe('Cell memoisation', () => {
  /**
   * Up to 144 of these reconcile together, and the board rebuilds all of them on every
   * placement, every theme change and every parent render. The bail-out is what stops that, and
   * it is worth an assertion because unwrapping the component would cost the whole win without
   * changing a single rendered pixel.
   *
   * What makes the bail-out *exact* rather than approximate is that `CellProps` holds nothing
   * but primitives — no object, no callback — so the default shallow compare is a full compare.
   * That half is enforced by the type rather than by a test: an object prop would have to be
   * added to the interface first, and this comment is where to stop and think when it is.
   */
  it('is memoised, because 144 of them reconcile at once', () => {
    expect(Cell).toHaveProperty('$$typeof', Symbol.for('react.memo'));
  });
});
