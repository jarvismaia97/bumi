import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import type { SolutionRect } from '@/game/types';
import { CB_PATTERNS } from './colorblindPatterns';

interface ColorblindOverlayProps {
  size: number;
  cellSize: number;
  correctRects: { rect: SolutionRect; ci: number }[];
}

// Colorblind mode gives each correct rect its own small repeating pattern (independent per
// rect, unlike the azulejo panel's shared whole-grid reveal) so rects stay distinguishable
// without relying on hue.
export function ColorblindOverlay({ size, cellSize, correctRects }: ColorblindOverlayProps) {
  if (!correctRects.length) return null;
  const gridPx = size * cellSize;

  return (
    <Svg width={gridPx} height={gridPx} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
      <Defs>
        {correctRects.map(({ ci }) => {
          const p = CB_PATTERNS[ci % CB_PATTERNS.length];
          return (
            <Pattern key={ci} id={`cb-pattern-${ci}`} patternUnits="userSpaceOnUse" width={p.tile} height={p.tile}>
              {p.render()}
            </Pattern>
          );
        })}
      </Defs>
      {correctRects.map(({ rect, ci }) => (
        <Rect
          key={ci}
          x={rect.c1 * cellSize}
          y={rect.r1 * cellSize}
          width={(rect.c2 - rect.c1) * cellSize}
          height={(rect.r2 - rect.r1) * cellSize}
          fill={`url(#cb-pattern-${ci})`}
        />
      ))}
    </Svg>
  );
}
