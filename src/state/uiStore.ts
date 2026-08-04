import { create } from 'zustand';

export type Mode = 'campaign' | 'daily' | 'tutorial' | 'training';
export type Screen = 'menu' | 'game';

interface UIState {
  screen: Screen;
  mode: Mode;
  curLvl: number; // campaign level index; meaningless for other modes
  levelsSheetOpen: boolean;
  winSheetOpen: boolean;
  tutorialStep: number;

  goToMenu: () => void;
  enterGame: (mode: Mode, curLvl?: number) => void;
  setCurLvl: (idx: number) => void;
  openLevels: () => void;
  closeLevels: () => void;
  openWin: () => void;
  closeWin: () => void;
  setTutorialStep: (step: number) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  screen: 'menu',
  mode: 'campaign',
  curLvl: 0,
  levelsSheetOpen: false,
  winSheetOpen: false,
  tutorialStep: 0,

  goToMenu: () => set({ screen: 'menu', levelsSheetOpen: false, winSheetOpen: false }),
  enterGame: (mode, curLvl = 0) => set({ screen: 'game', mode, curLvl, winSheetOpen: false }),
  setCurLvl: idx => set({ curLvl: idx }),
  openLevels: () => set({ levelsSheetOpen: true }),
  closeLevels: () => set({ levelsSheetOpen: false }),
  openWin: () => set({ winSheetOpen: true }),
  closeWin: () => set({ winSheetOpen: false }),
  setTutorialStep: step => set({ tutorialStep: step }),
}));
