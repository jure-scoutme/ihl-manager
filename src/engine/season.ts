import { CLUBS } from './data';
import { autoLines, calcOvr, emptyStats, generateLeague, makePlayer, newId, validateLines } from './players';
import { Rng, clamp } from './rng';
import { MatchSim } from './sim';
import type { Attrs, Club, Fixture, GameState, Lines, Manager, MatchResult, NewsItem, Player, Series, Standing, Tactics } from './types';

export const SAVE_VERSION = 1;

export const defaultTactics = (): Tactics => ({ forecheck: 'uravnotezen', tempo: 'normalen', lineUsage: [0.34, 0.28, 0.22, 0.16] });

// --- datumi ---
export const addDays = (d: string, n: number) => {
  const x = new Date(d + 'T12:00:00Z');
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const DAYS = ['ned', 'pon', 'tor', 'sre', 'čet', 'pet', 'sob'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];
export const fmtDate = (d: string) => {
  const x = new Date(d + 'T12:00:00Z');
  return `${DAYS[x.getUTCDay()]}, ${x.getUTCDate()}. ${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
};
export const seasonLabel = (y: number) => `${y}/${String(y + 1).slice(2)}`;

// --- razpored ---
export function makeSchedule(clubIds: string[], seasonYear: number, rng: Rng): Fixture[] {
  const teams = [...clubIds];
  rng.next();
  if (teams.length % 2) teams.push('BYE');
  const n = teams.length;
  const rounds: [string, string][][] = [];
  const arr = [...teams];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop() as string);
  }
  const fixtures: Fixture[] = [];
  let date = `${seasonYear}-09-19`; // sobota
  // prvi dan naj bo sobota
  while (new Date(date + 'T12:00:00Z').getUTCDay() !== 6) date = addDays(date, 1);
  let round = 0;
  for (let cycle = 0; cycle < 4; cycle++) {
    for (const pairs of rounds) {
      round++;
      // božični premor
      const md = date.slice(5);
      if (md >= '12-22' || md <= '01-02') {
        while (date.slice(5) >= '12-22' || date.slice(5) <= '01-02') date = addDays(date, 1);
        while (![3, 6].includes(new Date(date + 'T12:00:00Z').getUTCDay())) date = addDays(date, 1);
      }
      for (const [x, y] of pairs) {
        if (x === 'BYE' || y === 'BYE') continue;
        const [home, away] = cycle % 2 === 0 ? [x, y] : [y, x];
        fixtures.push({ id: newId('f'), date, round, home, away, stage: 'redni', played: false });
      }
      // sobota -> sreda (+4), sreda -> sobota (+3)
      const dow = new Date(date + 'T12:00:00Z').getUTCDay();
      date = addDays(date, dow === 6 ? 4 : 3);
    }
  }
  return fixtures;
}

// --- nova igra ---
export function createGame(manager: Manager, userClubId: string, seed: number): GameState {
  const rng = new Rng(seed);
  const seasonYear = 2026;
  const players = generateLeague(rng, seasonYear);
  const clubs: Club[] = CLUBS.map(({ strength: _s, ...c }) => c);
  const lines: Record<string, Lines> = {};
  const tactics: Record<string, Tactics> = {};
  for (const c of clubs) {
    lines[c.id] = autoLines(Object.values(players).filter((p) => p.clubId === c.id));
    tactics[c.id] = defaultTactics();
  }
  const fixtures = makeSchedule(clubs.map((c) => c.id), seasonYear, rng);
  const club = clubs.find((c) => c.id === userClubId)!;
  const state: GameState = {
    version: SAVE_VERSION,
    seed: rng.int(1, 2 ** 31),
    manager,
    userClubId,
    seasonYear,
    date: addDays(fixtures[0].date, -3),
    phase: 'redni',
    clubs,
    players,
    lines,
    tactics,
    fixtures,
    series: [],
    news: [],
    pastChampions: [],
  };
  addNews(state, 'uprava', `Dobrodošli v ${club.short}u`, `Uprava ${club.name} vam izreka dobrodošlico. Cilj za sezono ${seasonLabel(seasonYear)}: ${club.boardGoal}. Proračun za plače je omejen, zato pametno gospodarite s kadrom.`);
  addNews(state, 'liga', `Začetek sezone ${seasonLabel(seasonYear)}`, `Liga IHL se začne ${fmtDate(fixtures[0].date)}. Nastopa 9 klubov, vsak odigra 32 tekem rednega dela. V končnico se uvrsti 6 najboljših.`);
  return state;
}

export function addNews(state: GameState, kind: NewsItem['kind'], title: string, body: string, fixtureId?: string) {
  state.news.unshift({ id: newId('n'), date: state.date, title, body, kind, read: false, fixtureId });
  if (state.news.length > 80) state.news.length = 80;
}

// --- lestvica ---
export function standings(state: GameState): Standing[] {
  const map: Record<string, Standing> = {};
  for (const c of state.clubs) map[c.id] = { clubId: c.id, gp: 0, w: 0, otw: 0, otl: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  for (const f of state.fixtures) {
    if (f.stage !== 'redni' || !f.played || !f.result) continue;
    const r = f.result;
    const h = map[f.home];
    const a = map[f.away];
    h.gp++;
    a.gp++;
    h.gf += r.hg;
    h.ga += r.ag;
    a.gf += r.ag;
    a.ga += r.hg;
    const homeWin = r.hg > r.ag;
    const [win, lose] = homeWin ? [h, a] : [a, h];
    if (r.ot || r.so) {
      win.otw++;
      win.pts += 2;
      lose.otl++;
      lose.pts += 1;
    } else {
      win.w++;
      win.pts += 3;
      lose.l++;
    }
  }
  return Object.values(map).sort((x, y) => y.pts - x.pts || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf);
}

// --- tekme ---
export function prepareLines(state: GameState, clubId: string) {
  const isUser = clubId === state.userClubId;
  const lines = state.lines[clubId];
  if (!isUser || !lines || !validateLines(lines, state.players, clubId)) {
    state.lines[clubId] = autoLines(Object.values(state.players).filter((p) => p.clubId === clubId));
    if (isUser && lines) addNews(state, 'garderoba', 'Postave so bile popravljene', 'Zaradi poškodbe ali manjkajočega igralca je pomočnik trenerja samodejno sestavil postave.');
  }
}

export function makeSim(state: GameState, f: Fixture, seed?: number) {
  prepareLines(state, f.home);
  prepareLines(state, f.away);
  const club = (id: string) => state.clubs.find((c) => c.id === id)!;
  return new MatchSim({
    homeId: f.home,
    awayId: f.away,
    homeName: club(f.home).short,
    awayName: club(f.away).short,
    players: state.players,
    lines: state.lines,
    tactics: state.tactics,
    playoff: f.stage !== 'redni',
    seed: seed ?? Math.floor(Math.random() * 2 ** 31),
  });
}

const DERBY: string[][] = [['czv', 'par'], ['med', 'zag', 'mla'], ['tri', 'sla', 'cel']];

function attendance(state: GameState, f: Fixture, rng: Rng) {
  const home = state.clubs.find((c) => c.id === f.home)!;
  const st = standings(state);
  const pos = st.findIndex((s) => s.clubId === f.home);
  let fill = 0.28 + home.reputation / 170 + (st.length - pos) * 0.012;
  if (DERBY.some((g) => g.includes(f.home) && g.includes(f.away))) fill += 0.2;
  if (f.stage !== 'redni') fill += 0.15 + (f.stage === 'finale' ? 0.2 : 0);
  fill += rng.normal(0, 0.06);
  return Math.round(home.arena.capacity * clamp(fill, 0.12, 1));
}

export function applyResult(state: GameState, f: Fixture, sim: MatchSim) {
  const rng = new Rng(state.seed++);
  const result: MatchResult = {
    hg: sim.home.score,
    ag: sim.away.score,
    ot: sim.inOT && !sim.shootout,
    so: sim.shootout,
    hShots: sim.home.shots,
    aShots: sim.away.shots,
    goals: sim.goals,
    attendance: attendance(state, f, rng),
    shotsByPeriod: sim.shotsByPeriod,
    penalties: sim.penaltyLog.map((x) => ({ t: x.t, team: x.side, playerId: x.playerId, min: x.min, reason: x.reason })),
    box: [...sim.dressed].map((id) => {
      const st = sim.stat[id];
      const side: 0 | 1 = state.players[id]?.clubId === f.home ? 0 : 1;
      return [id, side, st.g, st.a, st.pm, st.pim, st.sog, st.sa, st.ga];
    }),
    shootout: sim.soAttempts.map((x) => ({ team: x.side, playerId: x.playerId, scored: x.scored })),
    goalies: { home: sim.home.goalie, away: sim.away.goalie },
  };
  f.played = true;
  f.result = result;
  const homeWon = result.hg > result.ag;
  const countStats = true;

  for (const id of sim.dressed) {
    const p = state.players[id];
    if (!p) continue;
    const s = sim.stat[id];
    const isHome = p.clubId === f.home;
    const won = isHome === homeWon;
    if (countStats) {
      p.stats.gp++;
      p.stats.g += s.g;
      p.stats.a += s.a;
      p.stats.pim += s.pim;
      p.stats.pm += s.pm;
      p.stats.sog += s.sog;
      p.stats.sa += s.sa;
      p.stats.ga += s.ga;
      if (p.pos === 'G' && won) p.stats.w++;
      if (p.pos === 'G' && s.ga === 0) p.stats.so++;
    }
    // forma in morala
    const perf = p.pos === 'G' ? (s.sa ? (s.sa - s.ga) / s.sa - 0.9 : 0) * 20 : s.g * 1.2 + s.a * 0.8 + s.pm * 0.5 - 0.4;
    p.form = clamp(Math.round((p.form * 0.6 + perf * 0.6) * 10) / 10, -2, 2);
    p.morale = clamp(p.morale + (won ? 3 : -3) + Math.round(perf), 10, 100);
    p.energy = clamp(p.energy - (16 - p.attrs.stamina * 0.4), 30, 100);
    if (p.pos !== 'G' && rng.chance(0.004)) {
      p.injuryDays = rng.int(3, 28);
      if (p.clubId === state.userClubId) addNews(state, 'garderoba', `Poškodba: ${p.first} ${p.last}`, `${p.first} ${p.last} se je poškodoval na tekmi in bo odsoten približno ${p.injuryDays} dni.`);
    }
  }

  if (f.seriesId) {
    const s = state.series.find((x) => x.id === f.seriesId)!;
    const winner = homeWon ? f.home : f.away;
    if (winner === s.high) s.hw++;
    else s.lw++;
    if (s.hw >= s.winsNeeded || s.lw >= s.winsNeeded) s.winner = s.hw >= s.winsNeeded ? s.high : s.low;
  }

  if (f.home === state.userClubId || f.away === state.userClubId) {
    const us = f.home === state.userClubId;
    const myG = us ? result.hg : result.ag;
    const opG = us ? result.ag : result.hg;
    const opp = state.clubs.find((c) => c.id === (us ? f.away : f.home))!;
    const tag = result.so ? ' po kazenskih strelih' : result.ot ? ' po podaljšku' : '';
    addNews(state, 'tekma', `${myG > opG ? 'Zmaga' : 'Poraz'} proti ${opp.short} ${myG}:${opG}${tag}`, `Obisk: ${result.attendance} gledalcev. Streli: ${us ? result.hShots : result.aShots}:${us ? result.aShots : result.hShots}.`, f.id);
  }
}

export function quickSim(state: GameState, f: Fixture) {
  const sim = makeSim(state, f, state.seed++);
  sim.runToEnd();
  applyResult(state, f, sim);
}

export const todaysFixtures = (state: GameState) => state.fixtures.filter((f) => f.date === state.date);
export const userFixtureToday = (state: GameState) => todaysFixtures(state).find((f) => !f.played && (f.home === state.userClubId || f.away === state.userClubId));
export const nextUserFixture = (state: GameState) =>
  state.fixtures.filter((f) => !f.played && (f.home === state.userClubId || f.away === state.userClubId)).sort((a, b) => a.date.localeCompare(b.date))[0];

// --- napredovanje dneva ---
export function advanceDay(state: GameState): { blocked: boolean } {
  if (state.phase === 'konec') return { blocked: true };
  if (userFixtureToday(state)) return { blocked: true };
  for (const f of todaysFixtures(state)) if (!f.played) quickSim(state, f);

  state.date = addDays(state.date, 1);
  for (const p of Object.values(state.players)) {
    p.energy = Math.min(100, p.energy + 9 + p.attrs.stamina * 0.25);
    if (p.injuryDays > 0) {
      p.injuryDays--;
      if (p.injuryDays === 0 && p.clubId === state.userClubId) addNews(state, 'garderoba', `${p.first} ${p.last} je spet zdrav`, 'Igralec je okreval in je na voljo za naslednjo tekmo.');
    }
  }

  if (state.phase === 'redni' && state.fixtures.filter((f) => f.stage === 'redni').every((f) => f.played)) startPlayoffs(state);
  if (state.phase === 'koncnica') progressPlayoffs(state);
  return { blocked: false };
}

// --- končnica ---
function startPlayoffs(state: GameState) {
  state.phase = 'koncnica';
  const st = standings(state);
  const seeds = st.map((s) => s.clubId);
  state.series = [
    { id: newId('s'), stage: 'cetrtfinale', high: seeds[2], low: seeds[5], winsNeeded: 2, hw: 0, lw: 0 },
    { id: newId('s'), stage: 'cetrtfinale', high: seeds[3], low: seeds[4], winsNeeded: 2, hw: 0, lw: 0 },
  ];
  const name = (id: string) => state.clubs.find((c) => c.id === id)!.short;
  addNews(state, 'liga', 'Konec rednega dela', `Prvo mesto: ${name(seeds[0])}. ${name(seeds[0])} in ${name(seeds[1])} gresta neposredno v polfinale. Četrtfinale: ${name(seeds[2])}–${name(seeds[5])}, ${name(seeds[3])}–${name(seeds[4])}.`);
  if (!seeds.slice(0, 6).includes(state.userClubId)) addNews(state, 'uprava', 'Brez končnice', 'Ekipa se ni uvrstila v končnico. Uprava je razočarana.');
  scheduleSeriesGames(state);
}

function scheduleSeriesGames(state: GameState) {
  for (const s of state.series) {
    if (s.winner) continue;
    const pending = state.fixtures.some((f) => f.seriesId === s.id && !f.played);
    if (pending) continue;
    const n = s.hw + s.lw + 1;
    const highHome = n % 2 === 1;
    state.fixtures.push({
      id: newId('f'),
      date: addDays(state.date, 2),
      round: 100 + n,
      home: highHome ? s.high : s.low,
      away: highHome ? s.low : s.high,
      stage: s.stage,
      seriesId: s.id,
      played: false,
    });
  }
}

function progressPlayoffs(state: GameState) {
  const st = standings(state).map((s) => s.clubId);
  const seedOf = (id: string) => st.indexOf(id);
  const qf = state.series.filter((s) => s.stage === 'cetrtfinale');
  const sf = state.series.filter((s) => s.stage === 'polfinale');
  const fin = state.series.find((s) => s.stage === 'finale');
  const name = (id: string) => state.clubs.find((c) => c.id === id)!.short;

  if (qf.length && qf.every((s) => s.winner) && !sf.length) {
    const winners = qf.map((s) => s.winner!).sort((a, b) => seedOf(a) - seedOf(b));
    state.series.push(
      { id: newId('s'), stage: 'polfinale', high: st[0], low: winners[1], winsNeeded: 3, hw: 0, lw: 0 },
      { id: newId('s'), stage: 'polfinale', high: st[1], low: winners[0], winsNeeded: 3, hw: 0, lw: 0 },
    );
    addNews(state, 'liga', 'Polfinale', `${name(st[0])}–${name(winners[1])} in ${name(st[1])}–${name(winners[0])}. Igra se na 3 zmage.`);
  } else if (sf.length === 2 && sf.every((s) => s.winner) && !fin) {
    const [a, b] = sf.map((s) => s.winner!).sort((x, y) => seedOf(x) - seedOf(y));
    state.series.push({ id: newId('s'), stage: 'finale', high: a, low: b, winsNeeded: 3, hw: 0, lw: 0 });
    addNews(state, 'liga', 'Finale IHL', `V finalu se pomerita ${name(a)} in ${name(b)}. Igra se na 3 zmage.`);
  } else if (fin?.winner && state.phase === 'koncnica') {
    state.phase = 'konec';
    state.champion = fin.winner;
    const won = fin.winner === state.userClubId;
    addNews(state, 'liga', `${name(fin.winner)} je prvak IHL`, `${name(fin.winner)} je v finalu premagal ${name(fin.winner === fin.high ? fin.low : fin.high)} z ${Math.max(fin.hw, fin.lw)}:${Math.min(fin.hw, fin.lw)} v zmagah.`);
    if (won) addNews(state, 'uprava', 'Čestitke za naslov!', 'Uprava je navdušena. Vaš ugled je zrasel.');
    state.manager.reputation = clamp(state.manager.reputation + (won ? 8 : 1), 1, 100);
    return;
  }
  scheduleSeriesGames(state);
}

// --- nova sezona: razvoj, staranje, upokojitve ---
const SKATER_KEYS: (keyof Attrs)[] = ['skating', 'shooting', 'passing', 'puckHandling', 'decisions', 'positioning', 'strength', 'speed', 'stamina', 'workRate'];
const GOALIE_KEYS: (keyof Attrs)[] = ['reflexes', 'gPositioning', 'reboundControl', 'puckPlay', 'decisions'];

export interface DevChange {
  playerId: string;
  name: string;
  age: number;
  before: number;
  after: number;
  reason: string;
}

export function startNewSeason(state: GameState): { changes: DevChange[]; retired: string[]; youth: string[] } {
  const rng = new Rng(state.seed++);
  const season = seasonLabel(state.seasonYear);
  if (state.champion) state.pastChampions.push({ season, clubId: state.champion });
  const changes: DevChange[] = [];
  const retired: string[] = [];
  const youth: string[] = [];
  const nextYear = state.seasonYear + 1;

  for (const p of Object.values(state.players)) {
    if (p.clubId) p.history.push({ season, clubId: p.clubId, stats: p.stats });
    p.stats = emptyStats();
    const age = nextYear - p.birthYear;
    // upokojitev
    if (age >= 34 && rng.chance((age - 33) * 0.22)) {
      if (p.clubId === state.userClubId) retired.push(`${p.first} ${p.last} (${age - 1} let)`);
      delete state.players[p.id];
      continue;
    }
    const before = p.ovr;
    let delta: number;
    let reason: string;
    const gp = p.history[p.history.length - 1]?.stats.gp ?? 0;
    if (age <= 23) {
      delta = Math.min(p.potential - p.ovr, rng.int(1, 4) + (gp > 20 ? 1 : 0));
      reason = gp > 20 ? 'trening in veliko minutaže' : 'trening';
    } else if (age <= 28) {
      delta = rng.int(-1, 2);
      reason = 'v najboljših letih';
    } else if (age <= 31) {
      delta = rng.int(-2, 1);
      reason = 'izkušnje';
    } else {
      delta = rng.int(-4, -1);
      reason = 'starost';
    }
    const keys = p.pos === 'G' ? GOALIE_KEYS : SKATER_KEYS;
    for (let i = 0; i < Math.abs(delta) * 3; i++) {
      const k = rng.pick(keys);
      p.attrs[k] = clamp(p.attrs[k] + Math.sign(delta), 1, 20);
    }
    p.ovr = calcOvr(p.pos, p.attrs);
    p.potential = Math.max(p.potential, p.ovr);
    p.morale = 70;
    p.form = 0;
    p.energy = 100;
    p.injuryDays = 0;
    if (p.clubId === state.userClubId && p.ovr !== before) changes.push({ playerId: p.id, name: `${p.first} ${p.last}`, age, before, after: p.ovr, reason });
  }

  // mladinci (AI) zapolnijo kader
  for (const c of state.clubs) {
    const roster = Object.values(state.players).filter((p) => p.clubId === c.id);
    const need = (pos: ('C' | 'LW' | 'RW' | 'D' | 'G')[], target: number) => target - roster.filter((p) => pos.includes(p.pos)).length;
    const strength = CLUBS.find((x) => x.id === c.id)!.strength;
    const used = new Set(roster.map((p) => p.number));
    const usedNames = new Set(roster.map((p) => p.last));
    const add = (pos: 'C' | 'LW' | 'RW' | 'D' | 'G', count: number) => {
      for (let i = 0; i < count; i++) {
        const p = makePlayer(rng, { pos, base: strength - 2, clubId: c.id, country: c.country, seasonYear: nextYear, age: rng.int(17, 18), isAI: true, usedNumbers: used, usedNames });
        state.players[p.id] = p;
        if (c.id === state.userClubId) youth.push(`${p.first} ${p.last} (${pos}, ${nextYear - p.birthYear} let, ocena ${p.ovr})`);
      }
    };
    add('C', Math.max(0, need(['C'], 5)));
    add('LW', Math.max(0, need(['LW', 'RW'], 9) - Math.floor(Math.max(0, need(['LW', 'RW'], 9)) / 2)));
    add('RW', Math.max(0, 9 - Object.values(state.players).filter((p) => p.clubId === c.id && (p.pos === 'LW' || p.pos === 'RW')).length));
    add('D', Math.max(0, need(['D'], 8)));
    add('G', Math.max(0, need(['G'], 3)));
    if (rng.chance(0.8)) add(rng.pick(['C', 'LW', 'RW', 'D'] as const), 1);
    state.lines[c.id] = autoLines(Object.values(state.players).filter((p) => p.clubId === c.id));
  }

  state.seasonYear = nextYear;
  state.phase = 'redni';
  state.champion = undefined;
  state.series = [];
  state.fixtures = makeSchedule(state.clubs.map((c) => c.id), nextYear, rng);
  state.date = addDays(state.fixtures[0].date, -3);
  addNews(state, 'liga', `Začetek sezone ${seasonLabel(nextYear)}`, `Nova sezona IHL se začne ${fmtDate(state.fixtures[0].date)}.`);
  return { changes, retired, youth };
}

export function clubPlayers(state: GameState, clubId: string): Player[] {
  return Object.values(state.players).filter((p) => p.clubId === clubId);
}
