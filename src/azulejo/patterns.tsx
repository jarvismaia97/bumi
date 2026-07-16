import type { ReactElement } from 'react';
import { Circle, Ellipse, Line, Path, Polygon, Rect } from 'react-native-svg';

// The 8 azulejo motifs, ported verbatim (same coordinates/opacities) from the original
// inline-SVG-data-URI definitions, re-expressed as react-native-svg elements so they can
// live inside a <Pattern> (SVG data URIs can't be used as an RN background-image).
export type MotifRenderer = (color: string) => ReactElement[];

const cruz: MotifRenderer = c => [
  <Rect key="v" fill={`rgba(${c},.27)`} x={11} y={0} width={2} height={24} />,
  <Rect key="h" fill={`rgba(${c},.27)`} x={0} y={11} width={24} height={2} />,
  <Circle key="d" fill={`rgba(${c},.54)`} cx={12} cy={12} r={3.5} />,
];

const losango: MotifRenderer = c => [
  <Path key="d" fill={`rgba(${c},.42)`} fillRule="evenodd" d="M12,1L23,12L12,23L1,12ZM12,7L17,12L12,17L7,12Z" />,
];

const quatrefoil: MotifRenderer = c => [
  <Circle key="tl" fill={`rgba(${c},.34)`} cx={0} cy={0} r={13} />,
  <Circle key="tr" fill={`rgba(${c},.34)`} cx={24} cy={0} r={13} />,
  <Circle key="bl" fill={`rgba(${c},.34)`} cx={0} cy={24} r={13} />,
  <Circle key="br" fill={`rgba(${c},.34)`} cx={24} cy={24} r={13} />,
];

const circulos: MotifRenderer = c => [
  <Circle key="o" fill="none" stroke={`rgba(${c},.37)`} strokeWidth={1.5} cx={12} cy={12} r={9} />,
  <Circle key="i" fill="none" stroke={`rgba(${c},.26)`} strokeWidth={1} cx={12} cy={12} r={5} />,
  <Circle key="d" fill={`rgba(${c},.54)`} cx={12} cy={12} r={2.5} />,
];

const estrela: MotifRenderer = c => [
  <Polygon
    key="s"
    fill={`rgba(${c},.42)`}
    points="12,2 13.7,7.8 19.1,4.9 16.2,10.3 22,12 16.2,13.7 19.1,19.1 13.7,16.2 12,22 10.3,16.2 4.9,19.1 7.8,13.7 2,12 7.8,10.3 4.9,4.9 10.3,7.8"
  />,
];

const trellis: MotifRenderer = c => [
  <Line key="d1" x1={0} y1={0} x2={24} y2={24} stroke={`rgba(${c},.32)`} strokeWidth={2} />,
  <Line key="d2" x1={24} y1={0} x2={0} y2={24} stroke={`rgba(${c},.32)`} strokeWidth={2} />,
  <Circle key="tl" fill={`rgba(${c},.48)`} cx={0} cy={0} r={2.5} />,
  <Circle key="tr" fill={`rgba(${c},.48)`} cx={24} cy={0} r={2.5} />,
  <Circle key="bl" fill={`rgba(${c},.48)`} cx={0} cy={24} r={2.5} />,
  <Circle key="br" fill={`rgba(${c},.48)`} cx={24} cy={24} r={2.5} />,
  <Circle key="c" fill={`rgba(${c},.52)`} cx={12} cy={12} r={2} />,
];

const espinha: MotifRenderer = c => [
  <Path key="v1" stroke={`rgba(${c},.4)`} strokeWidth={2.5} fill="none" d="M0,12L12,0L24,12" />,
  <Path key="v2" stroke={`rgba(${c},.4)`} strokeWidth={2.5} fill="none" d="M0,24L12,12L24,24" />,
];

const flor: MotifRenderer = c => [
  <Ellipse key="t" fill={`rgba(${c},.33)`} cx={12} cy={6} rx={4} ry={6} />,
  <Ellipse key="b" fill={`rgba(${c},.33)`} cx={12} cy={18} rx={4} ry={6} />,
  <Ellipse key="l" fill={`rgba(${c},.33)`} cx={6} cy={12} rx={6} ry={4} />,
  <Ellipse key="r" fill={`rgba(${c},.33)`} cx={18} cy={12} rx={6} ry={4} />,
  <Circle key="c" fill={`rgba(${c},.58)`} cx={12} cy={12} r={3} />,
];

export const MOTIFS: MotifRenderer[] = [cruz, losango, quatrefoil, circulos, estrela, trellis, espinha, flor];
export const AZULEJO_COLORS = ['20,55,130', '148,45,22']; // azul português, terracota
export const AZULEJO_PATTERN_COUNT = MOTIFS.length * AZULEJO_COLORS.length; // 16, matches original AZULEJO_PATS

export function getAzulejoMotif(index: number): { render: MotifRenderer; color: string } {
  const i = ((index % AZULEJO_PATTERN_COUNT) + AZULEJO_PATTERN_COUNT) % AZULEJO_PATTERN_COUNT;
  return { render: MOTIFS[Math.floor(i / AZULEJO_COLORS.length)], color: AZULEJO_COLORS[i % AZULEJO_COLORS.length] };
}
