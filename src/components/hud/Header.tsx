import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Map from 'lucide-react-native/icons/map';
import Share2 from 'lucide-react-native/icons/share-2';
import { Logo } from '@/components/Logo';
import { useSemanticTokens, useThemeTokens } from '@/state/themeStore';
import type { Mode } from '@/state/uiStore';
import type { SemanticTokens } from '@/theme/themes';
import { hitSlopFor } from '@/lib/touchTarget';
import { useI18n } from '@/i18n';

const ICON_BUTTON_SIZE = 36;
export const ICON_BUTTON_HIT_SLOP = hitSlopFor({ width: ICON_BUTTON_SIZE, height: ICON_BUTTON_SIZE });
/** The brand is flexed across the row, so only its height falls short. */
const BRAND_MIN_HEIGHT = 38;
const BRAND_HIT_SLOP = hitSlopFor({ height: BRAND_MIN_HEIGHT });
// The map and share slops meet in this gap. Two touch targets that overlap make the tap
// between them ambiguous, which is worse than a small one, so the gap holds both rather than
// the slop shrinking to fit the gap.
export const ACTION_GAP = Math.max(6, ICON_BUTTON_HIT_SLOP.left + ICON_BUTTON_HIT_SLOP.right);

interface HeaderProps {
  mode: Mode;
  levelLabel: string;
  diffLabel: string;
  onMenu: () => void;
  onLevels?: () => void;
  onShare?: () => void;
  topInset?: number;
}

type BadgeFamily = 'danger' | 'warning' | 'info';

const BADGES: Partial<Record<Mode, { labelKey: string; family: BadgeFamily }>> = {
  training: { labelKey: 'game.badgeTraining', family: 'danger' },
  daily: { labelKey: 'game.badgeDaily', family: 'warning' },
  infinite: { labelKey: 'game.badgeInfinite', family: 'info' },
};

function badgeColors(semantic: SemanticTokens, family: BadgeFamily) {
  return { fg: semantic[family], bg: semantic[`${family}Surface`], border: semantic[`${family}Border`] };
}

export function Header({ mode, levelLabel, diffLabel, onMenu, onLevels, onShare, topInset = 0 }: HeaderProps) {
  const theme = useThemeTokens();
  const semantic = useSemanticTokens();
  const { t } = useI18n();
  const badge = BADGES[mode];
  const badgeStyle = badge ? badgeColors(semantic, badge.family) : null;
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const actionCount = (onLevels ? 1 : 0) + (onShare ? 1 : 0);
  const contentWidth = Math.min(width, 480) - 32;
  const actionWidth = actionCount ? actionCount * ICON_BUTTON_SIZE + Math.max(0, actionCount - 1) * ACTION_GAP + 6 : 0;
  const levelWidth = Math.max(78, Math.min(130, contentWidth - actionWidth - (compact ? 80 : 94)));

  return (
    <View style={[styles.header, { paddingTop: Math.max(12, topInset) }]}>
      <Pressable accessibilityRole="button" style={styles.brand} hitSlop={BRAND_HIT_SLOP} onPress={onMenu} accessibilityLabel={t('a11y.backToMenu')}>
        <Logo size={compact ? 23 : 28} />
        <Text style={[styles.title, compact && styles.titleCompact, { color: theme.text }]} numberOfLines={1}>Bumi</Text>
        {badge && badgeStyle && (
          <View style={[styles.badge, { backgroundColor: badgeStyle.bg, borderColor: badgeStyle.border }]}>
            <Text style={[styles.badgeText, { color: badgeStyle.fg }]}>{t(badge.labelKey)}</Text>
          </View>
        )}
      </Pressable>

      <View style={styles.actions}>
        {/* Fixed game chrome: the level meta gets a measured slot beside the buttons and
            shrinks its own type to fit it, so it never steals width from the board. */}
        <View style={[styles.levelMeta, { width: levelWidth }]}>
          <Text style={[styles.levelNum, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{levelLabel}</Text>
          <Text style={[styles.levelDiff, { color: theme.sub }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{diffLabel}</Text>
        </View>
        {onLevels && (
          <Pressable accessibilityRole="button" style={[styles.iconButton, { borderColor: theme.gridSep }]} hitSlop={ICON_BUTTON_HIT_SLOP} onPress={onLevels} accessibilityLabel={t('a11y.openLevels')}>
            <Map size={18} color={theme.text} strokeWidth={2.2} />
          </Pressable>
        )}
        {onShare && (
          <Pressable accessibilityRole="button" style={[styles.iconButton, { borderColor: theme.gridSep }]} hitSlop={ICON_BUTTON_HIT_SLOP} onPress={onShare} accessibilityLabel={t('a11y.shareChallenge')}>
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
  // Icon-only, so nothing inside it scales with the text size.
  iconButton: { width: ICON_BUTTON_SIZE, height: ICON_BUTTON_SIZE, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: 8 },
  brand: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: BRAND_MIN_HEIGHT },
  // A wordmark cannot wrap, so it yields width (and only then truncates) before the mode badge does.
  title: { flexShrink: 1, minWidth: 0, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  titleCompact: { fontSize: 20 },
  badge: { flexShrink: 1, minWidth: 0, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: ACTION_GAP, marginLeft: 6, flexShrink: 0 },
  levelMeta: { alignItems: 'flex-end', minWidth: 0 },
  levelNum: { fontSize: 16, fontWeight: '700' },
  levelDiff: { fontSize: 10, alignSelf: 'stretch', textAlign: 'right' },
});
