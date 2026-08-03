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
 * What is left of the path: one dot per island still to finish, each showing how far into it
 * the player is, locked where they have not reached. The island they are standing on is the
 * one at the front, and its name and progress ride on the campaign button below rather than
 * in a card of their own — the prose lives in the level map, which any of these dots opens.
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
            ]}
          >
            {/* How much of the island is done, as a share of itself. A count of solved levels
                sat here before and read as a level number beside "continue at level 368".
                Which one is current needs no ring: conquered islands are gone from the strip,
                so the island the player is standing on is the one at the front. */}
            {island.reached ? (
              <Text style={[styles.dotText, { color: island.color }]}>
                {island.total ? Math.round((island.solved / island.total) * 100) : 0}%
              </Text>
            ) : (
              <Lock size={13} color={theme.sub} strokeWidth={2.4} />
            )}
          </AnimatedPressable>
        ))}
      </ScrollView>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 320, gap: 8 },
  strip: { gap: DOT_GAP, paddingVertical: 2 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dotText: { fontSize: 10, fontWeight: '800' },
});
