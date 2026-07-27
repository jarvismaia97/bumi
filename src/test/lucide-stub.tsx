import { View } from 'react-native';

// lucide-react-native pulls in react-native-svg, whose source is Flow-typed and cannot be
// parsed by vitest. Icons are decorative here — every one of them sits next to a text
// label — so component tests swap the whole package for a plain view.
export default function StubIcon(props: Record<string, unknown>) {
  return <View {...props} />;
}
