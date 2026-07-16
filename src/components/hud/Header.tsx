import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemeTokens } from '@/state/themeStore';
import type { Mode } from '@/state/uiStore';

interface HeaderProps {
  mode: Mode;
  levelLabel: string;
  diffLabel: string;
  onMenu: () => void;
  onLevels: () => void;
}

const BADGES: Partial<Record<Mode, { label: string; bg: string; fg: string; border: string }>> = {
  training: { label: 'Treino', bg: '#ffd6e0', fg: '#b03060', border: '#ffb3c6' },
  daily: { label: 'Diário', bg: '#fff8d0', fg: '#8a6000', border: '#f0c820' },
  infinite: { label: 'Infinito', bg: '#e8d5ff', fg: '#6040a0', border: '#c0a8e8' },
};

export function Header({ mode, levelLabel, diffLabel, onMenu, onLevels }: HeaderProps) {
  const theme = useThemeTokens();
  const badge = BADGES[mode];

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        <Pressable onPress={onMenu} hitSlop={8}>
          <Text style={[styles.iconBtn, { color: theme.text }]}>⌂</Text>
        </Pressable>
        <Pressable onPress={onLevels} hitSlop={8}>
          <Text style={[styles.iconBtn, { color: theme.text }]}>☰</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Bumi 🌴</Text>
        {badge && (
          <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
            <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
          </View>
        )}
      </View>
      <View style={styles.right}>
        <Text style={[styles.levelNum, { color: theme.text }]}>{levelLabel}</Text>
        <Text style={[styles.levelDiff, { color: theme.sub }]}>{diffLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { fontSize: 20 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  badge: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  right: { alignItems: 'flex-end' },
  levelNum: { fontSize: 16, fontWeight: '700' },
  levelDiff: { fontSize: 12 },
});
