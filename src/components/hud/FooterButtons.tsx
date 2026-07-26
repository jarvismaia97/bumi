import { Pressable, StyleSheet, Text, View } from 'react-native';
import Eraser from 'lucide-react-native/icons/eraser';
import Lightbulb from 'lucide-react-native/icons/lightbulb';
import Undo2 from 'lucide-react-native/icons/undo-2';
import type { LucideIcon } from 'lucide-react-native';
import { useThemeTokens } from '@/state/themeStore';

interface FooterButtonsProps {
  hintLabel: string;
  hintDisabled: boolean;
  onUndo: () => void;
  onClear: () => void;
  onHint: () => void;
  bottomInset?: number;
}

export function FooterButtons({
  hintLabel,
  hintDisabled,
  onUndo,
  onClear,
  onHint,
  bottomInset = 0,
}: FooterButtonsProps) {
  const theme = useThemeTokens();

  return (
    <View style={[styles.footer, { paddingBottom: Math.max(16, bottomInset) }]}>
      <View style={styles.row}>
        <FooterBtn Icon={Undo2} label="Desfazer" onPress={onUndo} theme={theme} />
        <FooterBtn Icon={Eraser} label="Limpar" onPress={onClear} theme={theme} />
        <FooterBtn Icon={Lightbulb} label={hintLabel} onPress={onHint} theme={theme} disabled={hintDisabled} />
      </View>
    </View>
  );
}

function FooterBtn({
  Icon,
  label,
  onPress,
  theme,
  disabled,
}: {
  Icon: LucideIcon;
  label: string;
  onPress: () => void;
  theme: { text: string; surface: string; gridSep: string };
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.btn, { backgroundColor: theme.surface, borderColor: theme.gridSep, opacity: disabled ? 0.4 : 1 }]}
      onPress={onPress}
      disabled={disabled}
    >
      <Icon size={20} color={theme.text} strokeWidth={2.1} />
      <Text style={[styles.btnLabel, { color: theme.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  footer: { width: '100%', maxWidth: 480, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 3,
  },
  btnLabel: { fontSize: 11, fontWeight: '600' },
});
