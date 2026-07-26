import Svg, { Path } from 'react-native-svg';

interface GoogleMarkProps {
  size?: number;
}

export function GoogleMark({ size = 18 }: GoogleMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" accessibilityLabel="Google">
      <Path fill="#EA4335" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.909c1.702-1.567 2.683-3.875 2.683-6.615Z" />
      <Path fill="#4285F4" d="M9 18c2.43 0 4.467-.806 5.957-2.18l-2.909-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.037-3.71H.956V13.04A9 9 0 0 0 9 18Z" />
      <Path fill="#FBBC05" d="M3.963 10.712A5.412 5.412 0 0 1 3.68 9c0-.594.102-1.172.283-1.712V4.96H.956A9 9 0 0 0 0 9c0 1.452.348 2.828.956 4.04l3.007-2.328Z" />
      <Path fill="#34A853" d="M9 3.578c1.32 0 2.507.454 3.442 1.344l2.581-2.582C13.462.89 11.425 0 9 0A9 9 0 0 0 .956 4.96l3.007 2.328C4.672 5.162 6.656 3.578 9 3.578Z" />
    </Svg>
  );
}
