import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Flag from 'lucide-react-native/icons/flag';
import Flame from 'lucide-react-native/icons/flame';
import MapPinned from 'lucide-react-native/icons/map-pinned';
import Medal from 'lucide-react-native/icons/medal';
import Mountain from 'lucide-react-native/icons/mountain';
import Route from 'lucide-react-native/icons/route';
import Trophy from 'lucide-react-native/icons/trophy';
import Zap from 'lucide-react-native/icons/zap';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { getAchievements, type AchievementProgress } from '@/game/achievements';
import { useProgressStore } from '@/state/progressStore';
import { useSemanticTokens, useThemeTokens } from '@/state/themeStore';
import { hitSlopFor } from '@/lib/touchTarget';
import { useI18n } from '@/i18n';

const BACK_BUTTON_SIZE = 36;
const BACK_BUTTON_HIT_SLOP = hitSlopFor({ width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE });

export interface AchievementsSheetHandle {
  present: () => void;
}

function AchievementIcon({ achievement, color }: { achievement: AchievementProgress; color: string }) {
  const props = { size: 19, color, strokeWidth: 2.3 };
  switch (achievement.icon) {
    case 'flag': return <Flag {...props} />;
    case 'zap': return <Zap {...props} />;
    case 'route': return <Route {...props} />;
    case 'mountain': return <Mountain {...props} />;
    case 'map': return <MapPinned {...props} />;
    case 'medal': return <Medal {...props} />;
    case 'flame': return <Flame {...props} />;
    default: return <Trophy {...props} />;
  }
}

export const AchievementsSheet = forwardRef<AchievementsSheetHandle>(function AchievementsSheet(_, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const theme = useThemeTokens();
  const semantic = useSemanticTokens();
  const { t } = useI18n();
  const solvedMap = useProgressStore(state => state.solvedMap);
  const solvedDateMap = useProgressStore(state => state.solvedDateMap);
  const levelMedals = useProgressStore(state => state.levelMedals);
  const dailyStreak = useProgressStore(state => state.dailyStreak);
  const achievements = useMemo(
    () => getAchievements({ solvedMap, solvedDateMap, levelMedals, dailyStreak: dailyStreak() }),
    [dailyStreak, levelMedals, solvedDateMap, solvedMap],
  );
  const unlockedCount = achievements.filter(achievement => achievement.current >= achievement.target).length;

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
  }));

  // Dismissing is enough: the provider restores the settings sheet underneath.
  function goBack() {
    sheetRef.current?.dismiss();
  }

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['82%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: theme.bg }}
      handleIndicatorStyle={{ backgroundColor: theme.gridSep }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <AnimatedPressable accessibilityRole="button" feedback="icon" style={[styles.backButton, { borderColor: theme.gridSep }]} hitSlop={BACK_BUTTON_HIT_SLOP} onPress={goBack} accessibilityLabel={t('a11y.backToSettings')}>
            <ArrowLeft size={18} color={theme.text} strokeWidth={2.3} />
          </AnimatedPressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: theme.text }]}>{t('achievements.title')}</Text>
            <Text style={[styles.subtitle, { color: theme.sub }]}>{t('achievements.subtitle', { done: unlockedCount, total: achievements.length })}</Text>
          </View>
          <View style={[styles.count, { backgroundColor: theme.surface, borderColor: theme.gridSep }]}>
            <Trophy size={18} color={semantic.gold} strokeWidth={2.4} />
            <Text style={[styles.countText, { color: theme.text }]}>{unlockedCount}</Text>
          </View>
        </View>

        {(['campaign', 'islands', 'mastery'] as const).map(category => (
          <View key={category} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.sub }]}>{t(`achievement.category.${category}`)}</Text>
            {achievements.filter(achievement => achievement.category === category).map(achievement => {
              const complete = achievement.current >= achievement.target;
              const progress = Math.min(achievement.current / achievement.target, 1);
              const accent = complete ? semantic.success : theme.accent;
              return (
                <View key={achievement.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: complete ? semantic.successBorder : theme.gridSep }]}>
                  <View style={[styles.icon, { backgroundColor: complete ? semantic.successSurface : `${theme.accent}18` }]}>
                    <AchievementIcon achievement={achievement} color={accent} />
                  </View>
                  <View style={styles.copy}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>{t(`achievement.${achievement.id}.title`)}</Text>
                      <Text style={[styles.progressLabel, { color: complete ? semantic.success : theme.sub }]}>{Math.min(achievement.current, achievement.target)} / {achievement.target}</Text>
                    </View>
                    <Text style={[styles.description, { color: theme.sub }]}>{t(`achievement.${achievement.id}.description`)}</Text>
                    <View style={[styles.bar, { backgroundColor: theme.gridSep }]}>
                      <View style={[styles.barFill, { width: `${progress * 100}%`, backgroundColor: accent }]} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 22, gap: 10 },
  // Painted at 36 beside a 22pt title; hitSlop, not size, takes the tap area to 44.
  backButton: { width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE, borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  count: { flexShrink: 0, minWidth: 54, minHeight: 38, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
  countText: { fontSize: 14, fontWeight: '800' },
  section: { gap: 8, marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 1 },
  card: { borderWidth: 1.5, borderRadius: 8, padding: 11, flexDirection: 'row', gap: 11 },
  icon: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '800' },
  progressLabel: { flexShrink: 0, fontSize: 11, fontWeight: '800' },
  description: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  bar: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  barFill: { height: '100%', borderRadius: 3 },
});
