import type { ReactElement } from 'react';
import { Circle, Line } from 'react-native-svg';

// Ported from the original 7 CSS repeating-linear-gradient patterns, re-expressed as small
// SVG tile primitives (CSS background-image patterns have no RN equivalent).
type PatternRenderer = () => ReactElement[];

const diagUp: PatternRenderer = () => [<Line key="l" x1={0} y1={7} x2={7} y2={0} stroke="rgba(0,0,0,.13)" strokeWidth={2} />];
const diagDown: PatternRenderer = () => [<Line key="l" x1={0} y1={0} x2={7} y2={7} stroke="rgba(0,0,0,.13)" strokeWidth={2} />];
const horiz: PatternRenderer = () => [<Line key="l" x1={0} y1={3.5} x2={7} y2={3.5} stroke="rgba(0,0,0,.13)" strokeWidth={2} />];
const vert: PatternRenderer = () => [<Line key="l" x1={3.5} y1={0} x2={3.5} y2={7} stroke="rgba(0,0,0,.13)" strokeWidth={2} />];
const dots: PatternRenderer = () => [<Circle key="d" cx={3.5} cy={3.5} r={1.3} fill="rgba(0,0,0,.16)" />];
const cross: PatternRenderer = () => [
  <Line key="l1" x1={0} y1={0} x2={5} y2={5} stroke="rgba(0,0,0,.1)" strokeWidth={1.5} />,
  <Line key="l2" x1={5} y1={0} x2={0} y2={5} stroke="rgba(0,0,0,.1)" strokeWidth={1.5} />,
];
const thickHoriz: PatternRenderer = () => [<Line key="l" x1={0} y1={5} x2={10} y2={5} stroke="rgba(0,0,0,.13)" strokeWidth={4} />];

export const CB_PATTERNS: { render: PatternRenderer; tile: number }[] = [
  { render: diagUp, tile: 7 },
  { render: diagDown, tile: 7 },
  { render: horiz, tile: 7 },
  { render: vert, tile: 7 },
  { render: dots, tile: 7 },
  { render: cross, tile: 5 },
  { render: thickHoriz, tile: 10 },
];

export const BG_PAL_CB = [
  '#F5C842', '#4DB3E6', '#52B788', '#E07C5A', '#A06BBF', '#88C0A0', '#D4885A', '#6090D0',
  '#C8A030', '#2090C0', '#308870', '#C05040', '#7050A0', '#508870', '#B06830', '#4070B0',
];

export const BD_PAL_CB = [
  '#B09010', '#1070A0', '#206850', '#A03020', '#503080', '#306050', '#904810', '#204890',
  '#A07010', '#107090', '#105040', '#802010', '#302060', '#205040', '#703010', '#103070',
];
