import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface ChallengeState {
  pendingChallengeIndex: number | null;
  pendingDailyChallengeDate: string | null;
  setPendingChallenge: (idx: number) => void;
  setPendingDailyChallenge: (dateKey: string) => void;
  clearPendingChallenge: () => void;
  clearPendingDailyChallenge: () => void;
}

export const useChallengeStore = create<ChallengeState>()(
  persist(
    set => ({
      pendingChallengeIndex: null,
      pendingDailyChallengeDate: null,
      setPendingChallenge: idx => set({ pendingChallengeIndex: idx }),
      setPendingDailyChallenge: dateKey => set({ pendingDailyChallengeDate: dateKey }),
      clearPendingChallenge: () => set({ pendingChallengeIndex: null }),
      clearPendingDailyChallenge: () => set({ pendingDailyChallengeDate: null }),
    }),
    {
      name: 'bumi-pending-challenge',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
