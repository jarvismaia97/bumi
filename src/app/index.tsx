import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Grid } from '@/components/Grid/Grid';
import { celebrationDurationMs, highestTier, type CelebrationTier } from '@/components/Grid/celebration';
import { FooterButtons } from '@/components/hud/FooterButtons';
import { Header } from '@/components/hud/Header';
import { MenuScreen } from '@/components/menu/MenuScreen';
import { LevelPickerSheet, type LevelPickerSheetHandle } from '@/components/overlays/LevelPickerSheet';
import { WinSheet, type WinSheetHandle } from '@/components/overlays/WinSheet';
import { IOSInstallPromptSheet, type IOSInstallPromptSheetHandle } from '@/components/overlays/IOSInstallPromptSheet';
import { TutorialOverlay } from '@/components/tutorial/TutorialOverlay';
import { formatDuration, getDailyDateKey, getDailyLevel, getNextDailyInMs } from '@/game/daily';
import { getMonthlyProgress, getWeeklyProgress } from '@/game/goals';
import { getChallengeLevelIndex, getDailyChallengeDateKey } from '@/game/challenge';
import { isCampaignLevelUnlocked, requiresCampaignLogin } from '@/game/access';
import { formatResultDuration, getMedalForResult, isBetterMedal, type Medal } from '@/game/medals';
import { getLevel, LEVEL_META, TUTORIAL_LEVELS } from '@/game/levels';
import { getCompletedIslandCount, getNewlyCompletedIslandIndex, ISLANDS } from '@/game/islands';
import { useGameStore } from '@/state/gameStore';
import { useProgressStore } from '@/state/progressStore';
import { useThemeTokens } from '@/state/themeStore';
import { useUIStore } from '@/state/uiStore';
import { shareChallenge, shareDailyChallenge, shareDailyResult } from '@/lib/challengeShare';
import { useChallengeStore } from '@/state/challengeStore';
import { useAuthStore } from '@/state/authStore';
import { canShowIOSInstallPrompt } from '@/lib/iosInstallPrompt';
import { useI18n, type Translate } from '@/i18n';
import Animated, { FadeIn, ReduceMotion, useReducedMotion } from 'react-native-reanimated';

function useGridCellSize(size: number) {
  const { width, height } = useWindowDimensions();
  const availW = Math.min(width, 480) - 40;
  const availH = height * 0.48;
  const px = Math.max(140, Math.min(availW, availH));
  return Math.floor(px / size);
}

/** "1m 20s · 2 dicas · 0 tentativas inválidas" and its English counterpart. */
function formatSummary(durationMs: number, hintsUsed: number, mistakes: number, t: Translate): string {
  const hints = `${hintsUsed} ${t(hintsUsed === 1 ? 'game.hintOne' : 'game.hintMany')}`;
  const invalid = `${mistakes} ${t(mistakes === 1 ? 'game.mistakeOne' : 'game.mistakeMany')}`;
  return `${formatResultDuration(durationMs)} · ${hints} · ${invalid}`;
}

