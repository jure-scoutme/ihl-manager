import { CLUBS } from './data';
import { infraOf, rollPersonality } from './club';
import { emptyStats, makePlayer, newId } from './players';
import { Rng, clamp } from './rng';
import type { GameState, Player, Pos, YouthFixture } from './types';

// Mladinska šola: igralci U20 in U18 so ločeni od članske ekipe (state.youth).
// Njihove lige se simulirajo v ozadju vsako nedeljo, statistika se beleži.

export type YouthLeague = 'U20' | 'U18';

const U20_POS: Pos[] = ['G', 'D', 'D', 'D', 'C', 'C', 'LW', 'LW', 'RW', 'RW', 'D'];
const U18_POS: Pos[] = ['G', 'D', 'D', 'C', 'LW', 'RW', 'C', 'D'];

function addDays(d: string, n: number) {
  const x = new Date(d + 'T12:00:00Z');
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export function makeYouthPlayer(state: GameState, rng: Rng, clubId: string, pos: Pos, age: number, league: YouthLeague): Player {
  const club = state.clubs.find((c) => c.id === clubId)!;
  const strength = CLUBS.find((c) => c.id === clubId)?.strength ?? 52;
  const yl = infraOf(state, clubId).youth;
  const base = strength + 2 + (yl - 2) * 1.5;
  const p = makePlayer(rng, { pos, base, clubId, country: club.country, seasonYear: state.seasonYear, age, isAI: true });
  // mladinci imajo nižjo trenutno oceno, a večji potencial; redki so izjemni talenti
  const talent = rng.chance(0.03 + yl * 0.01) ? rng.int(16, 24) : rng.int(3, 13);
  p.potential = clamp(p.ovr + talent + (yl - 2), p.ovr + 3, 86);
  p.wage = 0;
  p.contractUntil = state.seasonYear + 2;
  p.youth = league;
  p.personality = rollPersonality(rng, p);
  return p;
}

export function ensureYouth(state: GameState) {
  if (state.youth && Object.keys(state.youth).length) {
    if (!state.youthFixtures?.length) state.youthFixtures = makeYouthSchedule(state);
    return;
  }
  const rng = new Rng(state.seed + 555);
  state.youth = {};
  for (const c of state.clubs) {
    for (const pos of U20_POS) {
      const p = makeYouthPlayer(state, rng, c.id, pos, rng.int(18, 20), 'U20');
      state.youth[p.id] = p;
    }
    for (const pos of U18_POS) {
      const p = makeYouthPlayer(state, rng, c.id, pos, rng.int(15, 17), 'U18');
      state.youth[p.id] = p;
    }
  }
  state.youthFixtures = makeYouthSchedule(state);
}

export function makeYouthSchedule(state: GameState): YouthFixture[] {
  const teams = [...state.clubs.map((c) => c.id), 'BYE'];
  const n = teams.length;
  const arr = [...teams];
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) pairs.push(r % 2 === 0 ? [arr[i], arr[n - 1 - i]] : [arr[n - 1 - i], arr[i]]);
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop() as string);
  }
  let date = `${state.seasonYear}-10-01`;
  while (new Date(date + 'T12:00:00Z').getUTCDay() !== 0) date = addDays(date, 1);
  const out: YouthFixture[] = [];
  for (let cycle = 0; cycle < 2; cycle++) {
    for (const pairs of rounds) {
      const md = date.slice(5);
      if (md >= '12-21' || md <= '01-03') date = `${Number(date.slice(0, 4)) + (md >= '12-21' ? 1 : 0)}-01-04`;
      while (new Date(date + 'T12:00:00Z').getUTCDay() !== 0) date = addDays(date, 1);
      for (const [x, y] of pairs) {
        if (x === 'BYE' || y === 'BYE') continue;
        const [home, away] = cycle === 0 ? [x, y] : [y, x];
        for (const league of ['U20', 'U18'] as YouthLeague[]) out.push({ id: newId('y'), date, league, home, away });
      }
      date = addDays(date, 7);
    }
  }
  return out;
}

const poisson = (rng: Rng, lambda: number) => {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng.next();
  } while (p > L && k < 20);
  return k - 1;
};

export const youthTeam = (state: GameState, clubId: string, league: YouthLeague) => Object.values(state.youth ?? {}).filter((p) => p.clubId === clubId && p.youth === league);

function teamStrength(players: Player[]) {
  const sk = players.filter((p) => p.pos !== 'G').sort((a, b) => b.ovr - a.ovr).slice(0, 9);
  const g = players.filter((p) => p.pos === 'G').sort((a, b) => b.ovr - a.ovr)[0];
  const s = sk.reduce((a, p) => a + p.ovr, 0) / Math.max(1, sk.length);
  return { s, g: g?.ovr ?? 35, goalie: g };
}

