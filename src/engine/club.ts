import { book } from './finance';
import { Rng, clamp } from './rng';
import type { GameState, InfraLevels, Personality, Player, SeasonRecord } from './types';

// --- osebnosti ---
export const PERSONALITY_INFO: Record<Personality, { label: string; desc: string }> = {
  profesionalec: { label: 'Profesionalec', desc: 'Pridno trenira, hitreje doseže svoj potencial.' },
  ambiciozen: { label: 'Ambiciozen', desc: 'Želi uspeh in morda močnejšo ligo.' },
  zvest: { label: 'Zvest klubu', desc: 'Težje izgubi moralo in redko zahteva odhod.' },
  temperamenten: { label: 'Temperamenten', desc: 'Pogosteje dela prekrške in se spre s soigralci.' },
  vodja: { label: 'Vodja', desc: 'Dviguje moralo slačilnice, dober mentor.' },
  individualist: { label: 'Individualist', desc: 'Želi veliko minutaže in pomembno vlogo.' },
  delaven: { label: 'Delaven', desc: 'Izkoristi trening in sprejema navodila.' },
  nezanesljiv: { label: 'Nezanesljiv', desc: 'Forma močno niha.' },
  uravnotezen: { label: 'Uravnotežen', desc: 'Brez posebnosti.' },
};
const PERS_WEIGHTS: [Personality, number][] = [
  ['uravnotezen', 30], ['profesionalec', 12], ['delaven', 12], ['ambiciozen', 9], ['zvest', 9], ['temperamenten', 8], ['individualist', 8], ['nezanesljiv', 7], ['vodja', 5],
];
export function rollPersonality(rng: Rng, p: Player): Personality {
  const w = PERS_WEIGHTS.map(([k, v]) => (k === 'vodja' ? v + Math.max(0, p.attrs.leadership - 12) * 4 : k === 'temperamenten' ? v + Math.max(0, p.attrs.aggression - 13) * 3 : v));
  return rng.weighted(PERS_WEIGHTS.map(([k]) => k), w);
}

// --- infrastruktura ---
export const INFRA_INFO: Record<keyof InfraLevels, { label: string; desc: string }> = {
  training: { label: 'Trening center', desc: 'Hitrejši razvoj igralcev in boljša regeneracija.' },
  youth: { label: 'Mladinska akademija', desc: 'Boljši mladinci vsako poletje.' },
  medical: { label: 'Medicinska oprema', desc: 'Manj poškodb in hitrejše okrevanje.' },
  scouting: { label: 'Skavtska mreža', desc: 'Več in boljših prostih igralcev na trgu.' },
  marketing: { label: 'Marketing in navijači', desc: 'Več gledalcev, večja podpora, boljši sponzorji.' },
};
export const infraCost = (level: number) => 8000 * level * level;
export const infraDays = (level: number) => 20 + level * 10;
export const infraUpkeep = (lv: InfraLevels) => (lv.training + lv.youth + lv.medical + lv.scouting + lv.marketing) * 150;

export function infraOf(state: GameState, clubId: string): InfraLevels {
  return state.infra?.[clubId] ?? { training: 2, youth: 2, medical: 2, scouting: 1, marketing: 2 };
}

export type ProjectResult = { ok: boolean; text: string };

export function requestUpgrade(state: GameState, key: keyof InfraLevels): ProjectResult {
  const lv = infraOf(state, state.userClubId);
  const cur = lv[key];
  if (cur >= 5) return { ok: false, text: 'Že na najvišji stopnji.' };
  if ((state.projects ?? []).some((p) => p.clubId === state.userClubId && p.key === key)) return { ok: false, text: 'Ta nadgradnja je že v teku.' };
  const cost = infraCost(cur);
  const fin = state.finance[state.userClubId];
  const board = state.board ?? 50;
  if (fin.balance < cost) return { ok: false, text: `Uprava zavrača: na računu ni dovolj denarja (potrebno ${cost.toLocaleString('sl-SI')} €).` };
  if (board < 35 + cur * 5) return { ok: false, text: `Uprava ti trenutno ne zaupa dovolj za to investicijo (zaupanje ${Math.round(board)} %, potrebno ${35 + cur * 5} %).` };
  book(state, state.userClubId, 'investicije', -cost);
  const finish = addDaysLocal(state.date, infraDays(cur));
  state.projects = [...(state.projects ?? []), { key, clubId: state.userClubId, finish, cost }];
  return { ok: true, text: `Uprava je odobrila nadgradnjo (${cost.toLocaleString('sl-SI')} €). Konec del: ${finish}.` };
}

