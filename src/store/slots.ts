'use client';
// Več shranjenih karier v IndexedDB ter izvoz in uvoz datoteke.
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type { GameState } from '@/engine/types';

export interface SlotMeta {
  id: string;
  name: string;
  club: string;
  season: string;
  date: string;
  savedAt: number;
}

const META = 'ihl-slots';
const key = (id: string) => `ihl-slot-${id}`;

export async function listSlots(): Promise<SlotMeta[]> {
  try {
    return ((await idbGet<SlotMeta[]>(META)) ?? []).sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function saveSlot(g: GameState): Promise<SlotMeta> {
  if (!g.slotId) g.slotId = `s${Date.now().toString(36)}`;
  const club = g.clubs.find((c) => c.id === g.userClubId);
  const meta: SlotMeta = {
    id: g.slotId,
    name: `${g.manager.first} ${g.manager.last}`,
    club: club?.name ?? g.userClubId,
    season: `${g.seasonYear}/${String(g.seasonYear + 1).slice(2)}`,
    date: g.date,
    savedAt: Date.now(),
  };
  await idbSet(key(g.slotId), JSON.stringify(g));
  const all = (await listSlots()).filter((m) => m.id !== meta.id);
  await idbSet(META, [meta, ...all]);
  return meta;
}

export async function loadSlot(id: string): Promise<GameState | null> {
  const raw = await idbGet<string>(key(id));
  return raw ? (JSON.parse(raw) as GameState) : null;
}

export async function deleteSlot(id: string) {
  await idbDel(key(id));
  await idbSet(META, (await listSlots()).filter((m) => m.id !== id));
}

export function exportGame(g: GameState) {
  const club = g.clubs.find((c) => c.id === g.userClubId)?.short ?? 'ihl';
  const blob = new Blob([JSON.stringify(g)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ihl-manager-${club.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${g.date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function readGameFile(file: File): Promise<GameState> {
  const text = await file.text();
  const g = JSON.parse(text) as GameState;
  if (!g || !Array.isArray(g.clubs) || !g.players || !g.userClubId || !g.manager) throw new Error('invalid');
  return g;
}
