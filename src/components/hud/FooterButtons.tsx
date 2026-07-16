import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemeTokens } from '@/state/themeStore';

interface FooterButtonsProps {
  hintLabel: string;
  hintDisabled: boolean;
  showNext: boolean;
  nextLabel: string;
  onUndo: () => void;
  onClear: () => void;
  onHint: () => void;
  onLevels: () => void;
  onNext: () => void;
}

export function FooterButtons({
  hintLabel,
  hintDisabled,
  showNext,
  nextLabel,
  onUndo,
  onClear,
  onHint,
  onLevels,
  onNext,
}: FooterButtonsProps) {
  const theme = useThemeTokens();

  return (
    <View style={styles.footer}>
      <View style={styles.row}>
        <FooterBtn icon="↩" label="Undo" onPress={onUndo} theme={theme} />
        <FooterBtn icon="✕" label="Clear" onPress={onClear} theme={theme} />
        <FooterBtn icon="?" label={hintLabel} onPress={onHint} theme={theme} disabled={hintDisabled} />
        <FooterBtn icon="⊞" label="Levels" onPress={onLevels} theme={theme} />
      </View>
      {showNext && (
        <Pressable style={[styles.nextBtn, { backgroundColor: theme.accent }]} onPress={onNext}>
          <Text style={styles.nextBtnText}>{nextLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

function FooterBtn({
  icon,
  label,
  onPress,
  theme,
  disabled,
}: {
  icon: string;
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
      <Text style={styles.btnIcon}>{icon}</Text>
      <Text style={[styles.btnLabel, { color: theme.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  footer: { width: '100%', maxWidth: 480, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20, gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 3,
  },
  btnIcon: { fontSize: 19, lineHeight: 19 },
  btnLabel: { fontSize: 11, fontWeight: '600' },
  nextBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
