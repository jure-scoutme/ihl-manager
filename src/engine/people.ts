// Pogovori z igralci ter kapetan in pomočnika.
import { Rng, clamp } from './rng';
import type { GameState, Player } from './types';

export type TalkType = 'pohvala' | 'kritika' | 'vloga' | 'motivacija';
export const TALKS: { id: TalkType; label: string }[] = [
  { id: 'pohvala', label: 'Pohvali' },
  { id: 'kritika', label: 'Kritiziraj' },
  { id: 'motivacija', label: 'Motiviraj' },
  { id: 'vloga', label: 'Obljubi večjo vlogo' },
];

const addDays = (d: string, n: number) => {
  const x = new Date(d + 'T12:00:00Z');
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

export const talkCooldown = (s: GameState, p: Player) => (p.lastTalk && p.lastTalk > addDays(s.date, -10) ? p.lastTalk : null);

export function talk(s: GameState, id: string, type: TalkType): { ok: boolean; text: string } {
  const p = s.players[id];
  if (!p || p.clubId !== s.userClubId) return { ok: false, text: 'Igralec ni v tvojem klubu.' };
  if (talkCooldown(s, p)) return { ok: false, text: 'S tem igralcem si se pred kratkim že pogovarjal. Počakaj nekaj dni.' };
  p.lastTalk = s.date;
  const rng = new Rng(s.seed + Number(s.date.replace(/-/g, '')) + id.length);
  const name = `${p.first} ${p.last}`;
  const good = p.form >= 0.5 || p.stats.g + p.stats.a >= Math.max(3, p.stats.gp * 0.7);
  const bad = p.form <= -0.5;
  const m = (v: number) => (p.morale = clamp(Math.round(p.morale + v), 5, 100));
  switch (type) {
    case 'pohvala':
      if (good) {
        m(p.personality === 'individualist' ? 10 : 7);
        return { ok: true, text: `${name} je vesel pohvale in še bolj motiviran.` };
      }
      if (p.personality === 'profesionalec') {
        m(-2);
        return { ok: false, text: `${name} meni, da pohvale ni zaslužil. Ceni iskrenost.` };
      }
      m(2);
      return { ok: true, text: `${name} se je vljudno zahvalil, a ve, da lahko igra bolje.` };
    case 'kritika':
      if (!bad && good) {
        m(-9);
        return { ok: false, text: `${name} je užaljen. Kritika se mu zdi krivična, saj igra dobro.` };
      }
      if (p.personality === 'profesionalec' || p.personality === 'delaven' || p.personality === 'vodja') {
        m(4);
        p.form = clamp(p.form + 0.4, -2, 2);
        return { ok: true, text: `${name} je kritiko sprejel in obljubil več truda.` };
      }
      if (p.personality === 'temperamenten' || p.personality === 'nezanesljiv') {
        m(-10);
        return { ok: false, text: `${name} je burno reagiral. Odnos se je ohladil.` };
      }
      if (rng.chance(0.5)) {
        p.form = clamp(p.form + 0.3, -2, 2);
        m(-2);
        return { ok: true, text: `${name} ni bil navdušen, a je sporočilo razumel.` };
      }
      m(-5);
      return { ok: false, text: `${name} se je zaprl vase.` };
    case 'motivacija':
      m(p.personality === 'ambiciozen' || p.personality === 'vodja' ? 7 : 4);
      return { ok: true, text: `${name} je pripravljen dati vse od sebe.` };
    case 'vloga':
      if ((s.promises ?? []).some((x) => x.playerId === id)) return { ok: false, text: 'Temu igralcu si že nekaj obljubil.' };
      s.promises = [...(s.promises ?? []), { playerId: id, type: 'vloga', until: addDays(s.date, 28) }];
      p.benchStreak = 0;
      m(10);
      return { ok: true, text: `${name} je navdušen. Obljuba velja 4 tedne: igrati mora v prvih treh napadih ali parih.` };
  }
}

// ---------- kapetan ----------
export function captainsOf(s: GameState, clubId: string): { c?: string; a: string[] } {
  s.captains = s.captains ?? {};
  const cur = s.captains[clubId];
  const valid = (id?: string) => !!id && s.players[id]?.clubId === clubId;
  if (cur && valid(cur.c) && cur.a.every(valid)) return cur;
  const roster = Object.values(s.players).filter((p) => p.clubId === clubId && p.pos !== 'G');
  const score = (p: Player) => p.attrs.leadership * 2 + p.ovr / 4 + (p.personality === 'vodja' ? 8 : 0) + Math.min(10, s.seasonYear - p.birthYear - 20);
  const sorted = [...roster].sort((a, b) => score(b) - score(a));
  const auto = { c: valid(cur?.c) ? cur!.c : sorted[0]?.id, a: [] as string[] };
  auto.a = (cur?.a ?? []).filter(valid).filter((id) => id !== auto.c);
  for (const p of sorted) if (auto.a.length < 2 && p.id !== auto.c && !auto.a.includes(p.id)) auto.a.push(p.id);
  s.captains[clubId] = auto;
  return auto;
}

export function setCaptain(s: GameState, role: 'c' | 'a0' | 'a1', id: string) {
  const cur = captainsOf(s, s.userClubId);
  const next = { c: cur.c, a: [...cur.a] };
  // odstrani igralca iz druge vloge
  if (next.c === id) next.c = undefined;
  next.a = next.a.map((x) => (x === id ? '' : x));
  if (role === 'c') {
    const old = next.c;
    next.c = id;
    if (old && old !== id) {
      const p = s.players[old];
      if (p) p.morale = clamp(p.morale - 8, 5, 100);
    }
  } else next.a[role === 'a0' ? 0 : 1] = id;
  next.a = next.a.filter(Boolean);
  s.captains![s.userClubId] = next as { c?: string; a: string[] };
  const p = s.players[id];
  if (p) p.morale = clamp(p.morale + (role === 'c' ? 8 : 4), 5, 100);
}

// tedenski vpliv kapetana na moralo ekipe
export function captainEffect(s: GameState): number {
  const cap = captainsOf(s, s.userClubId);
  const c = cap.c ? s.players[cap.c] : undefined;
  if (!c) return -2;
  let v = (c.attrs.leadership - 10) * 0.5;
  if (c.personality === 'vodja') v += 3;
  if (c.personality === 'temperamenten' || c.personality === 'individualist') v -= 2;
  for (const id of cap.a) {
    const a = s.players[id];
    if (a) v += (a.attrs.leadership - 10) * 0.15;
  }
  return v;
}
