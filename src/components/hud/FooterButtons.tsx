import { StyleSheet, Text, View } from 'react-native';
import Eraser from 'lucide-react-native/icons/eraser';
import Lightbulb from 'lucide-react-native/icons/lightbulb';
import Undo2 from 'lucide-react-native/icons/undo-2';
import type { LucideIcon } from 'lucide-react-native';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { useThemeTokens } from '@/state/themeStore';
import { useI18n } from '@/i18n';

interface FooterButtonsProps {
  hintLabel: string;
  hintDisabled: boolean;
  /** A solved board takes no more edits, so the two that change it go grey with the hint. */
  editDisabled?: boolean;
  onUndo: () => void;
  onClear: () => void;
  onHint: () => void;
  bottomInset?: number;
}

export function FooterButtons({
  hintLabel,
  hintDisabled,
  editDisabled = false,
  onUndo,
  onClear,
  onHint,
  bottomInset = 0,
}: FooterButtonsProps) {
  const { t } = useI18n();

  return (
    <View style={[styles.footer, { paddingBottom: Math.max(16, bottomInset) }]}>
      <View style={styles.row}>
        <FooterBtn Icon={Undo2} label={t('game.undo')} onPress={onUndo} disabled={editDisabled} />
        <FooterBtn Icon={Eraser} label={t('game.clear')} onPress={onClear} disabled={editDisabled} />
        <FooterBtn Icon={Lightbulb} label={hintLabel} onPress={onHint} disabled={hintDisabled} />
      </View>
    </View>
  );
}

function FooterBtn({
  Icon,
  label,
  onPress,
  disabled,
}: {
  Icon: LucideIcon;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  // Reads the theme itself rather than taking it down as a prop. The prop was typed to the
  // three fields this button happened to use, which is a shape that stops matching ThemeTokens
  // the moment a token is added, silently and only here.
  const theme = useThemeTokens();

  return (
    <AnimatedPressable
      accessibilityRole="button"
      feedback="control"
      style={[styles.btn, { backgroundColor: theme.surface, borderColor: theme.gridSep, opacity: disabled ? 0.4 : 1 }]}
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Icon size={20} color={theme.text} strokeWidth={2.1} />
      <Text style={[styles.btnLabel, { color: theme.text }]}>
        {label}
      </Text>
    </AnimatedPressable>
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
  // Wraps instead of truncating: the three buttons only have a third of the width each, so
  // at the accessibility sizes "Desfazer" would otherwise become "Desfa…".
  btnLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
});
