'use client';
import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { advanceDay, createGame, quickSim, SAVE_VERSION, userFixtureToday } from '@/engine/season';
import { ensureFinance } from '@/engine/finance';
import { ensureV2 } from '@/engine/club';
import { ensureYouth } from '@/engine/youth';
import { hasBlocking, resolveDecision } from '@/engine/events';
import type { GameState, Manager } from '@/engine/types';

interface Store {
  game: GameState | null;
  rev: number;
  newGame: (m: Manager, clubId: string) => void;
  update: (fn: (g: GameState) => void) => void;
  continueGame: () => { stoppedFor: 'tekma' | 'novica' | 'konec' | 'dan' | 'odlocitev' };
  resolve: (id: string, option: number) => string;
  simulateUntil: (date: string, autoUser: boolean) => { reached: boolean; stoppedFor?: 'tekma' | 'konec' | 'odlocitev' };
  reset: () => void;
}

// Shranjevanje v IndexedDB (ni omejitve 5 MB kot pri localStorage). Stara kariera iz localStorage se prenese.
const idbStorage: StateStorage = {
  getItem: async (k) => {
    try {
      const v = await idbGet<string>(k);
      if (v != null) return v;
      const legacy = typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null;
      if (legacy) {
        await idbSet(k, legacy);
        localStorage.removeItem(k);
      }
      return legacy;
    } catch {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    }
  },
  setItem: async (k, v) => {
    try {
      await idbSet(k, v);
    } catch {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* ni prostora */
      }
    }
  },
  removeItem: async (k) => {
    try {
      await idbDel(k);
    } catch {
      /* */
    }
  },
};
const safeStorage = createJSONStorage(() => idbStorage);

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
        let stoppedFor: 'tekma' | 'novica' | 'konec' | 'dan' | 'odlocitev' = 'dan';
        for (let i = 0; i < 14; i++) {
          if (hasBlocking(g)) {
            stoppedFor = 'odlocitev';
            break;
          }
          if (userFixtureToday(g)) {
            stoppedFor = 'tekma';
            break;
          }
          if (g.phase === 'konec') {
            stoppedFor = 'konec';
            break;
          }
          const quiet = ['tekma', 'prestopi', 'mediji', 'klub'];
          const unreadBefore = g.news.filter((n) => !n.read && !quiet.includes(n.kind)).length;
          advanceDay(g);
          const unreadAfter = g.news.filter((n) => !n.read && !quiet.includes(n.kind)).length;
          if (userFixtureToday(g)) {
            stoppedFor = 'tekma';
            break;
          }
          if ((g.phase as string) === 'konec') {
            stoppedFor = 'konec';
            break;
          }
          if (hasBlocking(g)) {
            stoppedFor = 'odlocitev';
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
      simulateUntil: (date, autoUser) => {
        const g = get().game;
        if (!g) return { reached: false };
        let result: { reached: boolean; stoppedFor?: 'tekma' | 'konec' | 'odlocitev' } = { reached: false };
        let guard = 0;
        while (guard++ < 400) {
          if (g.date >= date) {
            result = { reached: true };
            break;
          }
          if (g.phase === 'konec') {
            result = { reached: false, stoppedFor: 'konec' };
            break;
          }
          if (hasBlocking(g)) {
            result = { reached: false, stoppedFor: 'odlocitev' };
            break;
          }
          const uf = userFixtureToday(g);
          if (uf) {
            if (!autoUser) {
              result = { reached: false, stoppedFor: 'tekma' };
              break;
            }
            quickSim(g, uf);
          }
          advanceDay(g);
        }
        set({ game: { ...g }, rev: get().rev + 1 });
        return result;
      },
      resolve: (id, option) => {
        const g = get().game;
        if (!g) return '';
        const txt = resolveDecision(g, id, option);
        set({ game: { ...g }, rev: get().rev + 1 });
        return txt;
      },
      reset: () => set({ game: null, rev: get().rev + 1 }),
    }),
    {
      name: 'ihl-manager-save',
      storage: safeStorage,
      version: SAVE_VERSION,
      partialize: (s) => ({ game: s.game }) as Partial<Store>,
      migrate: (persisted) => {
        const p = persisted as { game: GameState | null };
        if (p?.game) {
          ensureFinance(p.game);
          ensureV2(p.game);
          ensureYouth(p.game);
        }
        return p as unknown as Store;
      },
      onRehydrateStorage: () => (state) => {
        if (state?.game) {
          ensureFinance(state.game);
          ensureV2(state.game);
          ensureYouth(state.game);
        }
      },
    },
  ),
);
