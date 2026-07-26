import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Flag from 'lucide-react-native/icons/flag';
import Flame from 'lucide-react-native/icons/flame';
import MapPinned from 'lucide-react-native/icons/map-pinned';
import Medal from 'lucide-react-native/icons/medal';
import Mountain from 'lucide-react-native/icons/mountain';
import Route from 'lucide-react-native/icons/route';
import Trophy from 'lucide-react-native/icons/trophy';
import Zap from 'lucide-react-native/icons/zap';
import { getAchievements, type AchievementProgress } from '@/game/achievements';
import { useProgressStore } from '@/state/progressStore';
import { useThemeTokens } from '@/state/themeStore';

export interface AchievementsSheetHandle {
  present: () => void;
}

interface AchievementsSheetProps {
  onBack: () => void;
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

export const AchievementsSheet = forwardRef<AchievementsSheetHandle, AchievementsSheetProps>(function AchievementsSheet({ onBack }, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const theme = useThemeTokens();
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

  function goBack() {
    sheetRef.current?.dismiss();
    setTimeout(onBack, 180);
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
          <Pressable style={[styles.backButton, { borderColor: theme.gridSep }]} onPress={goBack} accessibilityLabel="Voltar a definições">
            <ArrowLeft size={18} color={theme.text} strokeWidth={2.3} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: theme.text }]}>Conquistas</Text>
            <Text style={[styles.subtitle, { color: theme.sub }]}>{unlockedCount} de {achievements.length} concluídas</Text>
          </View>
          <View style={[styles.count, { backgroundColor: theme.surface, borderColor: theme.gridSep }]}>
            <Trophy size={18} color="#d6a72f" strokeWidth={2.4} />
            <Text style={[styles.countText, { color: theme.text }]}>{unlockedCount}</Text>
          </View>
        </View>

        {(['Campanha', 'Ilhas', 'Domínio'] as const).map(category => (
          <View key={category} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.sub }]}>{category}</Text>
            {achievements.filter(achievement => achievement.category === category).map(achievement => {
              const complete = achievement.current >= achievement.target;
              const progress = Math.min(achievement.current / achievement.target, 1);
              const accent = complete ? '#3d9b67' : theme.accent;
              return (
                <View key={achievement.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: complete ? '#94d1aa' : theme.gridSep }]}>
                  <View style={[styles.icon, { backgroundColor: complete ? '#e8f5ee' : `${theme.accent}18` }]}>
                    <AchievementIcon achievement={achievement} color={accent} />
                  </View>
                  <View style={styles.copy}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>{achievement.title}</Text>
                      <Text style={[styles.progressLabel, { color: complete ? '#2e8a50' : theme.sub }]}>{Math.min(achievement.current, achievement.target)} / {achievement.target}</Text>
                    </View>
                    <Text style={[styles.description, { color: theme.sub }]}>{achievement.description}</Text>
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
  backButton: { width: 36, height: 36, borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  count: { minWidth: 54, height: 38, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
  countText: { fontSize: 14, fontWeight: '800' },
  section: { gap: 8, marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 1 },
  card: { borderWidth: 1.5, borderRadius: 8, padding: 11, flexDirection: 'row', gap: 11 },
  icon: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '800' },
  progressLabel: { fontSize: 11, fontWeight: '800' },
  description: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  bar: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  barFill: { height: '100%', borderRadius: 3 },
});
