import { useRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import Check from 'lucide-react-native/icons/check';
import Flame from 'lucide-react-native/icons/flame';
import Map from 'lucide-react-native/icons/map';
import MapPinned from 'lucide-react-native/icons/map-pinned';
import Settings from 'lucide-react-native/icons/settings';
import Trophy from 'lucide-react-native/icons/trophy';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { GoogleMark } from '@/components/GoogleMark';
import { BrandMark } from '@/components/BrandMark';
import { PlayerAvatarTile } from '@/components/PlayerAvatar';
import { playerName } from '@/lib/identity';
import { useAppleSignInAvailable } from '@/lib/appleSignIn';
import { MIN_TOUCH_TARGET } from '@/lib/touchTarget';
import { ThemePickerSheet, type ThemePickerSheetHandle } from '@/components/overlays/ThemePickerSheet';
import { SettingsSheet, type SettingsSheetHandle } from '@/components/overlays/SettingsSheet';
import { AchievementsSheet, type AchievementsSheetHandle } from '@/components/overlays/AchievementsSheet';
import { PrivacySheet, type PrivacySheetHandle } from '@/components/overlays/PrivacySheet';
import { LanguageSheet, type LanguageSheetHandle } from '@/components/overlays/LanguageSheet';
import { LeaderboardSheet, type LeaderboardSheetHandle } from '@/components/overlays/LeaderboardSheet';
import { DailyArchiveSheet, type DailyArchiveSheetHandle } from '@/components/overlays/DailyArchiveSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppearance } from '@/state/appearanceStore';
import { useAuthStore } from '@/state/authStore';
import { useSemanticTokens, useThemeTokens } from '@/state/themeStore';
import { useI18n } from '@/i18n';
import { MONTHLY_REWARD_HINTS, WEEKLY_REWARD_HINTS, type GoalProgress } from '@/game/goals';
import type { IslandProgress } from '@/game/islands';

interface MenuScreenProps {
  dailyDone: boolean;
  dailyStreak: number;
  weekly: GoalProgress;
  monthly: GoalProgress;
  solvedCount: number;
  goldMedalCount: number;
  completedIslandCount: number;
  islandTotal: number;
  journey: { islands: IslandProgress[]; currentIndex: number };
  onOpenMap: () => void;
  campaignLevel: number;
  campaignTotal: number;
  campaignComplete: boolean;
  onStartGame: () => void;
  onStartDaily: () => void;
  onStartDailyFor: (dateKey: string) => void;
}

// The two providers are offered as one pair, so they are one box: Apple's button takes a frame
// rather than styles, and this is the only thing both of them can be told.
const AUTH_BUTTON_WIDTH = 240;
const AUTH_BUTTON_HEIGHT = MIN_TOUCH_TARGET;

function AuthPill({ onOpenSettings }: { onOpenSettings: () => void }) {
  const theme = useThemeTokens();
  const { t, language } = useI18n();
  const user = useAuthStore(s => s.user);
  const loading = useAuthStore(s => s.loading);
  const signInWithGoogle = useAuthStore(s => s.signInWithGoogle);
  const signInWithApple = useAuthStore(s => s.signInWithApple);
  const appleAvailable = useAppleSignInAvailable();
  const authError = useAuthStore(s => s.error);
  const semantic = useSemanticTokens();
  // Apple's own button ships two fixed colourways, so the one that reads is picked by
  // appearance rather than by the theme's tokens, which it will not take.
  const appearance = useAppearance();

  if (loading) return null;

  if (!user) {
    // Both providers belong here, not just the one. `login.tsx` offers the pair, but nothing
    // routes to it except the campaign gate in `index.tsx` — so a player who never hits a level
    // that demands an account only ever sees what this renders. Apple asks that its button sit
    // wherever another provider's does, and a player who wants neither still just walks past.
    return (
      <View style={styles.authChoices}>
        <AnimatedPressable accessibilityRole="button" feedback="control" style={[styles.authPill, { borderColor: theme.gridSep }]} onPress={() => signInWithGoogle().catch(() => {})}>
          <GoogleMark size={16} />
          <Text style={[styles.authPillText, { color: theme.text }]}>{t('auth.signInGoogle')}</Text>
        </AnimatedPressable>
        {appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              appearance === 'dark'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={AUTH_BUTTON_HEIGHT / 2}
            style={styles.authApplePill}
            onPress={() => signInWithApple().catch(() => {})}
          />
        ) : null}
        {/* Both handlers swallow what they throw, because a dismissed provider sheet throws the
            same way a real failure does and nobody wants to be told off for changing their mind.
            The server's verdict is different: it only ever means the sign-in did not happen, and
            without this the tap did nothing and said nothing about why. */}
        {authError ? <Text style={[styles.authError, { color: semantic.danger }]}>{authError}</Text> : null}
      </View>
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

/**
 * The counters are built out of the goal card's parts, because they are the same kind of fact
 * and were being told differently: a bare number over a caption, with the trophy floating above
 * it and nothing at all above the levels. Named title, then the count, then how far along.
 *
 * Both are going somewhere, so both draw a bar. Medals are awarded per campaign level and only
 * from the campaign — `setLevelMedal` is keyed by the level and the daily never calls it — so
 * they share the levels' denominator, and the pair reads as the distance between solving a level
 * and solving it well.
 */
function StatCard({ icon, title, value, progress, accent }: { icon: ReactNode; title: string; value: string; progress: number; accent: string }) {
  const theme = useThemeTokens();

  return (
    <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.gridSep }]}>
      <View style={styles.goalTitleRow}>
        {icon}
        <Text style={[styles.goalTitle, { color: theme.text }]} numberOfLines={1}>{title}</Text>
      </View>
      <View style={styles.goalCountRow}>
        <Text style={[styles.goalCount, { color: theme.text }]}>{value}</Text>
      </View>
      <View style={[styles.goalBar, { backgroundColor: theme.gridSep }]}>
        <View style={[styles.goalBarFill, { width: `${Math.min(progress, 1) * 100}%`, backgroundColor: accent }]} />
      </View>
    </View>
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
      {/* The reward reads as a consequence of the count, so it sits beside it rather than on a
          line of its own at the bottom, where it was a fourth row saying something about the
          first. */}
      <View style={styles.goalCountRow}>
        <Text style={[styles.goalCount, { color: theme.text }]}>{Math.min(goal.done, goal.target)} / {goal.target}</Text>
        {!goal.complete && (
          <Text style={[styles.goalReward, { color: accent }]} numberOfLines={1}>
            {t('menu.goalReward', { count: reward, label: t(reward === 1 ? 'menu.hintOne' : 'menu.hintMany') })}
          </Text>
        )}
      </View>
      <View style={[styles.goalBar, { backgroundColor: theme.gridSep }]}>
        <View style={[styles.goalBarFill, { width: `${filled * 100}%`, backgroundColor: accent }]} />
      </View>
      <Text style={[styles.goalDetail, { color: theme.sub }]}>
        {goal.complete
          ? doneLabel
          : t('menu.remainingDaily', { count: remaining, label: t(remaining === 1 ? 'menu.dailyChallenge' : 'menu.dailyChallenges') })}
      </Text>
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
  journey,
  onOpenMap,
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

  const hasPlayedDaily = dailyDone || weekly.done > 0 || monthly.done > 0 || dailyStreak > 0;
  const currentIsland = journey.islands[journey.currentIndex];
  const islandShare = currentIsland?.total ? Math.round((currentIsland.solved / currentIsland.total) * 100) : 0;

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

      {/* A counter is worth screen only once it has counted something. A new player used to
          meet five zeros before touching the game — and that is the screen the App Store
          listing shows to someone deciding whether to install. */}
      {solvedCount > 0 && (
        <View style={styles.statsRow}>
          <StatCard
            icon={<Map size={15} color={theme.accent} strokeWidth={2.3} />}
            title={t('menu.solved')}
            value={`${solvedCount} / ${campaignTotal}`}
            progress={solvedCount / campaignTotal}
            accent={theme.accent}
          />
          {goldMedalCount > 0 && (
            <StatCard
              icon={<Trophy size={15} color={semantic.gold} strokeWidth={2.3} />}
              title={t('menu.gold')}
              value={`${goldMedalCount} / ${campaignTotal}`}
              progress={goldMedalCount / campaignTotal}
              accent={semantic.gold}
            />
          )}
        </View>
      )}


      {/* The goals are about daily challenges, so they arrive with the first one played. */}
      {hasPlayedDaily && (
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
      )}

      {completedIslandCount > 0 && (
      <AnimatedPressable accessibilityRole="button" feedback="control" style={styles.islandProgress} onPress={onOpenMap}>
        <MapPinned size={15} color={theme.accent} strokeWidth={2.3} />
        <Text style={[styles.islandProgressText, { color: theme.sub }]}>{t('menu.islands', { completed: completedIslandCount, total: islandTotal })}</Text>
      </AnimatedPressable>
      )}

      <View style={styles.menuBtns}>
        <AnimatedPressable accessibilityRole="button" style={[styles.playBtn, { backgroundColor: theme.accent }]} onPress={onStartGame}>
          <View style={styles.campaignCopy}>
            <Text style={styles.campaignLabel} numberOfLines={1}>
              {currentIsland ? `${t('menu.campaign')} · ${t(`island.${currentIsland.id}.name`)}` : t('menu.campaign')}
            </Text>
            <Text style={styles.playBtnText}>{campaignComplete ? t('menu.playAgain') : solvedCount === 0 ? t('menu.startCampaign') : t('menu.continueLevel', { level: campaignLevel })}</Text>
            <Text style={styles.campaignDetail}>{campaignComplete ? t('menu.levelsComplete', { count: campaignTotal }) : t('menu.levelsExplore', { count: campaignTotal - campaignLevel + 1 })}</Text>
            {/* The island's own progress, on the button that continues it. The card this
                replaces said the same in three lines and a heading of its own. */}
            {!!currentIsland && (
              <View style={styles.campaignBar}>
                <View style={[styles.campaignBarFill, { width: `${islandShare}%` }]} />
              </View>
            )}
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
  // Same box as `goalCard`, and no longer centring its contents: three rows starting at the top
  // line up with the goals underneath, where a centred column would not.
  stat: { flex: 1, minWidth: 0, borderWidth: 1.5, borderRadius: 8, padding: 12 },
  islandProgress: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 20 },
  islandProgressText: { flexShrink: 1, minWidth: 0, fontSize: 12, fontWeight: '700' },
  goalsRow: { flexDirection: 'row', alignItems: 'stretch', width: '100%', maxWidth: 320, gap: 8 },
  goalCard: { flex: 1, minWidth: 0, borderWidth: 1.5, borderRadius: 8, padding: 12 },
  goalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  goalTitle: { flexShrink: 1, minWidth: 0, fontSize: 12, fontWeight: '700' },
  goalCountRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginTop: 5 },
  goalCount: { flexShrink: 0, fontSize: 18, fontWeight: '800' },
  goalBar: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 7 },
  goalBarFill: { height: '100%', borderRadius: 3 },
  goalDetail: { fontSize: 10, marginTop: 7 },
  goalReward: { flexShrink: 1, minWidth: 0, fontSize: 10, fontWeight: '800' },
  menuBtns: { gap: 8, width: '100%', maxWidth: 320 },
  playBtn: { borderRadius: 8, paddingVertical: 13, paddingHorizontal: 15, alignItems: 'center', flexDirection: 'row', gap: 8 },
  campaignCopy: { flex: 1 },
  campaignLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: 'rgba(255,255,255,0.72)' },
  playBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 2 },
  campaignDetail: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  campaignBar: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 8, backgroundColor: 'rgba(255,255,255,0.28)' },
  campaignBarFill: { height: '100%', borderRadius: 2, backgroundColor: '#fff' },
  dailyBtn: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  dailyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dailyBtnText: { flexShrink: 1, minWidth: 0, fontSize: 15, fontWeight: '700' },
  dailyStreak: { fontSize: 11, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  authChoices: { alignItems: 'center', gap: 8, marginTop: 6 },
  // One box, stated once and given to both. Apple's button will not be talked down below its
  // own floor and the Google pill was sizing itself from its text, so left to themselves they
  // came out different heights and different widths. 44 is the floor anyway — the pill used to
  // paint about 25 and had no slop making up the difference.
  authPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1.5, borderRadius: AUTH_BUTTON_HEIGHT / 2, width: AUTH_BUTTON_WIDTH, height: AUTH_BUTTON_HEIGHT, paddingHorizontal: 14 },
  authApplePill: { width: AUTH_BUTTON_WIDTH, height: AUTH_BUTTON_HEIGHT },
  authPillText: { flexShrink: 1, minWidth: 0, fontSize: 12, fontWeight: '600' },
  authError: { maxWidth: 280, marginTop: 2, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  // The player name wraps freely, so the pill grows past 58 instead of clipping it.
  accountButton: { width: '100%', maxWidth: 320, minHeight: 58, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  accountCopy: { flex: 1, minWidth: 0, marginLeft: 12, marginRight: 12 },
  accountName: { fontSize: 14, fontWeight: '800' },
  accountDetail: { fontSize: 11, fontWeight: '600', marginTop: 3 },
});
