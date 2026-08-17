import Svg, { Path } from 'react-native-svg';

interface AppleMarkProps {
  size?: number;
  /** Apple's button has two colourways and the mark inverts with them, so it is passed in. */
  color?: string;
}

/**
 * The Apple mark, drawn rather than typed.
 *
 * The button used to render ``, the codepoint Apple keeps in the Unicode private use area.
 * That resolves against Apple's own system fonts and nowhere else, so on iOS it looked right and
 * in a browser it drew nothing at all — a black pill reading "Continuar com Apple" with a gap
 * where the logo belongs, which is precisely the thing Apple's guidelines do not allow.
 *
 * A path has no font to depend on. The viewBox is square with the glyph sized to sit on the
 * label's cap height, which is why the leaf tucks above the body rather than beside it.
 */
export function AppleMark({ size = 18, color = '#ffffff' }: AppleMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Apple">
      <Path
        fill={color}
        d="M17.05 12.54c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.19-1.72-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.87-.76-1.48.02-2.84.86-3.6 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.25 2.74 2.2 1.1-.04 1.51-.71 2.84-.71 1.33 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.14.84-1.23 1.18-2.42 1.2-2.48-.03-.01-2.29-.88-2.31-3.49l.04-.02ZM14.87 6.1c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.55 1.31-.56.65-1.05 1.68-.92 2.67.97.08 1.96-.49 2.57-1.22Z"
      />
    </Svg>
  );
}
