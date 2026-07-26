import Svg, { Rect } from 'react-native-svg';

interface LogoProps {
  size?: number;
}

// Brand mark: a small rounded square divided into rectangles, echoing the
// Shikaku mechanic (divide the grid into rectangles) rather than an emoji.
export function Logo({ size = 28 }: LogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect x={0} y={0} width={32} height={32} rx={9} fill="#a8b9d8" />
      <Rect x={5} y={5} width={13} height={9} rx={2} fill="#f6ed94" />
      <Rect x={20} y={5} width={7} height={22} rx={2} fill="#9fcf9b" />
      <Rect x={5} y={16} width={13} height={11} rx={2} fill="#ffffff" fillOpacity={0.85} />
    </Svg>
  );
}