export function simYouthDay(state: GameState): string[] {
  const out: string[] = [];
  const today = (state.youthFixtures ?? []).filter((f) => f.date === state.date && f.hg === undefined);
  if (!today.length) return out;
  const rng = new Rng(state.seed++);
  for (const f of today) {
    const H = youthTeam(state, f.home, f.league);
    const A = youthTeam(state, f.away, f.league);
    const sh = teamStrength(H);
    const sa = teamStrength(A);
    const lh = clamp(3.1 * Math.exp((sh.s - sa.g * 0.6 - (sa.s - sh.g * 0.6)) / 14) * 1.06, 0.6, 8);
    const la = clamp(3.1 * Math.exp((sa.s - sh.g * 0.6 - (sh.s - sa.g * 0.6)) / 14), 0.6, 8);
    let hg = poisson(rng, lh);
    let ag = poisson(rng, la);
    let ot = false;
    const scorers = (side: Player[], goals: number) => {
      const sk = side.filter((p) => p.pos !== 'G');
      for (let i = 0; i < goals && sk.length; i++) {
        const sc = rng.weighted(sk, sk.map((p) => p.attrs.shooting ** 2 + p.ovr));
        sc.stats.g++;
        sc.stats.sog++;
        const mates = sk.filter((p) => p.id !== sc.id);
        const na = rng.chance(0.65) ? 2 : rng.chance(0.7) ? 1 : 0;
        for (let k = 0; k < na && mates.length; k++) {
          const a = rng.weighted(mates, mates.map((p) => p.attrs.passing ** 2 + p.ovr));
          a.stats.a++;
          mates.splice(mates.indexOf(a), 1);
        }
      }
    };
    scorers(H, hg);
    scorers(A, ag);
    if (hg === ag) {
      ot = true;
      if (rng.chance(0.5 + (sh.s - sa.s) / 40)) hg++;
      else ag++;
    }
    const shotsH = hg + poisson(rng, 24 * Math.exp((sh.s - sa.s) / 30));
    const shotsA = ag + poisson(rng, 24 * Math.exp((sa.s - sh.s) / 30));
    for (const p of [...H, ...A]) p.stats.gp++;
    if (sh.goalie) {
      sh.goalie.stats.sa += shotsA;
      sh.goalie.stats.ga += ag - (ot && ag > hg ? 1 : 0);
      if (hg > ag) sh.goalie.stats.w++;
    }
    if (sa.goalie) {
      sa.goalie.stats.sa += shotsH;
      sa.goalie.stats.ga += hg - (ot && hg > ag ? 1 : 0);
      if (ag > hg) sa.goalie.stats.w++;
    }
    f.hg = hg;
    f.ag = ag;
    f.ot = ot;
    if (f.home === state.userClubId || f.away === state.userClubId) {
      const us = f.home === state.userClubId;
      out.push(`${f.league}: ${state.clubs.find((c) => c.id === f.home)!.short} – ${state.clubs.find((c) => c.id === f.away)!.short} ${hg}:${ag}${ot ? ' (POD)' : ''}${(us ? hg > ag : ag > hg) ? ' ✓' : ''}`);
    }
  }
  return out;
}

