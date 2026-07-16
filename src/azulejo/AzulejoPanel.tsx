import Svg, { ClipPath, Defs, G, Pattern, Rect } from 'react-native-svg';
import type { SolutionRect } from '@/game/types';
import { getAzulejoMotif } from './patterns';

interface AzulejoPanelProps {
  size: number;
  cellSize: number;
  revealedRects: SolutionRect[];
  patternIndex: number;
}

const TILE = 24;

// Whole-grid seamless pattern reveal, proven in the standalone spike (src/app/azulejo-spike.tsx).
// One <Pattern> anchored to the grid's own coordinate space + a <ClipPath> built from the union
// of solved rects — the pattern stays continuous across rect boundaries as more get solved.
export function AzulejoPanel({ size, cellSize, revealedRects, patternIndex }: AzulejoPanelProps) {
  if (!revealedRects.length) return null;

  const gridPx = size * cellSize;
  const { render, color } = getAzulejoMotif(patternIndex);
  const patternId = `azulejo-pattern-${patternIndex}`;
  const clipId = `azulejo-clip-${patternIndex}`;

  return (
    <Svg width={gridPx} height={gridPx} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
      <Defs>
        <Pattern id={patternId} patternUnits="userSpaceOnUse" width={TILE} height={TILE}>
          {render(color)}
        </Pattern>
        <ClipPath id={clipId}>
          {revealedRects.map((r, i) => (
            <Rect
              key={i}
              x={r.c1 * cellSize}
              y={r.r1 * cellSize}
              width={(r.c2 - r.c1) * cellSize}
              height={(r.r2 - r.r1) * cellSize}
            />
          ))}
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <Rect width={gridPx} height={gridPx} fill="#f5f0e8" />
        <Rect width={gridPx} height={gridPx} fill={`url(#${patternId})`} />
      </G>
    </Svg>
  );
}
