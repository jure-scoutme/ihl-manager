// Dosežki managerja in zgodbe igralcev.
import { staffOf } from './staff';
import type { GameState, Player } from './types';

export interface AchDef {
  id: string;
  icon: string;
  title: string;
  desc: string;
  check?: (s: GameState) => boolean;
}

export interface MatchCtx {
  won: boolean;
  my: number;
  op: number;
  derby: boolean;
  hatTrick: boolean;
  soldOut: boolean;
}

const mine = (s: GameState) => Object.values(s.players).filter((p) => p.clubId === s.userClubId);
const homegrown = (s: GameState) => mine(s).filter((p) => p.homegrown === s.userClubId);
const inSeries = (s: GameState, stage?: string) => (s.series ?? []).some((x) => (!stage || x.stage === stage) && (x.high === s.userClubId || x.low === s.userClubId));

export const ACHIEVEMENTS: AchDef[] = [
  { id: 'prva_zmaga', icon: '🏒', title: 'Prva zmaga', desc: 'Zmagaj prvo tekmo kot trener.', check: (s) => (s.managerStats?.w ?? 0) >= 1 },
  { id: 'zmag25', icon: '📈', title: 'Izkušen trener', desc: 'Zberi 25 zmag.', check: (s) => (s.managerStats?.w ?? 0) >= 25 },
  { id: 'zmag100', icon: '🧠', title: 'Legenda klopi', desc: 'Zberi 100 zmag.', check: (s) => (s.managerStats?.w ?? 0) >= 100 },
  { id: 'niz5', icon: '🔥', title: 'Vroča serija', desc: 'Zmagaj 5 tekem zapored.', check: (s) => (s.streak ?? 0) >= 5 },
  { id: 'niz10', icon: '⚡', title: 'Nezaustavljivi', desc: 'Zmagaj 10 tekem zapored.', check: (s) => (s.streak ?? 0) >= 10 },
  { id: 'visoka', icon: '💥', title: 'Razbijalci', desc: 'Zmagaj s 5 ali več goli razlike.' },
  { id: 'nicla', icon: '🧱', title: 'Zaklenjena mreža', desc: 'Zmagaj brez prejetega gola.' },
  { id: 'derbi', icon: '⚔️', title: 'Kralj derbija', desc: 'Zmagaj derbi.' },
  { id: 'hattrick', icon: '🎩', title: 'Hat-trick', desc: 'Tvoj igralec doseže tri gole na tekmi.' },
  { id: 'razprodano', icon: '🎟️', title: 'Razprodano', desc: 'Napolni domačo dvorano do zadnjega sedeža.' },
  { id: 'mladinec', icon: '🎓', title: 'Iz lastne šole', desc: 'Pokliči mladinca v člansko ekipo.', check: (s) => homegrown(s).length >= 1 },
  { id: 'mladinec_gol', icon: '🌱', title: 'Domači junak', desc: 'Vzgojenec kluba doseže gol za člansko ekipo.', check: (s) => homegrown(s).some((p) => p.stats.g + p.history.filter((h) => !/U\d\d/.test(h.season)).reduce((a, h) => a + h.stats.g, 0) >= 1) },
  { id: 'mladinec_zvezda', icon: '🌟', title: 'Zvezda iz akademije', desc: 'Vzgojenec kluba doseže oceno 70.', check: (s) => homegrown(s).some((p) => p.ovr >= 70) },
  { id: 'strelec30', icon: '🎯', title: 'Ostrostrelec', desc: 'Tvoj igralec doseže 30 golov v sezoni.', check: (s) => mine(s).some((p) => p.stats.g >= 30) },
  { id: 'tocke50', icon: '🚀', title: 'Točkovni stroj', desc: 'Tvoj igralec zbere 50 točk v sezoni.', check: (s) => mine(s).some((p) => p.stats.g + p.stats.a >= 50) },
  { id: 'prestop', icon: '✍️', title: 'Prva kupčija', desc: 'Pripelji igralca iz drugega kluba.', check: (s) => (s.counters?.buys ?? 0) >= 1 },
  { id: 'prosti', icon: '🆓', title: 'Lovec na priložnosti', desc: 'Podpiši prostega igralca.', check: (s) => (s.counters?.frees ?? 0) >= 1 },
  { id: 'trener', icon: '👔', title: 'Veliko ime', desc: 'Zaposli glavnega trenerja z renomejem 80+.', check: (s) => (staffOf(s, s.userClubId, 'glavni')?.rep ?? 0) >= 80 },
  { id: 'objekti', icon: '🏟️', title: 'Vrhunski objekti', desc: 'Nadgradi kateri koli objekt na stopnjo 5.', check: (s) => Object.values(s.infra?.[s.userClubId] ?? {}).some((v) => v >= 5) },
  { id: 'blagajna', icon: '💰', title: 'Polna blagajna', desc: 'Imej na računu 200.000 €.', check: (s) => (s.finance[s.userClubId]?.balance ?? 0) >= 200000 },
  { id: 'koncnica', icon: '🎫', title: 'V končnici', desc: 'Uvrsti se v končnico.', check: (s) => inSeries(s) },
  { id: 'prvi_redni', icon: '🥇', title: 'Zmagovalec rednega dela', desc: 'Končaj redni del na prvem mestu.', check: (s) => (s.seasonRecords ?? []).some((r) => r.regularWinner === s.userClubId) },
  { id: 'finale', icon: '🏆', title: 'Finalist', desc: 'Pridi v finale IHL.', check: (s) => inSeries(s, 'finale') },
  { id: 'prvak', icon: '👑', title: 'Prvak IHL', desc: 'Osvoji naslov prvaka.', check: (s) => s.champion === s.userClubId || (s.managerStats?.titles ?? 0) >= 1 },
  { id: 'dinastija', icon: '🏰', title: 'Dinastija', desc: 'Osvoji tri naslove.', check: (s) => (s.managerStats?.titles ?? 0) + (s.champion === s.userClubId && s.phase === 'konec' ? 1 : 0) >= 3 },
  { id: 'reprezentant', icon: '🌍', title: 'Reprezentant', desc: 'Tvoj igralec dobi vpoklic v reprezentanco.' },
  { id: 'zvest', icon: '🤝', title: 'Zvestoba', desc: 'Odvodi tri sezone.', check: (s) => (s.managerStats?.seasons ?? 0) >= 3 },
];