export function requestArena(state: GameState, seats: number): ProjectResult {
  const club = state.clubs.find((c) => c.id === state.userClubId)!;
  if ((state.projects ?? []).some((p) => p.clubId === club.id && p.key === 'arena')) return { ok: false, text: 'Širitev dvorane je že v teku.' };
  const cost = seats * 450;
  const fin = state.finance[club.id];
  const board = state.board ?? 50;
  if (fin.balance < cost) return { ok: false, text: `Ni dovolj denarja (potrebno ${cost.toLocaleString('sl-SI')} €).` };
  if (board < 60) return { ok: false, text: `Za tako veliko investicijo potrebuješ vsaj 60 % zaupanja uprave (zdaj ${Math.round(board)} %).` };
  const rng = new Rng(state.seed++);
  if (!rng.chance(0.55)) return { ok: false, text: `Lastnik dvorane (${club.city}) tokrat ni odobril širitve. Poskusi znova čez nekaj časa.` };
  book(state, club.id, 'investicije', -cost);
  const finish = addDaysLocal(state.date, 90 + seats / 5);
  state.projects = [...(state.projects ?? []), { key: 'arena', clubId: club.id, finish, cost, seats }];
  return { ok: true, text: `Širitev dvorane za ${seats} mest je odobrena. Konec del: ${finish}.` };
}

function addDaysLocal(d: string, n: number) {
  const x = new Date(d + 'T12:00:00Z');
  x.setUTCDate(x.getUTCDate() + Math.round(n));
  return x.toISOString().slice(0, 10);
}

export function processProjects(state: GameState): string[] {
  const done: string[] = [];
  const left = [];
  for (const p of state.projects ?? []) {
    if (p.finish > state.date) {
      left.push(p);
      continue;
    }
    const club = state.clubs.find((c) => c.id === p.clubId)!;
    if (p.key === 'arena') {
      club.arena = { ...club.arena, capacity: club.arena.capacity + (p.seats ?? 0) };
      done.push(`Dvorana ${club.arena.name} ima zdaj ${club.arena.capacity} mest.`);
    } else {
      const lv = infraOf(state, p.clubId);
      state.infra = { ...(state.infra ?? {}), [p.clubId]: { ...lv, [p.key]: Math.min(5, lv[p.key] + 1) } };
      done.push(`${INFRA_INFO[p.key].label} je nadgrajen na stopnjo ${Math.min(5, lv[p.key] + 1)}.`);
    }
  }
  state.projects = left;
  return done;
}

// --- inicializacija novih sistemov (tudi za stare shranjene igre) ---
export function ensureV2(state: GameState) {
  const rng = new Rng(state.seed + 1234);
  for (const p of Object.values(state.players)) if (!p.personality) p.personality = rollPersonality(rng, p);
  if (state.fans === undefined) state.fans = 50;
  if (state.board === undefined) state.board = 55;
  if (!state.infra) {
    state.infra = {};
    for (const c of state.clubs) {
      const b = c.budget;
      state.infra[c.id] = { training: clamp(b - 1, 1, 5), youth: clamp(b - 1 + (c.id === 'sla' || c.id === 'tri' ? 1 : 0), 1, 5), medical: clamp(b - 2, 1, 5), scouting: 1, marketing: clamp(b - 2, 1, 5) };
    }
  }
  state.projects = state.projects ?? [];
  state.decisions = state.decisions ?? [];
  state.promises = state.promises ?? [];
  state.seasonRecords = state.seasonRecords ?? [];
  state.legends = state.legends ?? [];
  state.clubRecords = state.clubRecords ?? {};
  for (const c of state.clubs) state.clubRecords[c.id] = state.clubRecords[c.id] ?? { titles: 0, seasons: 0, gp: 0, w: 0, pts: 0, gf: 0, ga: 0 };
  state.managerStats = state.managerStats ?? { gp: 0, w: 0, l: 0, titles: 0, seasons: 0 };
  state.streak = state.streak ?? 0;
  state.pressDone = state.pressDone ?? [];
}

