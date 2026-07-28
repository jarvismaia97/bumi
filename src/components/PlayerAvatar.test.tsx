import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AVATAR_GRID, playerAvatar } from '@/lib/identity';
import { PlayerAvatarTile } from './PlayerAvatar';

// react-native-web resolves `transparent` to a fully transparent rgba, not the keyword.
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

/** The tile is a column of rows of leaf cells; the leaves are the squares. */
function paintedCells(container: HTMLElement): boolean[] {
  return Array.from(container.querySelectorAll('div'))
    .filter(node => node.children.length === 0)
    .map(node => node.style.backgroundColor !== TRANSPARENT);
}

describe('PlayerAvatarTile', () => {
  it('renders one square per grid cell', () => {
    const { container } = render(<PlayerAvatarTile userId="user_abc123" />);
    expect(paintedCells(container)).toHaveLength(AVATAR_GRID * AVATAR_GRID);
  });

  it('paints exactly the cells the generator marked', () => {
    const { cells } = playerAvatar('user_abc123');
    const { container } = render(<PlayerAvatarTile userId="user_abc123" />);
    expect(paintedCells(container)).toEqual(cells.map(cell => cell !== null));
  });

  it('uses more than one ink, so a tile is not a two-colour silhouette', () => {
    const { container } = render(<PlayerAvatarTile userId="user_abc123" />);
    const inks = new Set(
      Array.from(container.querySelectorAll('div'))
        .filter(node => node.children.length === 0)
        .map(node => node.style.backgroundColor)
        .filter(colour => colour !== TRANSPARENT),
    );
    expect(inks.size).toBeGreaterThan(1);
  });

  it('gives two different accounts different tiles', () => {
    const first = render(<PlayerAvatarTile userId="user_a" />).container.innerHTML;
    const second = render(<PlayerAvatarTile userId="user_b" />).container.innerHTML;
    expect(first).not.toBe(second);
  });

  it('still renders something for a signed-out or unknown player', () => {
    const { container } = render(<PlayerAvatarTile userId={null} />);
    expect(paintedCells(container).some(Boolean)).toBe(true);
  });
});