export function unlock(s: GameState, id: string): boolean {
  s.achievements = s.achievements ?? [];
  if (s.achievements.some((a) => a.id === id)) return false;
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  if (!def) return false;
  s.achievements.push({ id, date: s.date });
  s.news.unshift({ id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, date: s.date, kind: 'klub', title: `Dosežek: ${def.title}`, body: def.desc, read: false });
  return true;
}

export function checkAchievements(s: GameState, ctx?: MatchCtx): string[] {
  const got: string[] = [];
  for (const a of ACHIEVEMENTS) if (a.check?.(s) && unlock(s, a.id)) got.push(a.id);
  if (ctx) {
    const add = (id: string, ok: boolean) => ok && unlock(s, id) && got.push(id);
    add('visoka', ctx.won && ctx.my - ctx.op >= 5);
    add('nicla', ctx.won && ctx.op === 0);
    add('derbi', ctx.won && ctx.derby);
    add('hattrick', ctx.hatTrick);
    add('razprodano', ctx.soldOut);
  }
  return got;
}

// --- zgodbe igralcev ---
export function addStory(s: GameState, p: Player, text: string) {
  p.story = p.story ?? [];
  if (p.story.some((x) => x.text === text)) return;
  p.story.push({ date: s.date, text });
  if (p.story.length > 25) p.story.shift();
}
