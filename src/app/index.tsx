import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import * as Linking from 'expo-linking';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Grid } from '@/components/Grid/Grid';
import { celebrationDurationMs, highestTier, type CelebrationTier } from '@/components/Grid/celebration';
import { difficultyLabel, hintLabel, isFirstCampaignLevel, isHintDisabled, levelLabel, nextLabel, type LabelContext } from '@/game/labels';
import { FooterButtons } from '@/components/hud/FooterButtons';
import { Header } from '@/components/hud/Header';
import { MenuScreen } from '@/components/menu/MenuScreen';
import { LevelPickerSheet, type LevelPickerSheetHandle } from '@/components/overlays/LevelPickerSheet';
import { WinSheet, type WinSheetHandle } from '@/components/overlays/WinSheet';
import { IOSInstallPromptSheet, type IOSInstallPromptSheetHandle } from '@/components/overlays/IOSInstallPromptSheet';
import { TutorialOverlay } from '@/components/tutorial/TutorialOverlay';
import { formatDuration, getDailyDateKey, getDailyLevel, getDailyStreak, getNextDailyInMs } from '@/game/daily';
import { getMonthlyProgress, getWeeklyProgress, goalsCompletedBy, isStreakMilestone } from '@/game/goals';
import { getChallengeLevelIndex, getDailyChallengeDateKey } from '@/game/challenge';
import { isCampaignLevelUnlocked, requiresCampaignLogin } from '@/game/access';
import { formatResultDuration, getMedalForResult, getMistakeBudget, type Medal } from '@/game/medals';
import { resolveCampaignSolve } from '@/game/results';
import { getLevel, LEVEL_META, TUTORIAL_LEVELS } from '@/game/levels';
import { getCompletedIslandCount, getIslandJourney, getNewlyCompletedIslandIndex, ISLANDS } from '@/game/islands';
import { useGameStore } from '@/state/gameStore';
import { useProgressStore } from '@/state/progressStore';
import { useSemanticTokens, useThemeTokens } from '@/state/themeStore';
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
  const semantic = useSemanticTokens();
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
  // Selectors, not the whole store: subscribing to all of progress re-rendered the board on
  // every write, including the ones that only touch the menu's counters.
  const { level, placed, won, elapsedMs, hintsUsed, mistakes, loadLevel, placeRect, removeRectAt, undo, clear, hint } = useGameStore();
  const solvedMap = useProgressStore(state => state.solvedMap);
  const levelMedals = useProgressStore(state => state.levelMedals);
  const hints = useProgressStore(state => state.hints);
  const dailyCompletionDates = useProgressStore(state => state.dailyCompletionDates);
  const dailyCompletedDate = useProgressStore(state => state.dailyCompletedDate);
  const iosInstallPromptSeen = useProgressStore(state => state.iosInstallPromptSeen);
  // Actions never change identity, so they are read once rather than subscribed to.
  const progressActions = useProgressStore.getState();

  const solvedCount = Object.keys(solvedMap).length;
  const dailyStreak = getDailyStreak(dailyCompletionDates);
  const dailyDoneToday = dailyCompletedDate === getDailyDateKey();
  const isSolvedByIndex = (idx: number) => !!solvedMap[idx];
  const getLevelMedalByIndex = (idx: number) => levelMedals[idx];
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

  // The ref is there to stop a re-render pushing the login screen a second time, and it used to
  // be lowered only by a campaign level that actually started. Now that the login screen can be
  // backed out of, coming back here is the other way that push ends — and without this, the ref
  // stayed raised and the next tap on the same locked level did nothing at all.
  useFocusEffect(
    useCallback(() => {
      loginRequestedRef.current = false;
    }, []),
  );
  const [tutorialWon, setTutorialWon] = useState(false);
  const [tutorialLevelIndex, setTutorialLevelIndex] = useState(0);
  const [dailyCountdown, setDailyCountdown] = useState(formatDuration(getNextDailyInMs()));
  const [campaignResult, setCampaignResult] = useState<{ medal: Medal; summary: string; pointsGained: number; unlockedIslandName?: string } | null>(null);
  const [celebrationTier, setCelebrationTier] = useState<CelebrationTier>('normal');
  const [dailyResult, setDailyResult] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [dailyChallengeDate, setDailyChallengeDate] = useState(getDailyDateKey());

  const cellSize = useGridCellSize(level?.size ?? 6);
  const levelRows = level?.rows ?? level?.size ?? 6;
  const levelColumns = level?.columns ?? level?.size ?? 6;
  const nextCampaignIndex = LEVEL_META.findIndex((_, idx) => !!!solvedMap[idx]);
  const campaignComplete = nextCampaignIndex === -1;
  const campaignIndex = campaignComplete ? LEVEL_META.length - 1 : nextCampaignIndex;

  // ── Level loading per mode ──────────────────────────────────────────────
  function startCampaign(idx: number): boolean {
    if (!isCampaignLevelUnlocked(idx, solvedMap)) return false;
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
      const result = await shareDailyResult(dailyChallengeDate, dailyResult, dailyStreak, language);
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
        // Assembling the Bumi mark is the most thematic moment in the game and happens once
        // per player, so it cannot fatigue: it gets the largest celebration there is.
        if (tutorialLevelIndex === TUTORIAL_LEVELS.length - 1) setCelebrationTier('island');
        setTutorialWon(true);
        return;
      }
      if (mode === 'daily') {
        const durationMs = elapsedMs();
        setDailyResult(formatSummary(durationMs, hintsUsed, mistakes, t));

        let tier: CelebrationTier = 'normal';
        {
          // Read before marking: afterwards today is already in the list and the transition
          // that earned the reward is gone.
          const closed = goalsCompletedBy(dailyCompletionDates, dailyChallengeDate);
          progressActions.markDailyDone(dailyChallengeDate);
          tier = highestTier(
            closed.monthly ? 'island' : null,
            closed.weekly ? 'gold' : null,
            isStreakMilestone(dailyStreak) ? 'gold' : null,
          );
        }
        setCelebrationTier(tier);
        presentWinSheet(tier);
        return;
      }
      if (mode === 'campaign') {
        const durationMs = elapsedMs();
        const unlockedIslandIndex = getNewlyCompletedIslandIndex(curLvl, solvedMap);
        const outcome = resolveCampaignSolve({
          hintsUsed,
          mistakes,
          rects: level?.solution.length ?? 1,
          bestMedal: levelMedals[curLvl],
          milestone: !!LEVEL_META[curLvl]?.milestone,
          unlockedIsland: unlockedIslandIndex != null,
        });
        progressActions.markSolved(curLvl);
        progressActions.setLevelMedal(curLvl, outcome.medal);
        setCampaignResult({
          medal: outcome.displayedMedal,
          summary: formatSummary(durationMs, hintsUsed, mistakes, t),
          pointsGained: outcome.pointsGained,
          unlockedIslandName: unlockedIslandIndex == null ? undefined : t(`island.${ISLANDS[unlockedIslandIndex].id}.name`),
        });
        setCelebrationTier(outcome.tier);
        presentWinSheet(outcome.tier);
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
        dailyDone={dailyDoneToday}
        dailyStreak={dailyStreak}
        weekly={getWeeklyProgress(dailyCompletionDates)}
        monthly={getMonthlyProgress(dailyCompletionDates)}
        solvedCount={solvedCount}
        goldMedalCount={Object.values(levelMedals).filter(medal => medal === 'gold').length}
        completedIslandCount={getCompletedIslandCount(solvedMap)}
        islandTotal={ISLANDS.length}
        journey={getIslandJourney(solvedMap, campaignIndex)}
        onOpenMap={() => levelsSheetRef.current?.present()}
        campaignLevel={campaignIndex + 1}
        campaignTotal={LEVEL_META.length}
        campaignComplete={campaignComplete}
        onStartGame={solvedCount === 0 ? startTutorial : () => startCampaign(campaignIndex)}
        onStartDaily={() => startDaily()}
        onStartDailyFor={dateKey =>
          startDaily(new Date(Number(dateKey.slice(0, 4)), Number(dateKey.slice(4, 6)) - 1, Number(dateKey.slice(6, 8))))
        }
      />
      {/* Mounted on this branch as well: the journey opens the map from the menu, and the
          game branch that used to own the sheet is not rendered here. */}
      <LevelPickerSheet
        ref={levelsSheetRef}
        curLvl={campaignIndex}
        isSolved={isSolvedByIndex}
        getLevelMedal={getLevelMedalByIndex}
        solvedCount={solvedCount}
        isLevelLocked={idx => !isCampaignLevelUnlocked(idx, solvedMap)}
        isLevelLoginRequired={idx => requiresCampaignLogin(idx, !!user)}
        onSelectLevel={startCampaign}
      />
      </Animated.View>
    );
  }

  if (!level) return null;

  const meta = mode === 'campaign' ? LEVEL_META[curLvl] : null;
  const isTodayDaily = mode === 'daily' && dailyChallengeDate === getDailyDateKey();
  const labels: LabelContext = {
    mode,
    levelIndex: curLvl,
    meta,
    tutorialIndex: tutorialLevelIndex,
    tutorialTotal: TUTORIAL_LEVELS.length,
    rows: levelRows,
    columns: levelColumns,
    hints: hints,
  };
  const isNewSolve = mode === 'campaign' && !!solvedMap[curLvl];
  const mistakeStatus = campaignMistakeStatus();

  /**
   * Which medal the mistakes so far still allow, and how much of that budget is left. The
   * tutorial has no medals, and the daily is scored on its own summary rather than a medal.
   */
  function campaignMistakeStatus(): { medal: Medal; label: string; color: string } | null {
    if (mode !== 'campaign' || won || !level) return null;
    // The medal this result would earn if the level were solved right now. Hints count against
    // it as much as mistakes do, which the mistake count alone could never show.
    const medal = getMedalForResult({ hintsUsed, mistakes, rects: level.solution.length });
    const budget = getMistakeBudget(level.solution.length);
    const limit = medal === 'gold' ? budget.gold : medal === 'silver' ? budget.silver : null;

    return {
      medal,
      label: limit == null
        ? t('game.mistakeCount', { count: mistakes })
        : t('game.mistakeBudget', { used: mistakes, limit }),
      color: medal === 'gold' ? theme.sub : semantic.warning,
    };
  }

  function onHintPress() {
    if (mode === 'tutorial') {
      if (hint()) showShareNotice(t('game.hintApplied'));
      return;
    }
    if (isFirstCampaignLevel(labels)) return;
    if (hints <= 0) return;
    if (!hint()) return;
    progressActions.spendHint();
    showShareNotice(t('game.hintApplied'));
  }

  function onNextLevel() {
    const shouldOfferIOSInstall =
      mode === 'campaign' && curLvl === 2 && !iosInstallPromptSeen && canShowIOSInstallPrompt();

    winSheetRef.current?.dismiss();
    if (mode === 'daily') {
      goToMenu();
      return;
    }
    if (mode === 'campaign' && curLvl < LEVEL_META.length - 1) {
      startCampaign(curLvl + 1);
      if (shouldOfferIOSInstall) {
        progressActions.markIOSInstallPromptSeen();
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
        levelLabel={levelLabel(labels, t)}
        diffLabel={difficultyLabel(labels, t)}
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
          locked={won}
        />
        {/* The medal is decided by this number, so the number is on screen. Nobody can play
            for gold while the budget is a rule they have to infer from the result. */}
        {mistakeStatus && (
          <View style={styles.mistakeStatus}>
            <View style={[styles.medalMark, { backgroundColor: semantic[mistakeStatus.medal] }]} />
            <Text style={[styles.mistakeStatusText, { color: mistakeStatus.color }]}>
              {t(`medal.${mistakeStatus.medal}`)} · {mistakeStatus.label}
            </Text>
          </View>
        )}
      </View>

      <FooterButtons
        hintLabel={hintLabel(labels, t)}
        hintDisabled={isHintDisabled(labels, won)}
        editDisabled={won}
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
        campaignPoints={mode === 'campaign' ? campaignResult?.pointsGained : undefined}
        campaignSummary={mode === 'campaign' ? campaignResult?.summary : undefined}
        unlockedIslandName={mode === 'campaign' ? campaignResult?.unlockedIslandName : undefined}
        dailySummary={mode === 'daily' ? dailyResult ?? undefined : undefined}
        dailyStreak={dailyStreak}
        dailyCountdown={dailyCountdown}
        nextLabel={nextLabel(mode, t)}
        onReview={() => winSheetRef.current?.dismiss()}
        onNext={onNextLevel}
        onShareDailyResult={mode === 'daily' && !!dailyResult ? onShareDailyResult : undefined}
      />

      <IOSInstallPromptSheet ref={iosInstallPromptRef} />

      <LevelPickerSheet
        ref={levelsSheetRef}
        curLvl={curLvl}
        isSolved={isSolvedByIndex}
        getLevelMedal={getLevelMedalByIndex}
        solvedCount={solvedCount}
        isLevelLocked={idx => !isCampaignLevelUnlocked(idx, solvedMap)}
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
  mistakeStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  medalMark: { width: 9, height: 9, borderRadius: 5 },
  mistakeStatusText: { fontSize: 11, fontWeight: '700' },
  shareNotice: { position: 'absolute', alignSelf: 'center', zIndex: 2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  shareNoticeText: { fontSize: 12, fontWeight: '700' },
});
