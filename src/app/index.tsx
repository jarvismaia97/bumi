import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Grid } from '@/components/Grid/Grid';
import { FooterButtons } from '@/components/hud/FooterButtons';
import { Header } from '@/components/hud/Header';
import { MenuScreen } from '@/components/menu/MenuScreen';
import { LevelPickerSheet, type LevelPickerSheetHandle } from '@/components/overlays/LevelPickerSheet';
import { WinSheet, type WinSheetHandle } from '@/components/overlays/WinSheet';
import { TutorialOverlay } from '@/components/tutorial/TutorialOverlay';
import { formatDuration, getDailyLevel, getNextDailyInMs } from '@/game/daily';
import { getInfiniteLevel } from '@/game/infinite';
import { getLevel, LEVEL_META, TUTORIAL_LEVEL } from '@/game/levels';
import { useGameStore } from '@/state/gameStore';
import { useProgressStore } from '@/state/progressStore';
import { useThemeStore, useThemeTokens } from '@/state/themeStore';
import { useUIStore } from '@/state/uiStore';

function useGridCellSize(size: number) {
  const { width, height } = useWindowDimensions();
  const availW = Math.min(width, 480) - 40;
  const availH = height * 0.48;
  const px = Math.max(140, Math.min(availW, availH));
  return Math.floor(px / size);
}

