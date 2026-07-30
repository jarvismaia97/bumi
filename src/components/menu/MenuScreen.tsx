import { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import Check from 'lucide-react-native/icons/check';
import Flame from 'lucide-react-native/icons/flame';
import MapPinned from 'lucide-react-native/icons/map-pinned';
import Settings from 'lucide-react-native/icons/settings';
import Trophy from 'lucide-react-native/icons/trophy';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { GoogleMark } from '@/components/GoogleMark';
import { BrandMark } from '@/components/BrandMark';
import { PlayerAvatarTile } from '@/components/PlayerAvatar';
import { playerName } from '@/lib/identity';
import { ThemePickerSheet, type ThemePickerSheetHandle } from '@/components/overlays/ThemePickerSheet';
import { SettingsSheet, type SettingsSheetHandle } from '@/components/overlays/SettingsSheet';
import { AchievementsSheet, type AchievementsSheetHandle } from '@/components/overlays/AchievementsSheet';
import { PrivacySheet, type PrivacySheetHandle } from '@/components/overlays/PrivacySheet';
import { LanguageSheet, type LanguageSheetHandle } from '@/components/overlays/LanguageSheet';
import { LeaderboardSheet, type LeaderboardSheetHandle } from '@/components/overlays/LeaderboardSheet';
import { DailyArchiveSheet, type DailyArchiveSheetHandle } from '@/components/overlays/DailyArchiveSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/state/authStore';
import { useSemanticTokens, useThemeTokens } from '@/state/themeStore';
import { useI18n } from '@/i18n';
import { MONTHLY_REWARD_HINTS, WEEKLY_REWARD_HINTS, type GoalProgress } from '@/game/goals';

interface MenuScreenProps {
  dailyDone: boolean;
  dailyStreak: number;
  weekly: GoalProgress;
  monthly: GoalProgress;
  solvedCount: number;
  goldMedalCount: number;
  completedIslandCount: number;
  islandTotal: number;
  campaignLevel: number;
  campaignTotal: number;
  campaignComplete: boolean;
  onStartGame: () => void;
  onStartDaily: () => void;
  onStartDailyFor: (dateKey: string) => void;
}

function AuthPill({ onOpenSettings }: { onOpenSettings: () => void }) {
  const theme = useThemeTokens();
  const { t, language } = useI18n();
  const user = useAuthStore(s => s.user);
  const loading = useAuthStore(s => s.loading);
  const signInWithGoogle = useAuthStore(s => s.signInWithGoogle);

  if (loading) return null;

  if (!user) {
    return (
      <AnimatedPressable accessibilityRole="button" feedback="control" style={[styles.authPill, { borderColor: theme.gridSep }]} onPress={() => signInWithGoogle().catch(() => {})}>
        <GoogleMark size={16} />
        <Text style={[styles.authPillText, { color: theme.text }]}>{t('auth.signInGoogle')}</Text>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable accessibilityRole="button" style={[styles.accountButton, { backgroundColor: theme.surface, borderColor: theme.gridSep }]} onPress={onOpenSettings} accessibilityLabel={t('menu.settings')}>
      <PlayerAvatarTile userId={user.id} size={38} />
      <View style={styles.accountCopy}>
        <Text style={[styles.accountName, { color: theme.text }]}>{playerName(user.id, language)}</Text>
        <Text style={[styles.accountDetail, { color: theme.sub }]}>{t('menu.settings')}</Text>
      </View>
      <Settings size={20} color={theme.sub} strokeWidth={2.2} />
    </AnimatedPressable>
  );
}

/** Both goals read the same, because they are the same promise at two cadences. */
function GoalCard({ title, goal, reward, doneLabel, accent }: { title: string; goal: GoalProgress; reward: number; doneLabel: string; accent: string }) {
  const theme = useThemeTokens();
  const { t } = useI18n();
  const filled = Math.min(goal.done / goal.target, 1);
  const remaining = Math.max(goal.target - goal.done, 0);

  return (
    <View style={[styles.goalCard, { backgroundColor: theme.surface, borderColor: goal.complete ? accent : theme.gridSep }]}>
      <View style={styles.goalTitleRow}>
        <Flame size={15} color={accent} strokeWidth={2.3} />
        <Text style={[styles.goalTitle, { color: theme.text }]}>{title}</Text>
      </View>
      {/* Half-width leaves no room for a count beside the title, so the card stacks like the
          stat tiles above it: number first, then the detail underneath. */}
      <Text style={[styles.goalCount, { color: theme.text }]}>{Math.min(goal.done, goal.target)} / {goal.target}</Text>
      <View style={[styles.goalBar, { backgroundColor: theme.gridSep }]}>
        <View style={[styles.goalBarFill, { width: `${filled * 100}%`, backgroundColor: accent }]} />
      </View>
      <Text style={[styles.goalDetail, { color: theme.sub }]}>
        {goal.complete
          ? doneLabel
          : t('menu.remainingDaily', { count: remaining, label: t(remaining === 1 ? 'menu.dailyChallenge' : 'menu.dailyChallenges') })}
      </Text>
      {/* The reward is the point of the goal, so it is stated up front rather than on arrival. */}
      {!goal.complete && (
        <Text style={[styles.goalReward, { color: accent }]}>
          {t('menu.goalReward', { count: reward, label: t(reward === 1 ? 'menu.hintOne' : 'menu.hintMany') })}
        </Text>
      )}
    </View>
  );
}

export function MenuScreen({
  dailyDone,
  dailyStreak,
  weekly,
  monthly,
  solvedCount,
  goldMedalCount,
  completedIslandCount,
  islandTotal,
  campaignLevel,
  campaignTotal,
  campaignComplete,
  onStartGame,
  onStartDaily,
  onStartDailyFor,
}: MenuScreenProps) {
  const theme = useThemeTokens();
  const semantic = useSemanticTokens();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const themePickerRef = useRef<ThemePickerSheetHandle>(null);
  const settingsRef = useRef<SettingsSheetHandle>(null);
  const achievementsRef = useRef<AchievementsSheetHandle>(null);
  const privacyRef = useRef<PrivacySheetHandle>(null);
  const languageRef = useRef<LanguageSheetHandle>(null);
  const leaderboardRef = useRef<LeaderboardSheetHandle>(null);
  const archiveRef = useRef<DailyArchiveSheetHandle>(null);

  const daily = dailyDone
    ? { fg: semantic.success, bg: semantic.successSurface, border: semantic.successBorder }
    : { fg: semantic.warning, bg: semantic.warningSurface, border: semantic.warningBorder };

  return (
    <>
      <ScrollView
        style={[styles.screen, { backgroundColor: theme.bg }]}
        contentContainerStyle={[styles.container, { paddingTop: Math.max(32, insets.top + 16), paddingBottom: Math.max(32, insets.bottom + 20) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <View style={styles.brandBlock}>
            <BrandMark size={48} assemble />
            <Text style={[styles.title, { color: theme.text }]}>Bumi</Text>
          </View>
        </View>

      <View style={styles.statsRow}>
        <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.gridSep }]}>
          <Text style={[styles.statValue, { color: theme.text }]}>{solvedCount}</Text>
          <Text style={[styles.statLabel, { color: theme.sub }]}>{t('menu.solved')}</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.gridSep }]}>
          <Trophy size={17} color={semantic.gold} strokeWidth={2.3} />
          <Text style={[styles.statValue, { color: theme.text }]}>{goldMedalCount}</Text>
          <Text style={[styles.statLabel, { color: theme.sub }]}>{t('menu.gold')}</Text>
        </View>
      </View>

      <View style={styles.islandProgress}>
        <MapPinned size={15} color={theme.accent} strokeWidth={2.3} />
        <Text style={[styles.islandProgressText, { color: theme.sub }]}>{t('menu.islands', { completed: completedIslandCount, total: islandTotal })}</Text>
      </View>

      <View style={styles.goalsRow}>
        <GoalCard
          title={t('menu.weeklyGoal')}
          goal={weekly}
          reward={WEEKLY_REWARD_HINTS}
          doneLabel={t('menu.weeklyDone')}
          accent={semantic.streak}
        />
        <GoalCard
          title={t('menu.monthlyGoal')}
          goal={monthly}
          reward={MONTHLY_REWARD_HINTS}
          doneLabel={t('menu.monthlyDone')}
          accent={theme.accent}
        />
      </View>

      <View style={styles.menuBtns}>
        <AnimatedPressable accessibilityRole="button" style={[styles.playBtn, { backgroundColor: theme.accent }]} onPress={onStartGame}>
          <View style={styles.campaignCopy}>
            <Text style={styles.campaignLabel}>{t('menu.campaign')}</Text>
            <Text style={styles.playBtnText}>{campaignComplete ? t('menu.playAgain') : solvedCount === 0 ? t('menu.startCampaign') : t('menu.continueLevel', { level: campaignLevel })}</Text>
            <Text style={styles.campaignDetail}>{campaignComplete ? t('menu.levelsComplete', { count: campaignTotal }) : t('menu.levelsExplore', { count: campaignTotal - campaignLevel + 1 })}</Text>
          </View>
          <ArrowRight size={20} color="#fff" strokeWidth={2.4} />
        </AnimatedPressable>

        <AnimatedPressable accessibilityRole="button" style={[styles.dailyBtn, { backgroundColor: daily.bg, borderColor: daily.border }]} onPress={onStartDaily}>
          <View style={styles.dailyTitleRow}>
            {dailyDone && <Check size={16} color={daily.fg} strokeWidth={2.8} />}
            <Text style={[styles.dailyBtnText, { color: daily.fg }]}>{dailyDone ? t('menu.dailyDone') : t('menu.daily')}</Text>
          </View>
          <Text style={[styles.dailyStreak, { color: daily.fg }]}>
            {dailyStreak ? t('menu.streak', { count: dailyStreak, label: t(dailyStreak === 1 ? 'menu.day' : 'menu.days') }) : t('menu.startStreak')}
          </Text>
        </AnimatedPressable>
      </View>

        <AuthPill onOpenSettings={() => settingsRef.current?.present()} />
      </ScrollView>
      <ThemePickerSheet ref={themePickerRef} />
      <SettingsSheet
        ref={settingsRef}
        onOpenAchievements={() => achievementsRef.current?.present()}
        onOpenThemes={() => themePickerRef.current?.present()}
        onOpenPrivacy={() => privacyRef.current?.present()}
        onOpenLanguage={() => languageRef.current?.present()}
        onOpenLeaderboard={() => leaderboardRef.current?.present()}
        onOpenArchive={() => archiveRef.current?.present()}
      />
      <AchievementsSheet ref={achievementsRef} />
      <PrivacySheet ref={privacyRef} />
      <LanguageSheet ref={languageRef} />
      <LeaderboardSheet ref={leaderboardRef} />
      <DailyArchiveSheet ref={archiveRef} onSelectDay={onStartDailyFor} />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 32 },
  brandRow: { width: '100%', maxWidth: 320, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  brandBlock: { alignItems: 'center', gap: 4 },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  statsRow: { flexDirection: 'row', width: '100%', maxWidth: 320, gap: 8 },
  stat: { flex: 1, minHeight: 70, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', marginTop: 1 },
  statLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  islandProgress: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 20 },
  islandProgressText: { flexShrink: 1, minWidth: 0, fontSize: 12, fontWeight: '700' },
  goalsRow: { flexDirection: 'row', alignItems: 'stretch', width: '100%', maxWidth: 320, gap: 8 },
  goalCard: { flex: 1, minWidth: 0, borderWidth: 1.5, borderRadius: 8, padding: 12 },
  goalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  goalTitle: { flexShrink: 1, minWidth: 0, fontSize: 12, fontWeight: '700' },
  goalCount: { fontSize: 18, fontWeight: '800', marginTop: 5 },
  goalBar: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 7 },
  goalBarFill: { height: '100%', borderRadius: 3 },
  goalDetail: { fontSize: 10, marginTop: 7 },
  goalReward: { fontSize: 10, fontWeight: '800', marginTop: 3 },
  menuBtns: { gap: 8, width: '100%', maxWidth: 320 },
  playBtn: { borderRadius: 8, paddingVertical: 13, paddingHorizontal: 15, alignItems: 'center', flexDirection: 'row', gap: 8 },
  campaignCopy: { flex: 1 },
  campaignLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: 'rgba(255,255,255,0.72)' },
  playBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 2 },
  campaignDetail: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  dailyBtn: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  dailyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dailyBtnText: { flexShrink: 1, minWidth: 0, fontSize: 15, fontWeight: '700' },
  dailyStreak: { fontSize: 11, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  authPill: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14, marginTop: 6, maxWidth: 260 },
  authPillText: { flexShrink: 1, minWidth: 0, fontSize: 12, fontWeight: '600' },
  // The player name wraps freely, so the pill grows past 58 instead of clipping it.
  accountButton: { width: '100%', maxWidth: 320, minHeight: 58, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  accountCopy: { flex: 1, minWidth: 0, marginLeft: 12, marginRight: 12 },
  accountName: { fontSize: 14, fontWeight: '800' },
  accountDetail: { fontSize: 11, fontWeight: '600', marginTop: 3 },
});
