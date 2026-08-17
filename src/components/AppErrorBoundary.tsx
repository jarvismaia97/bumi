import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Logo } from '@/components/Logo';
import { useThemeTokens } from '@/state/themeStore';
import { useGameStore } from '@/state/gameStore';
import { useUIStore } from '@/state/uiStore';
import { useI18n } from '@/i18n';
import { reportError } from '@/lib/observability';

/**
 * What a render that throws looks like. Expo Router calls this with the error and a way to try
 * the route again; without it the screen simply goes white and the only way out is to kill the
 * app — which, on a game that stores its progress locally, reads as having lost it.
 *
 * Going back to the menu is offered first because it is the one that almost always works: the
 * board is what has state complicated enough to break, and leaving it drops that state.
 */
export function AppErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  const theme = useThemeTokens();
  const { t } = useI18n();

  // Reported from here rather than from a handler higher up, because this component is the
  // only place that knows the render actually failed — Expo Router catches the throw and calls
  // it, so nothing above ever sees the error. Keyed on the error so a re-render of the same
  // failure does not send it twice, while a genuinely different one still gets through.
  useEffect(() => {
    reportError(error, 'render', { screen: 'root' });
  }, [error]);

  function backToMenu() {
    // Dropping the level is the point: whatever the board was holding is what threw.
    useGameStore.setState({ level: null, placed: [], colorN: 0, won: false });
    useUIStore.getState().goToMenu();
    retry().catch(() => {});
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <Logo size={52} />
      <Text style={[styles.title, { color: theme.text }]}>{t('error.title')}</Text>
      <Text style={[styles.body, { color: theme.sub }]}>{t('error.body')}</Text>

      <AnimatedPressable accessibilityRole="button" style={[styles.primary, { backgroundColor: theme.accent }]} onPress={backToMenu}>
        <Text style={[styles.primaryText, { color: theme.onAccent }]}>{t('error.backToMenu')}</Text>
      </AnimatedPressable>
      <AnimatedPressable
        accessibilityRole="button"
        feedback="control"
        style={[styles.secondary, { borderColor: theme.gridSep }]}
        onPress={() => retry().catch(() => {})}
      >
        <Text style={[styles.secondaryText, { color: theme.text }]}>{t('error.retry')}</Text>
      </AnimatedPressable>

      {/* Shown small rather than hidden: a player reporting a bug can read it out. */}
      <Text style={[styles.detail, { color: theme.sub }]} numberOfLines={3}>{error.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  title: { fontSize: 20, fontWeight: '800', marginTop: 14 },
  body: { fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 320 },
  primary: { minWidth: 200, borderRadius: 8, paddingVertical: 13, alignItems: 'center', marginTop: 14 },
  primaryText: { fontSize: 15, fontWeight: '700' },
  secondary: { minWidth: 200, borderWidth: 1.5, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  secondaryText: { fontSize: 14, fontWeight: '700' },
  detail: { fontSize: 10, textAlign: 'center', marginTop: 18, opacity: 0.7 },
});