export default function GameScreen() {
  const theme = useThemeTokens();
  const colorblind = useThemeStore(s => s.colorblind);

  const { screen, mode, curLvl, infiniteCount, goToMenu, enterGame, setCurLvl, setInfiniteCount, tutorialStep, setTutorialStep } =
    useUIStore();
  const { level, placed, won, loadLevel, placeRect, removeRectAt, undo, clear, hint } = useGameStore();
  const progress = useProgressStore();

  const levelsSheetRef = useRef<LevelPickerSheetHandle>(null);
  const winSheetRef = useRef<WinSheetHandle>(null);
  const [tutorialWon, setTutorialWon] = useState(false);
  const [dailyCountdown, setDailyCountdown] = useState(formatDuration(getNextDailyInMs()));

  const cellSize = useGridCellSize(level?.size ?? 6);

  // Azulejo pattern index: shared per level, cycling by campaign level idx / infinite count.

  // ── Level loading per mode ──────────────────────────────────────────────
  function startCampaign(idx: number) {
    setCurLvl(idx);
    loadLevel(getLevel(idx));
    enterGame('campaign', idx);
  }

  function startDaily() {
    loadLevel(getDailyLevel());
    enterGame('daily');
  }

  function startInfiniteRun() {
    setInfiniteCount(0);
    loadLevel(getInfiniteLevel(0));
    enterGame('infinite');
  }

  function loadNextInfinite(count: number) {
    setInfiniteCount(count);
    loadLevel(getInfiniteLevel(count));
  }

  function startTraining() {
    loadLevel(getLevel(0));
    enterGame('training', 0);
  }

  function startTutorial() {
    setTutorialStep(0);
    setTutorialWon(false);
    loadLevel(TUTORIAL_LEVEL);
    enterGame('tutorial');
  }

  // ── Win handling ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!won) return;
    if (mode === 'tutorial') {
      setTutorialWon(true);
      return;
    }
    if (mode === 'infinite') {
      progress.setInfiniteBest(infiniteCount + 1);
      winSheetRef.current?.present();
      return;
    }
    if (mode === 'daily') {
      progress.markDailyDone();
      winSheetRef.current?.present();
      return;
    }
    // campaign or training
    if (mode === 'campaign') progress.markSolved(curLvl);
    winSheetRef.current?.present();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  useEffect(() => {
    const id = setInterval(() => setDailyCountdown(formatDuration(getNextDailyInMs())), 60000);
    return () => clearInterval(id);
  }, []);

  if (screen === 'menu') {
    return (
      <MenuScreen
        dailyDone={progress.isDailyDoneToday()}
        onStartGame={progress.solvedCount() === 0 ? startTutorial : () => startCampaign(0)}
        onStartDaily={startDaily}
        onStartInfinite={startInfiniteRun}
        onStartTraining={startTraining}
      />
    );
  }

  if (!level) return null;

  const meta = mode === 'campaign' ? LEVEL_META[curLvl] : null;
  const levelLabel = mode === 'infinite' ? '∞' : mode === 'daily' ? '' : mode === 'tutorial' ? '0' : `${curLvl + 1}`;
  const diffLabel =
    mode === 'daily'
      ? 'Desafio Diário'
      : mode === 'infinite'
        ? `Infinito · #${infiniteCount + 1} · ${level.size}×${level.size}`
        : mode === 'tutorial'
          ? `Tutorial · ${level.size}×${level.size}`
          : meta
            ? `${meta.label} · ${meta.size}×${meta.size}`
            : '';

  const isNewSolve = mode === 'campaign' && progress.isSolved(curLvl);
  const hintDisabled =
    mode !== 'training' && mode !== 'tutorial' && (curLvl === 0 && mode === 'campaign' ? true : progress.hints <= 0);
  const hintLabel =
    mode === 'training' || mode === 'tutorial'
      ? 'Hint · ∞'
      : mode === 'campaign' && curLvl === 0
        ? 'Hint · —'
        : `Hint · ${progress.hints}`;

  function onHintPress() {
    if (mode === 'training' || mode === 'tutorial') {
      hint();
      return;
    }
    if (mode === 'campaign' && curLvl === 0) return;
    if (progress.hints <= 0) return;
    progress.spendHint();
    hint();
  }

  function onNextLevel() {
    winSheetRef.current?.dismiss();
    if (mode === 'daily') {
      goToMenu();
      return;
    }
    if (mode === 'infinite') {
      loadNextInfinite(infiniteCount + 1);
      return;
    }
    if (mode === 'campaign' && curLvl < LEVEL_META.length - 1) {
      startCampaign(curLvl + 1);
      return;
    }
    if (mode === 'training') {
      startTraining();
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header mode={mode} levelLabel={levelLabel} diffLabel={diffLabel} onMenu={goToMenu} onLevels={() => levelsSheetRef.current?.present()} />

      <View style={styles.gridWrap}>
        <Grid
          level={level}
          placed={placed}
          cellSize={cellSize}
          colorblind={colorblind}
          onPlace={placeRect}
          onRemoveAt={removeRectAt}
        />
      </View>

      <FooterButtons
        hintLabel={hintLabel}
        hintDisabled={hintDisabled}
        showNext={mode === 'campaign' && won && curLvl < LEVEL_META.length - 1}
        nextLabel="Next Level →"
        onUndo={undo}
        onClear={clear}
        onHint={onHintPress}
        onLevels={() => levelsSheetRef.current?.present()}
        onNext={() => startCampaign(curLvl + 1)}
      />

      <WinSheet
        ref={winSheetRef}
        title={mode === 'daily' ? 'Desafio Completo!' : 'Puzzle Solved!'}
        subtitle={
          mode === 'daily'
            ? new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })
            : mode === 'infinite'
              ? `Puzzle Infinito · #${infiniteCount + 1}`
              : meta
                ? `Level ${curLvl + 1} · ${meta.label}`
                : ''
        }
        showHintReward={mode === 'campaign' && isNewSolve && curLvl > 0}
        isDaily={mode === 'daily'}
        dailyCountdown={dailyCountdown}
        nextLabel={
          mode === 'daily'
            ? '⌂ Voltar ao Menu'
            : mode === 'infinite'
              ? 'Próximo →'
              : mode === 'training'
                ? 'Jogar Novamente →'
                : 'Next Level →'
        }
        onReview={() => winSheetRef.current?.dismiss()}
        onNext={onNextLevel}
      />

      <LevelPickerSheet
        ref={levelsSheetRef}
        curLvl={curLvl}
        isSolved={progress.isSolved}
        solvedCount={progress.solvedCount()}
        onSelectLevel={startCampaign}
        onGoMenu={goToMenu}
      />

      <TutorialOverlay
        visible={mode === 'tutorial'}
        step={tutorialStep}
        won={tutorialWon}
        onNext={() => setTutorialStep(Math.min(tutorialStep + 1, 2))}
        onPlayLevel1={() => startCampaign(0)}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  gridWrap: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 12, width: '100%', maxWidth: 480 },
});
