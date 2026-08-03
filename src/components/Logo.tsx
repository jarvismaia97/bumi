import Svg, { Rect } from 'react-native-svg';

interface LogoProps {
  size?: number;
}

// Brand mark: the rounded square divided into rectangles, which is the Shikaku mechanic
// itself rather than an emoji of it. The proportions are the ones the tutorial's last level
// asks the player to build — a 3x3 grid where the yellow is 1x2, the white 2x2 and the green
// 3x1 — so the mark and the puzzle are the same shape. On a 32 canvas that is a margin of 4,
// a gutter of 3, and units of 7 and 14: 4 + 14 + 3 + 7 + 4 = 32, exactly, in both directions.
// Corners stay at 2: the yellow piece is seven units tall, and a radius of 3 turns it into a
// capsule at icon sizes, which is a lozenge rather than a rectangle in a puzzle about them.
export function Logo({ size = 28 }: LogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect x={0} y={0} width={32} height={32} rx={9} fill="#a8b9d8" />
      <Rect x={4} y={4} width={14} height={7} rx={2} fill="#f6ed94" />
      <Rect x={21} y={4} width={7} height={24} rx={2} fill="#9fcf9b" />
      <Rect x={4} y={14} width={14} height={14} rx={2} fill="#ffffff" fillOpacity={0.85} />
    </Svg>
  );
}
