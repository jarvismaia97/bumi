import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Lock from 'lucide-react-native/icons/lock';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import type { IslandProgress } from '@/game/islands';
import { useThemeTokens } from '@/state/themeStore';
import { useI18n } from '@/i18n';

const DOT = 34;
const DOT_GAP = 6;

/**
 * The campaign as the thirteen islands it actually is. All of this was already written — a
 * name, a colour and a line of prose per island, in three languages — and none of it reached
 * a player who had not opened the level map from inside a level, which is the one place the
 * map used to live. The strip is the path; the card under it is where the player is standing.
 */
export function IslandJourney({ islands, currentIndex, onOpenMap }: {
  islands: IslandProgress[];
  currentIndex: number;
  onOpenMap: () => void;
}) {
  const theme = useThemeTokens();
  const { t } = useI18n();
  const scrollRef = useRef<ScrollView>(null);
  const current = islands[currentIndex];
  // A conquered island is a place the player has already been. The strip is what is left of
  // the path, so it drops them and keeps the road ahead; the count above still says how many
  // of the thirteen are done.
  const ahead = islands.filter(island => !island.complete);
  const currentPosition = ahead.findIndex(island => island.current);

  // The path runs past the edge of the screen, so it arrives showing where the player is
  // rather than where they started.
  useEffect(() => {
    const offset = Math.max(0, currentPosition * (DOT + DOT_GAP) - DOT * 2);
    scrollRef.current?.scrollTo({ x: offset, animated: false });
  }, [currentPosition]);

  if (!current) return null;

  return (
    <View style={styles.wrap}>
      {/* Nothing left to walk means the campaign is finished; the card below says so on its
          own, and an empty strip would be a row of nothing. */}
      {ahead.length > 0 && (
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {ahead.map(island => (
          <AnimatedPressable
            key={island.id}
            accessibilityRole="button"
            feedback="icon"
            onPress={onOpenMap}
            accessibilityLabel={t('journey.islandLabel', {
              name: t(`island.${island.id}.name`),
              solved: island.solved,
              total: island.total,
            })}
            style={[
              styles.dot,
              { backgroundColor: island.reached ? island.bg : theme.surface, borderColor: island.reached ? island.color : theme.gridSep },
              island.current && styles.dotCurrent,
              island.current && { borderColor: island.color },
            ]}
          >
            {/* Colour and the ring say which island this is and where the player stands. The
                count used to sit here and read as a level number next to "continue at level
                368"; the card below already states it, in words that cannot be misread. */}
            {!island.reached && <Lock size={13} color={theme.sub} strokeWidth={2.4} />}
          </AnimatedPressable>
        ))}
      </ScrollView>
      )}

      <AnimatedPressable
        accessibilityRole="button"
        style={[styles.card, { backgroundColor: theme.surface, borderColor: current.color }]}
        onPress={onOpenMap}
      >
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, { color: current.color }]} numberOfLines={1}>
            {t(`island.${current.id}.name`)}
          </Text>
          <Text style={[styles.cardCount, { color: theme.sub }]}>
            {t('journey.islandProgress', { solved: current.solved, total: current.total })}
          </Text>
        </View>
        {/* The line of prose is the reason the island has a name at all. */}
        <Text style={[styles.cardStory, { color: theme.sub }]} numberOfLines={2}>
          {t(`island.${current.id}.story`)}
        </Text>
        <View style={[styles.bar, { backgroundColor: theme.gridSep }]}>
          <View
            style={[
              styles.barFill,
              { width: `${current.total ? (current.solved / current.total) * 100 : 0}%`, backgroundColor: current.color },
            ]}
          />
        </View>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 320, gap: 8 },
  strip: { gap: DOT_GAP, paddingVertical: 2 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dotCurrent: { borderWidth: 3 },
  card: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flexShrink: 1, minWidth: 0, fontSize: 14, fontWeight: '800' },
  cardCount: { flexShrink: 0, fontSize: 10, fontWeight: '700' },
  cardStory: { fontSize: 11, lineHeight: 15, fontStyle: 'italic', marginTop: 4 },
  bar: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  barFill: { height: '100%', borderRadius: 3 },
});