// --- zgodovina ob koncu sezone ---
export function archiveSeason(state: GameState, seasonLabelStr: string, st: { clubId: string; gp: number; w: number; otw: number; pts: number; gf: number; ga: number }[]) {
  ensureV2(state);
  const players = Object.values(state.players).filter((p) => p.clubId);
  const skaters = players.filter((p) => p.pos !== 'G');
  const top = [...skaters].sort((a, b) => b.stats.g + b.stats.a - (a.stats.g + a.stats.a))[0];
  const topG = [...skaters].sort((a, b) => b.stats.g - a.stats.g)[0];
  const goalies = players.filter((p) => p.pos === 'G' && p.stats.gp >= 8 && p.stats.sa > 0);
  const bestG = [...goalies].sort((a, b) => (b.stats.sa - b.stats.ga) / b.stats.sa - (a.stats.sa - a.stats.ga) / a.stats.sa)[0];
  const fin = state.series.find((s) => s.stage === 'finale');
  const rec: SeasonRecord = {
    season: seasonLabelStr,
    champion: state.champion ?? st[0].clubId,
    regularWinner: st[0].clubId,
    final: fin ? `${Math.max(fin.hw, fin.lw)}:${Math.min(fin.hw, fin.lw)}` : undefined,
    runnerUp: fin ? (fin.winner === fin.high ? fin.low : fin.high) : undefined,
    topScorer: top ? { name: `${top.first} ${top.last}`, clubId: top.clubId!, pts: top.stats.g + top.stats.a, g: top.stats.g, a: top.stats.a } : undefined,
    topGoals: topG ? { name: `${topG.first} ${topG.last}`, clubId: topG.clubId!, g: topG.stats.g } : undefined,
    bestGoalie: bestG ? { name: `${bestG.first} ${bestG.last}`, clubId: bestG.clubId!, svp: Math.round(((bestG.stats.sa - bestG.stats.ga) / bestG.stats.sa) * 1000) / 10, gaa: Math.round((bestG.stats.ga / bestG.stats.gp) * 100) / 100 } : undefined,
    userFinish: st.findIndex((s) => s.clubId === state.userClubId) + 1,
    userClubId: state.userClubId,
  };
  state.seasonRecords!.push(rec);
  for (const s of st) {
    const cr = state.clubRecords![s.clubId];
    cr.seasons++;
    cr.gp += s.gp;
    cr.w += s.w + s.otw;
    cr.pts += s.pts;
    cr.gf += s.gf;
    cr.ga += s.ga;
  }
  if (state.champion) state.clubRecords![state.champion].titles++;
  const ms = state.managerStats!;
  ms.seasons++;
  if (state.champion === state.userClubId) ms.titles++;
}

export function recordRetirement(state: GameState, p: Player, seasonLabelStr: string) {
  ensureV2(state);
  const all = [...p.history.map((h) => h.stats), p.stats];
  const gp = all.reduce((s, x) => s + x.gp, 0);
  const g = all.reduce((s, x) => s + x.g, 0);
  const a = all.reduce((s, x) => s + x.a, 0);
  const clubCount: Record<string, number> = {};
  p.history.forEach((h) => (clubCount[h.clubId] = (clubCount[h.clubId] ?? 0) + h.stats.gp));
  const main = Object.entries(clubCount).sort((x, y) => y[1] - x[1])[0]?.[0] ?? p.clubId ?? '';
  if (gp < 20) return;
  state.legends!.push({ name: `${p.first} ${p.last}`, clubId: main, pos: p.pos, seasons: p.history.length, gp, g, a, retired: seasonLabelStr });
  if (state.legends!.length > 300) state.legends = [...state.legends!].sort((x, y) => y.g + y.a - (x.g + x.a)).slice(0, 300);
}

export function careerTotals(p: Player) {
  const all = [...p.history.map((h) => h.stats), p.stats];
  return { gp: all.reduce((s, x) => s + x.gp, 0), g: all.reduce((s, x) => s + x.g, 0), a: all.reduce((s, x) => s + x.a, 0) };
}
