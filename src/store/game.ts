'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { advanceDay, createGame, SAVE_VERSION, userFixtureToday } from '@/engine/season';
import type { GameState, Manager } from '@/engine/types';

interface Store {
  game: GameState | null;
  rev: number;
  newGame: (m: Manager, clubId: string) => void;
  update: (fn: (g: GameState) => void) => void;
  continueGame: () => { stoppedFor: 'tekma' | 'novica' | 'konec' | 'dan' };
  reset: () => void;
}

const safeStorage = createJSONStorage(() => {
  try {
    const t = '__ihl_test';
    localStorage.setItem(t, '1');
    localStorage.removeItem(t);
    return localStorage;
  } catch {
    const mem: Record<string, string> = {};
    return {
      getItem: (k: string) => mem[k] ?? null,
      setItem: (k: string, v: string) => {
        mem[k] = v;
      },
      removeItem: (k: string) => {
        delete mem[k];
      },
    };
  }
});

export const useGame = create<Store>()(
  persist(
    (set, get) => ({
      game: null,
      rev: 0,
      newGame: (m, clubId) => {
        const g = createGame(m, clubId, Math.floor(Math.random() * 2 ** 31));
        set({ game: g, rev: get().rev + 1 });
      },
      update: (fn) => {
        const g = get().game;
        if (!g) return;
        fn(g);
        set({ game: { ...g }, rev: get().rev + 1 });
      },
      continueGame: () => {
        const g = get().game;
        if (!g) return { stoppedFor: 'dan' };
        let stoppedFor: 'tekma' | 'novica' | 'konec' | 'dan' = 'dan';
        for (let i = 0; i < 14; i++) {
          if (userFixtureToday(g)) {
            stoppedFor = 'tekma';
            break;
          }
          if (g.phase === 'konec') {
            stoppedFor = 'konec';
            break;
          }
          const unreadBefore = g.news.filter((n) => !n.read && n.kind !== 'tekma').length;
          advanceDay(g);
          const unreadAfter = g.news.filter((n) => !n.read && n.kind !== 'tekma').length;
          if (userFixtureToday(g)) {
            stoppedFor = 'tekma';
            break;
          }
          if ((g.phase as string) === 'konec') {
            stoppedFor = 'konec';
            break;
          }
          if (unreadAfter > unreadBefore) {
            stoppedFor = 'novica';
            break;
          }
        }
        set({ game: { ...g }, rev: get().rev + 1 });
        return { stoppedFor };
      },
      reset: () => set({ game: null, rev: get().rev + 1 }),
    }),
    {
      name: 'ihl-manager-save',
      storage: safeStorage,
      version: SAVE_VERSION,
      partialize: (s) => ({ game: s.game }) as Partial<Store>,
    },
  ),
);