export function youthStandings(state: GameState, league: YouthLeague) {
  const map: Record<string, { clubId: string; gp: number; w: number; l: number; gf: number; ga: number; pts: number }> = {};
  for (const c of state.clubs) map[c.id] = { clubId: c.id, gp: 0, w: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  for (const f of state.youthFixtures ?? []) {
    if (f.league !== league || f.hg === undefined) continue;
    const h = map[f.home];
    const a = map[f.away];
    h.gp++;
    a.gp++;
    h.gf += f.hg;
    h.ga += f.ag!;
    a.gf += f.ag!;
    a.ga += f.hg;
    const [w, l] = f.hg > f.ag! ? [h, a] : [a, h];
    w.w++;
    l.l++;
    w.pts += f.ot ? 2 : 3;
    l.pts += f.ot ? 1 : 0;
  }
  return Object.values(map).sort((x, y) => y.pts - x.pts || y.gf - y.ga - (x.gf - x.ga));
}

// --- poklic v člansko ekipo in nazaj ---
export function promote(state: GameState, id: string): { ok: boolean; text: string } {
  const p = state.youth?.[id];
  if (!p || p.clubId !== state.userClubId) return { ok: false, text: 'Igralec ni v tvoji mladinski šoli.' };
  const roster = Object.values(state.players).filter((x) => x.clubId === state.userClubId).length;
  if (roster >= 30) return { ok: false, text: 'Članski kader je poln (30). Najprej koga odpusti.' };
  delete state.youth![id];
  if (p.stats.gp) p.history.push({ season: `${state.seasonYear}/${String(state.seasonYear + 1).slice(2)} ${p.youth}`, clubId: p.clubId!, stats: p.stats });
  p.stats = emptyStats();
  p.youth = undefined;
  p.wage = 150;
  p.contractUntil = state.seasonYear + 2;
  p.morale = Math.min(100, p.morale + 15);
  const used = new Set(Object.values(state.players).filter((x) => x.clubId === state.userClubId).map((x) => x.number));
  const rng = new Rng(state.seed++);
  while (used.has(p.number)) p.number = rng.int(2, 98);
  state.players[id] = p;
  return { ok: true, text: `${p.first} ${p.last} je poklican v člansko ekipo (pogodba do ${p.contractUntil}, 150 €/mes).` };
}

export function demote(state: GameState, id: string): { ok: boolean; text: string } {
  const p = state.players[id];
  if (!p || p.clubId !== state.userClubId) return { ok: false, text: 'Igralec ni v tvoji ekipi.' };
  const age = state.seasonYear - p.birthYear;
  if (age > 20) return { ok: false, text: 'V mladince lahko pošlješ samo igralce do 20 let.' };
  const roster = Object.values(state.players).filter((x) => x.clubId === state.userClubId);
  if (roster.length <= 20) return { ok: false, text: 'Članski kader mora imeti vsaj 20 igralcev.' };
  if (p.pos === 'G' && roster.filter((x) => x.pos === 'G').length <= 2) return { ok: false, text: 'Potrebuješ vsaj dva golmana.' };
  delete state.players[id];
  if (p.stats.gp) p.history.push({ season: `${state.seasonYear}/${String(state.seasonYear + 1).slice(2)}`, clubId: p.clubId!, stats: p.stats });
  p.stats = emptyStats();
  p.youth = age <= 17 ? 'U18' : 'U20';
  state.youth = { ...(state.youth ?? {}), [id]: p };
  return { ok: true, text: `${p.first} ${p.last} je poslan v ${p.youth}, kjer bo dobil več minutaže.` };
}

// --- ob koncu sezone ---
export function youthNewSeason(state: GameState, rng: Rng, seasonLbl: string): { promotedAI: number; aged: string[]; intake: string[] } {
  ensureYouth(state);
  const aged: string[] = [];
  const intake: string[] = [];
  let promotedAI = 0;
  const next = state.seasonYear + 1;
  for (const p of Object.values(state.youth!)) {
    if (p.stats.gp) p.history.push({ season: `${seasonLbl} ${p.youth}`, clubId: p.clubId!, stats: p.stats });
    p.stats = emptyStats();
    const age = next - p.birthYear;
    // razvoj mladih
    const yl = infraOf(state, p.clubId!).youth;
    const delta = Math.min(p.potential - p.ovr, rng.int(1, 4) + (rng.chance((yl - 2) * 0.3) ? 1 : 0) + (p.personality === 'profesionalec' || p.personality === 'delaven' ? 1 : 0));
    const keys = p.pos === 'G' ? (['reflexes', 'gPositioning', 'reboundControl', 'decisions'] as const) : (['skating', 'shooting', 'passing', 'puckHandling', 'decisions', 'positioning', 'strength', 'speed'] as const);
    for (let i = 0; i < delta * 3; i++) {
      const k = rng.pick(keys);
      p.attrs[k] = Math.min(20, p.attrs[k] + 1);
    }
    p.ovr = Math.min(99, p.ovr + delta);
    if (p.youth === 'U18' && age >= 18) p.youth = 'U20';
    if (p.youth === 'U20' && age >= 21) {
      // prestar za mladince: AI klubi najboljše pokličejo, ostali postanejo prosti igralci
      const roster = Object.values(state.players).filter((x) => x.clubId === p.clubId).length;
      delete state.youth![p.id];
      if (p.clubId !== state.userClubId && p.ovr >= 50 && roster < 27) {
        p.youth = undefined;
        p.wage = 150;
        state.players[p.id] = p;
        promotedAI++;
      } else {
        if (p.clubId === state.userClubId) aged.push(`${p.first} ${p.last} (ocena ${p.ovr})`);
        p.youth = undefined;
        p.clubId = null;
        p.wage = Math.max(100, (p.ovr - 38) * 30);
        state.players[p.id] = p;
      }
    }
  }
  // nova generacija 15-letnikov
  for (const c of state.clubs) {
    const yl = infraOf(state, c.id).youth;
    const count = 2 + yl;
    const posPool: Pos[] = ['C', 'LW', 'RW', 'D', 'D', 'C', 'G', 'LW', 'RW'];
    for (let i = 0; i < count; i++) {
      const pl = makeYouthPlayer({ ...state, seasonYear: next }, rng, c.id, posPool[(i + rng.int(0, 8)) % posPool.length], rng.int(15, 16), 'U18');
      state.youth![pl.id] = pl;
      if (c.id === state.userClubId) intake.push(`${pl.first} ${pl.last} (${pl.pos}, ${next - pl.birthYear} let, ocena ${pl.ovr}, potencial ${pl.potential >= 76 ? 'izjemen' : pl.potential >= 69 ? 'visok' : pl.potential >= 62 ? 'srednji' : 'nizek'})`);
    }
  }
  return { promotedAI, aged, intake };
}

// najboljši mladinec ustrezne pozicije za dopolnitev članskega kadra
export function takeBestYouth(state: GameState, clubId: string, pos: Pos[]): Player | undefined {
  const cand = Object.values(state.youth ?? {}).filter((p) => p.clubId === clubId && p.youth === 'U20' && pos.includes(p.pos)).sort((a, b) => b.ovr - a.ovr)[0];
  if (!cand) return undefined;
  delete state.youth![cand.id];
  cand.youth = undefined;
  cand.wage = 150;
  state.players[cand.id] = cand;
  return cand;
}
