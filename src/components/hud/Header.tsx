import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Map from 'lucide-react-native/icons/map';
import Share2 from 'lucide-react-native/icons/share-2';
import { Logo } from '@/components/Logo';
import { useThemeTokens } from '@/state/themeStore';
import type { Mode } from '@/state/uiStore';
import { useI18n } from '@/i18n';

interface HeaderProps {
  mode: Mode;
  levelLabel: string;
  diffLabel: string;
  onMenu: () => void;
  onLevels?: () => void;
  onShare?: () => void;
  topInset?: number;
}

const BADGES: Partial<Record<Mode, { labelKey: string; bg: string; fg: string; border: string }>> = {
  training: { labelKey: 'game.badgeTraining', bg: '#ffd6e0', fg: '#b03060', border: '#ffb3c6' },
  daily: { labelKey: 'game.badgeDaily', bg: '#fff8d0', fg: '#8a6000', border: '#f0c820' },
  infinite: { labelKey: 'game.badgeInfinite', bg: '#e8d5ff', fg: '#6040a0', border: '#c0a8e8' },
};

export function Header({ mode, levelLabel, diffLabel, onMenu, onLevels, onShare, topInset = 0 }: HeaderProps) {
  const theme = useThemeTokens();
  const { t } = useI18n();
  const badge = BADGES[mode];
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const actionCount = (onLevels ? 1 : 0) + (onShare ? 1 : 0);
  const contentWidth = Math.min(width, 480) - 32;
  const actionWidth = actionCount ? actionCount * 36 + Math.max(0, actionCount - 1) * 6 + 6 : 0;
  const levelWidth = Math.max(78, Math.min(130, contentWidth - actionWidth - (compact ? 80 : 94)));

  return (
    <View style={[styles.header, { paddingTop: Math.max(12, topInset) }]}>
      <Pressable accessibilityRole="button" style={styles.brand} onPress={onMenu} accessibilityLabel={t('a11y.backToMenu')}>
        <Logo size={compact ? 23 : 28} />
        <Text style={[styles.title, compact && styles.titleCompact, { color: theme.text }]} numberOfLines={1}>Bumi</Text>
        {badge && (
          <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
            <Text style={[styles.badgeText, { color: badge.fg }]}>{t(badge.labelKey)}</Text>
          </View>
        )}
      </Pressable>

      <View style={styles.actions}>
        <View style={[styles.levelMeta, { width: levelWidth }]}>
          <Text style={[styles.levelNum, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{levelLabel}</Text>
          <Text style={[styles.levelDiff, { color: theme.sub }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{diffLabel}</Text>
        </View>
        {onLevels && (
          <Pressable accessibilityRole="button" style={[styles.iconButton, { borderColor: theme.gridSep }]} onPress={onLevels} accessibilityLabel={t('a11y.openLevels')}>
            <Map size={18} color={theme.text} strokeWidth={2.2} />
          </Pressable>
        )}
        {onShare && (
          <Pressable accessibilityRole="button" style={[styles.iconButton, { borderColor: theme.gridSep }]} onPress={onShare} accessibilityLabel={t('a11y.shareChallenge')}>
            <Share2 size={18} color={theme.text} strokeWidth={2.2} />
          </Pressable>
        )}
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: 8 },
  brand: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 38 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  titleCompact: { fontSize: 20 },
  badge: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 6, flexShrink: 0 },
  levelMeta: { alignItems: 'flex-end', minWidth: 0 },
  levelNum: { fontSize: 16, fontWeight: '700' },
  levelDiff: { fontSize: 10, alignSelf: 'stretch', textAlign: 'right' },
});