export default function GameScreen() {
  const theme = useThemeTokens();
  const insets = useSafeAreaInsets();
  const { t, language } = useI18n();
  const reduceMotion = useReducedMotion();

  const screen = useUIStore(s => s.screen);
  const mode = useUIStore(s => s.mode);
  const curLvl = useUIStore(s => s.curLvl);
  const goToMenu = useUIStore(s => s.goToMenu);
  const enterGame = useUIStore(s => s.enterGame);
  const setCurLvl = useUIStore(s => s.setCurLvl);
  const tutorialStep = useUIStore(s => s.tutorialStep);
  const setTutorialStep = useUIStore(s => s.setTutorialStep);
  const { level, placed, won, startedAt, hintsUsed, mistakes, loadLevel, placeRect, removeRectAt, undo, clear, hint } = useGameStore();
  const progress = useProgressStore();
  const user = useAuthStore(s => s.user);
  const pendingChallengeIndex = useChallengeStore(s => s.pendingChallengeIndex);
  const pendingDailyChallengeDate = useChallengeStore(s => s.pendingDailyChallengeDate);
  const clearPendingChallenge = useChallengeStore(s => s.clearPendingChallenge);
  const clearPendingDailyChallenge = useChallengeStore(s => s.clearPendingDailyChallenge);

  const levelsSheetRef = useRef<LevelPickerSheetHandle>(null);
  const winSheetRef = useRef<WinSheetHandle>(null);
  const iosInstallPromptRef = useRef<IOSInstallPromptSheetHandle>(null);
  const shareNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const winTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loginRequestedRef = useRef(false);
  const linkingUrl = Linking.useLinkingURL();
  const [tutorialWon, setTutorialWon] = useState(false);
  const [tutorialLevelIndex, setTutorialLevelIndex] = useState(0);
  const [dailyCountdown, setDailyCountdown] = useState(formatDuration(getNextDailyInMs()));
  const [campaignResult, setCampaignResult] = useState<{ medal: Medal; summary: string; unlockedIslandName?: string } | null>(null);
  const [celebrationTier, setCelebrationTier] = useState<CelebrationTier>('normal');
  const [dailyResult, setDailyResult] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [dailyChallengeDate, setDailyChallengeDate] = useState(getDailyDateKey());

  const cellSize = useGridCellSize(level?.size ?? 6);
  const levelRows = level?.rows ?? level?.size ?? 6;
  const levelColumns = level?.columns ?? level?.size ?? 6;
  const nextCampaignIndex = LEVEL_META.findIndex((_, idx) => !progress.isSolved(idx));
  const campaignComplete = nextCampaignIndex === -1;
  const campaignIndex = campaignComplete ? LEVEL_META.length - 1 : nextCampaignIndex;

  // ── Level loading per mode ──────────────────────────────────────────────
  function startCampaign(idx: number): boolean {
    if (!isCampaignLevelUnlocked(idx, progress.solvedMap)) return false;
    if (requiresCampaignLogin(idx, !!user)) {
      if (!loginRequestedRef.current) {
        loginRequestedRef.current = true;
        useChallengeStore.getState().setPendingChallenge(idx);
        router.push('/login');
      }
      return false;
    }
    loginRequestedRef.current = false;
    setCampaignResult(null);
    setCelebrationTier('normal');
    setDailyResult(null);
    setCurLvl(idx);
    loadLevel(getLevel(idx));
    enterGame('campaign', idx);
    return true;
  }

  function startDaily(date: Date = new Date()) {
    setCampaignResult(null);
    setCelebrationTier('normal');
    setDailyResult(null);
    setDailyChallengeDate(getDailyDateKey(date));
    loadLevel(getDailyLevel(date));
    enterGame('daily');
  }

  function startTutorial() {
    setCampaignResult(null);
    setCelebrationTier('normal');
    setTutorialStep(0);
    setTutorialWon(false);
    setTutorialLevelIndex(0);
    loadLevel(TUTORIAL_LEVELS[0]);
    enterGame('tutorial');
  }

  function startTutorialLevel(index: number) {
    setTutorialLevelIndex(index);
    setTutorialStep(0);
    setTutorialWon(false);
    loadLevel(TUTORIAL_LEVELS[index]);
  }

  // Let the board finish celebrating before covering it. The old fixed 620ms cut the
  // rectangles off mid-stagger on anything larger than a two-piece level.
  function presentWinSheet(tier: CelebrationTier = 'normal') {
    if (winTimeoutRef.current) clearTimeout(winTimeoutRef.current);
    const holdMs = celebrationDurationMs(placed.length, reduceMotion, tier);
    winTimeoutRef.current = setTimeout(() => winSheetRef.current?.present(), holdMs);
  }

  function showShareNotice(message: string) {
    if (shareNoticeTimeoutRef.current) clearTimeout(shareNoticeTimeoutRef.current);
    setShareNotice(message);
    shareNoticeTimeoutRef.current = setTimeout(() => setShareNotice(null), 2400);
  }

  async function onShareChallenge() {
    try {
      const result = await shareChallenge(curLvl, language);
      if (result === 'copied') showShareNotice(t('game.linkCopied'));
      if (result === 'unavailable') showShareNotice(t('game.shareUnavailable'));
    } catch {
      // The user dismissing the native share sheet is not an error worth showing.
    }
  }

  async function onShareDailyChallenge() {
    try {
      const result = await shareDailyChallenge(dailyChallengeDate, language);
      if (result === 'copied') showShareNotice(t('game.linkCopied'));
      if (result === 'unavailable') showShareNotice(t('game.shareUnavailable'));
    } catch {
      // The user dismissing the native share sheet is not an error worth showing.
    }
  }

  async function onShareDailyResult() {
    if (!dailyResult) return;
    try {
      const result = await shareDailyResult(dailyChallengeDate, dailyResult, progress.dailyStreak(), language);
      if (result === 'copied') showShareNotice(t('game.resultCopied'));
      if (result === 'unavailable') showShareNotice(t('game.shareUnavailable'));
    } catch {
      // The user dismissing the native share sheet is not an error worth showing.
    }
  }

  // ── Win handling ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!won) return;
    const timer = setTimeout(() => {
      if (mode === 'tutorial') {
        setTutorialWon(true);
        return;
      }
      if (mode === 'daily') {
        const durationMs = Math.max(0, Date.now() - startedAt);
        setDailyResult(formatSummary(durationMs, hintsUsed, mistakes, t));
        if (dailyChallengeDate === getDailyDateKey()) progress.markDailyDone();
        presentWinSheet();
        return;
      }
      if (mode === 'campaign') {
        const durationMs = Math.max(0, Date.now() - startedAt);
        const medal = getMedalForResult({ durationMs, hintsUsed, mistakes, size: level?.size ?? 4 });
        const bestMedal = progress.getLevelMedal(curLvl);
        const displayedMedal = isBetterMedal(medal, bestMedal) ? medal : bestMedal ?? medal;
        const unlockedIslandIndex = getNewlyCompletedIslandIndex(curLvl, progress.solvedMap);
        progress.markSolved(curLvl);
        progress.setLevelMedal(curLvl, medal);
        setCampaignResult({
          medal: displayedMedal,
          summary: formatSummary(durationMs, hintsUsed, mistakes, t),
          unlockedIslandName: unlockedIslandIndex == null ? undefined : t(`island.${ISLANDS[unlockedIslandIndex].id}.name`),
        });
        // Only the fresh result earns the big celebration; replaying a solved level does not.
        const tier = highestTier(
          unlockedIslandIndex != null ? 'island' : null,
          medal === 'gold' ? 'gold' : null,
          LEVEL_META[curLvl]?.milestone ? 'milestone' : null,
        );
        setCelebrationTier(tier);
        presentWinSheet(tier);
        return;
      }
      presentWinSheet();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  useEffect(() => {
    const id = setInterval(() => setDailyCountdown(formatDuration(getNextDailyInMs())), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = linkingUrl ? Linking.parse(linkingUrl).queryParams : undefined;
      const sharedDailyDate = getDailyChallengeDateKey(params?.daily) ?? pendingDailyChallengeDate;
      if (sharedDailyDate) {
        startDaily(new Date(Number(sharedDailyDate.slice(0, 4)), Number(sharedDailyDate.slice(4, 6)) - 1, Number(sharedDailyDate.slice(6, 8))));
        clearPendingDailyChallenge();
        return;
      }
      const fromUrl = getChallengeLevelIndex(params?.challenge, LEVEL_META.length);
      const challenge = fromUrl ?? pendingChallengeIndex;
      if (challenge == null) return;
      if (startCampaign(challenge)) clearPendingChallenge();
    }, 0);
    // A link can arrive while the auth guard is redirecting to login; in that
    // case the persisted pending challenge is consumed after authentication.
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkingUrl, pendingChallengeIndex, pendingDailyChallengeDate, user]);

  useEffect(
    () => () => {
      if (shareNoticeTimeoutRef.current) clearTimeout(shareNoticeTimeoutRef.current);
      if (winTimeoutRef.current) clearTimeout(winTimeoutRef.current);
    },
    [],
  );

  if (screen === 'menu') {
    return (
      <Animated.View style={styles.screen} entering={SCREEN_FADE}>
      <MenuScreen
        dailyDone={progress.isDailyDoneToday()}
        dailyStreak={progress.dailyStreak()}
        weekly={getWeeklyProgress(progress.dailyCompletionDates)}
        monthly={getMonthlyProgress(progress.dailyCompletionDates)}
        solvedCount={progress.solvedCount()}
        goldMedalCount={Object.values(progress.levelMedals).filter(medal => medal === 'gold').length}
        completedIslandCount={getCompletedIslandCount(progress.solvedMap)}
        islandTotal={ISLANDS.length}
        campaignLevel={campaignIndex + 1}
        campaignTotal={LEVEL_META.length}
        campaignComplete={campaignComplete}
        onStartGame={progress.solvedCount() === 0 ? startTutorial : () => startCampaign(campaignIndex)}
        onStartDaily={() => startDaily()}
      />
      </Animated.View>
    );
  }

  if (!level) return null;

  const meta = mode === 'campaign' ? LEVEL_META[curLvl] : null;
  const isTodayDaily = mode === 'daily' && dailyChallengeDate === getDailyDateKey();
  const levelLabel =
    mode === 'daily'
      ? t('game.today')
      : mode === 'tutorial'
        ? t('game.tutorialLevel', { current: tutorialLevelIndex + 1, total: TUTORIAL_LEVELS.length })
        : t('game.level', { level: curLvl + 1 });
  const diffLabel =
    mode === 'daily'
      ? t('game.dailyLabel')
      : mode === 'tutorial'
        ? t('game.learnMeta', { rows: levelRows, columns: levelColumns })
        : meta
          ? `${meta.milestone ? `${t('game.extraHard')} · ` : ''}${t(`difficulty.${meta.label}`)} · ${meta.size}×${meta.size}`
          : '';

  const isNewSolve = mode === 'campaign' && progress.isSolved(curLvl);
  const hintDisabled =
    won || (mode !== 'tutorial' && (curLvl === 0 && mode === 'campaign' ? true : progress.hints <= 0));
  const hintLabel =
    mode === 'tutorial'
      ? t('game.hint')
      : mode === 'campaign' && curLvl === 0
        ? t('game.noHint')
        : t('game.hintWithCount', { count: progress.hints });

  function onHintPress() {
    if (mode === 'tutorial') {
      if (hint()) showShareNotice(t('game.hintApplied'));
      return;
    }
    if (mode === 'campaign' && curLvl === 0) return;
    if (progress.hints <= 0) return;
    if (!hint()) return;
    progress.spendHint();
    showShareNotice(t('game.hintApplied'));
  }

  function onNextLevel() {
    const shouldOfferIOSInstall =
      mode === 'campaign' && curLvl === 2 && !progress.iosInstallPromptSeen && canShowIOSInstallPrompt();

    winSheetRef.current?.dismiss();
    if (mode === 'daily') {
      goToMenu();
      return;
    }
    if (mode === 'campaign' && curLvl < LEVEL_META.length - 1) {
      startCampaign(curLvl + 1);
      if (shouldOfferIOSInstall) {
        progress.markIOSInstallPromptSeen();
        setTimeout(() => iosInstallPromptRef.current?.present(), 240);
      }
      return;
    }
    goToMenu();
  }

  return (
    <Animated.View style={[styles.container, { backgroundColor: theme.bg }]} entering={SCREEN_FADE}>
      <Header
        mode={mode}
        levelLabel={levelLabel}
        diffLabel={diffLabel}
        onMenu={goToMenu}
        onLevels={mode === 'tutorial' ? undefined : () => levelsSheetRef.current?.present()}
        onShare={mode === 'campaign' ? onShareChallenge : mode === 'daily' ? onShareDailyChallenge : undefined}
        topInset={insets.top}
      />

      {/* The toast inverts the theme so it reads as a layer over the board in both appearances. */}
      {shareNotice && <View style={[styles.shareNotice, { top: insets.top + 42, backgroundColor: theme.text }]}><Text style={[styles.shareNoticeText, { color: theme.bg }]}>{shareNotice}</Text></View>}

      <View style={styles.gridWrap}>
        <Grid
          level={level}
          placed={placed}
          cellSize={cellSize}
          onPlace={placeRect}
          onRemoveAt={removeRectAt}
          celebrating={won}
          celebrationTier={celebrationTier}
        />
      </View>

      <FooterButtons
        hintLabel={hintLabel}
        hintDisabled={hintDisabled}
        onUndo={undo}
        onClear={clear}
        onHint={onHintPress}
        bottomInset={insets.bottom}
      />

      <WinSheet
        ref={winSheetRef}
        title={t(mode === 'daily' ? 'win.dailyTitle' : 'win.title')}
        subtitle={
          mode === 'daily'
            ? new Date(Number(dailyChallengeDate.slice(0, 4)), Number(dailyChallengeDate.slice(4, 6)) - 1, Number(dailyChallengeDate.slice(6, 8))).toLocaleDateString(language, { day: 'numeric', month: 'long' })
            : meta
              ? t('win.levelSubtitle', { level: curLvl + 1, difficulty: t(`difficulty.${meta.label}`) })
              : ''
        }
        showHintReward={mode === 'campaign' && isNewSolve && !!meta?.milestone}
        isDaily={isTodayDaily}
        campaignMedal={mode === 'campaign' ? campaignResult?.medal : undefined}
        campaignSummary={mode === 'campaign' ? campaignResult?.summary : undefined}
        unlockedIslandName={mode === 'campaign' ? campaignResult?.unlockedIslandName : undefined}
        dailySummary={mode === 'daily' ? dailyResult ?? undefined : undefined}
        dailyStreak={progress.dailyStreak()}
        dailyCountdown={dailyCountdown}
        nextLabel={
          mode === 'daily' ? t('win.backToMenu') : t('win.nextLevel')
        }
        onReview={() => winSheetRef.current?.dismiss()}
        onNext={onNextLevel}
        onShareDailyResult={mode === 'daily' && !!dailyResult ? onShareDailyResult : undefined}
      />

      <IOSInstallPromptSheet ref={iosInstallPromptRef} />

      <LevelPickerSheet
        ref={levelsSheetRef}
        curLvl={curLvl}
        isSolved={progress.isSolved}
        getLevelMedal={progress.getLevelMedal}
        solvedCount={progress.solvedCount()}
        isLevelLocked={idx => !isCampaignLevelUnlocked(idx, progress.solvedMap)}
        isLevelLoginRequired={idx => requiresCampaignLogin(idx, !!user)}
        onSelectLevel={startCampaign}
      />

      <TutorialOverlay
        visible={mode === 'tutorial'}
        lessonIndex={tutorialLevelIndex}
        readyToPlay={tutorialStep > 0}
        won={tutorialWon}
        onStartLesson={() => setTutorialStep(1)}
        onNextLesson={() => startTutorialLevel(tutorialLevelIndex + 1)}
        onPlayLevel1={() => startCampaign(0)}
      />

    </Animated.View>
  );
}

// Menu and board are a conditional render, not a navigation, so there is no navigator
// transition to configure — the swap is animated where it happens. Fade only: the board
// appearing is the calmest moment in the game and a slide would push it around.
const SCREEN_FADE = FadeIn.duration(220).reduceMotion(ReduceMotion.System);

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1, alignItems: 'center' },
  gridWrap: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 12, width: '100%', maxWidth: 480 },
  shareNotice: { position: 'absolute', alignSelf: 'center', zIndex: 2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  shareNoticeText: { fontSize: 12, fontWeight: '700' },
});
