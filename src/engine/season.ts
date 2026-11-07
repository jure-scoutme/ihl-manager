import { CLUBS } from './data';
import { autoLines, calcOvr, emptyStats, generateLeague, makePlayer, newId, validateLines } from './players';
import { Rng, clamp } from './rng';
import { MatchSim } from './sim';
import { addFreeAgents, aiSignings, book, ensureFinance, expectedAttendance, makeSponsor, matchFinances, monthlyFinances, clubWages, sponsorOffers } from './finance';
import { archiveSeason, ensureV2, infraOf, processProjects, recordRetirement } from './club';
import { nationalDay } from './national';
import { closeWeek, monthlyBoard, newWeeklyChallenge, summerBudget } from './challenges';
import { combine, groupChem, growChem, recoveryFactor, trainingBoost, weeklyTraining } from './training';
import { contractReminders, expireContracts, windowNews } from './contracts';
import { checkAchievements, unlock, addStory } from './achievements';
import { aiStaffWeekly, devChance, ensureStaff, staffBoost, staffNewSeason } from './staff';
import { afterUserMatch, checkPromises, expireDecisions, hasBlocking, preMatchPress, weeklyBoardAndMood, weeklyLocker } from './events';
import { ensureYouth, makeYouthSchedule, simYouthDay, takeBestYouth, youthNewSeason } from './youth';
import type { Pos, Attrs, Club, Fixture, GameState, Lines, Manager, MatchResult, NewsItem, Player, Series, Standing, Tactics } from './types';

export const SAVE_VERSION = 3;

export const defaultTactics = (): Tactics => ({ forecheck: 'uravnotezen', tempo: 'normalen', lineUsage: [0.34, 0.28, 0.22, 0.16] });

// --- datumi ---
export const addDays = (d: string, n: number) => {
  const x = new Date(d + 'T12:00:00Z');
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const DATE_NAMES: Record<string, { d: string[]; m: string[] }> = {
  sl: { d: ['ned', 'pon', 'tor', 'sre', 'čet', 'pet', 'sob'], m: ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'] },
  hr: { d: ['ned', 'pon', 'uto', 'sri', 'čet', 'pet', 'sub'], m: ['sij', 'velj', 'ožu', 'tra', 'svi', 'lip', 'srp', 'kol', 'ruj', 'lis', 'stu', 'pro'] },
  sr: { d: ['нед', 'пон', 'уто', 'сре', 'чет', 'пет', 'суб'], m: ['јан', 'феб', 'мар', 'апр', 'мај', 'јун', 'јул', 'авг', 'сеп', 'окт', 'нов', 'дец'] },
  en: { d: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], m: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
};
let dateLang = 'sl';
export const setDateLang = (l: string) => {
  dateLang = DATE_NAMES[l] ? l : 'sl';
};
export const fmtDate = (d: string) => {
  const x = new Date(d + 'T12:00:00Z');
  const n = DATE_NAMES[dateLang];
  if (dateLang === 'en') return `${n.d[x.getUTCDay()]}, ${x.getUTCDate()} ${n.m[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
  return `${n.d[x.getUTCDay()]}, ${x.getUTCDate()}. ${n.m[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
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
      // ritem: sobota -> sreda -> sobota -> (prost teden) sobota ... sezona traja do marca
      const dow = new Date(date + 'T12:00:00Z').getUTCDay();
      date = addDays(date, dow === 6 ? (round % 5 === 0 ? 7 : 4) : 3);
    }
  }
  return fixtures;
}

// prijateljske tekme v avgustu: vsak klub 3–4 tekme
export function makeFriendlies(clubIds: string[], seasonYear: number, rng: Rng): Fixture[] {
  const out: Fixture[] = [];
  let date = `${seasonYear}-08-14`;
  while (new Date(date + 'T12:00:00Z').getUTCDay() !== 6) date = addDays(date, 1);
  for (let r = 0; r < 4; r++) {
    const ids = [...clubIds];
    for (let i = ids.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    for (let i = 0; i + 1 < ids.length; i += 2) out.push({ id: newId('f'), date, round: 0, home: ids[i], away: ids[i + 1], stage: 'prijateljska', played: false });
    date = addDays(date, r % 2 === 0 ? 1 : 6); // sobota, nedelja, sobota, nedelja
  }
  return out;
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
    finance: {},
  };
  ensureFinance(state);
  ensureV2(state);
  ensureYouth(state);
  ensureStaff(state);
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
    staff: { [f.home]: combine(staffBoost(state, f.home), trainingBoost(state, f.home)), [f.away]: combine(staffBoost(state, f.away), trainingBoost(state, f.away)) },
    chem: (ids) => groupChem(state, ids),
  });
}

function attendance(state: GameState, f: Fixture, rng: Rng) {
  const st = standings(state);
  const pos = st.findIndex((s) => s.clubId === f.home) + 1;
  const home = state.clubs.find((c) => c.id === f.home)!;
  const exp = expectedAttendance(state, f, undefined, pos);
  return Math.round(clamp(exp * (1 + rng.normal(0, 0.07)), 0, home.arena.capacity));
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
  const friendly = f.stage === 'prijateljska';
  if (!friendly) matchFinances(state, f, result.attendance);
  else book(state, f.home, 'vstopnice', Math.round(result.attendance * 3));
  const homeWon = result.hg > result.ag;
  const countStats = !friendly;

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
    const perf = (p.pos === 'G' ? (s.sa ? (s.sa - s.ga) / s.sa - 0.9 : 0) * 20 : s.g * 1.2 + s.a * 0.8 + s.pm * 0.5 - 0.4) * (p.personality === 'nezanesljiv' ? 1.7 : 1);
    p.form = clamp(Math.round((p.form * 0.6 + perf * 0.6) * 10) / 10, -2, 2);
    const loss = p.personality === 'zvest' ? -1.5 : -3;
    p.morale = clamp(Math.round(p.morale + (won ? 3 : loss) + perf), 10, 100);
    p.energy = clamp(p.energy - (16 - p.attrs.stamina * 0.4), 30, 100);
    const med = infraOf(state, p.clubId!).medical;
    if (p.pos !== 'G' && rng.chance((friendly ? 0.002 : 0.004) * (1.3 - med * 0.1) * (p.energy < 50 ? 1.6 : 1))) {
      p.injuryDays = Math.max(1, Math.round(rng.int(3, 28) * (1.25 - med * 0.1)));
      if (p.clubId === state.userClubId) addNews(state, 'garderoba', `Poškodba: ${p.first} ${p.last}`, `${p.first} ${p.last} se je poškodoval na tekmi in bo odsoten približno ${p.injuryDays} dni.`);
    }
  }

  growChem(state, f.home);
  growChem(state, f.away);

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
    if (friendly) {
      addNews(state, 'tekma', `Prijateljska: ${myG > opG ? 'zmaga' : 'poraz'} proti ${opp.short} ${myG}:${opG}`, `Pripravljalna tekma. Obisk: ${result.attendance} gledalcev.`, f.id);
      return;
    }
    addNews(state, 'tekma', `${myG > opG ? 'Zmaga' : 'Poraz'} proti ${opp.short} ${myG}:${opG}${tag}`, `Obisk: ${result.attendance} gledalcev. Streli: ${us ? result.hShots : result.aShots}:${us ? result.aShots : result.hShots}.`, f.id);
    afterUserMatch(state, f);
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
  if (hasBlocking(state)) return { blocked: true };
  for (const f of todaysFixtures(state)) if (!f.played) quickSim(state, f);

  state.date = addDays(state.date, 1);
  windowNews(state);
  nationalDay(state);
  if (state.date.endsWith('-01')) {
    contractReminders(state);
    monthlyFinances(state);
    monthlyBoard(state);
    if (state.date.endsWith('-06-01')) summerBudget(state);
    const bal = state.finance[state.userClubId]?.balance ?? 0;
    if (bal < 0) addNews(state, 'uprava', 'Klub je v minusu', `Stanje na računu: ${bal.toLocaleString('sl-SI')} €. Uprava pričakuje, da zmanjšate stroške ali povečate prihodke.`);
  }
  if (new Date(state.date + 'T12:00:00Z').getUTCDay() === 1) {
    const signed = aiSignings(state);
    if (signed.length) addNews(state, 'prestopi', 'Novi podpisi v ligi', signed.join(' '));
    const st = standings(state);
    const pos = st.findIndex((s) => s.clubId === state.userClubId) + 1;
    const club = state.clubs.find((c) => c.id === state.userClubId)!;
    if (st[0].gp > 0) weeklyBoardAndMood(state, pos, club.boardGoal);
    if (st[0].gp >= 3) weeklyLocker(state, pos);
    closeWeek(state);
    newWeeklyChallenge(state);
    const trn = weeklyTraining(state);
    if (trn.length) addNews(state, 'klub', 'Trening', trn.join(' '));
    const staffNews = aiStaffWeekly(state, (id) => st.findIndex((s) => s.clubId === id) + 1, st[0].gp);
    if (staffNews.length) addNews(state, 'liga', 'Menjave trenerjev', staffNews.join(' '));
  }
  expireDecisions(state);
  checkPromises(state);
  const yres = simYouthDay(state);
  if (yres.length) addNews(state, 'klub', 'Rezultati mladincev', yres.join(' · '));
  for (const t of processProjects(state)) addNews(state, 'klub', 'Nadgradnja končana', t);
  const today = userFixtureToday(state);
  if (today) {
    const st = standings(state);
    preMatchPress(state, today, (id) => st.findIndex((s) => s.clubId === id) + 1);
  }
  for (const p of Object.values(state.players)) {
    p.energy = Math.min(100, p.energy + (9 + p.attrs.stamina * 0.25) * recoveryFactor(state, p.clubId));
    if (p.injuryDays > 0) {
      p.injuryDays--;
      if (p.injuryDays === 0 && p.clubId === state.userClubId) addNews(state, 'garderoba', `${p.first} ${p.last} je spet zdrav`, 'Igralec je okreval in je na voljo za naslednjo tekmo.');
    }
  }

  if (state.phase === 'poletje') {
    const first = state.fixtures.filter((f) => f.stage === 'redni').map((f) => f.date).sort()[0];
    if (first && state.date >= addDays(first, -3)) {
      state.phase = 'redni';
      for (const c of state.clubs) {
        const added = fillRoster(state, c.id);
        if (c.id === state.userClubId && added.length) addNews(state, 'klub', 'Pomočnik je dopolnil kader', `Kader je bil premajhen, zato so se ekipi pridružili: ${added.join(', ')}.`);
      }
      addNews(state, 'liga', `Začetek sezone ${seasonLabel(state.seasonYear)}`, `Redni del se začne ${fmtDate(first)}. Kader je zaključen, prosti igralci pa so na voljo vso sezono.`);
    }
  }
  if (state.date.endsWith('-07-01')) expireContracts(state);
  if (state.date.endsWith('-06-15') && state.phase === 'poletje') sponsorOffers(state);
  if (state.phase === 'redni' && state.fixtures.filter((f) => f.stage === 'redni').every((f) => f.played)) startPlayoffs(state);
  if (state.phase === 'koncnica') progressPlayoffs(state);
  checkAchievements(state);
  return { blocked: false };
}

// dopolni kader do minimuma (12 napadalcev, 7 branilcev, 2 golmana)
export function fillRoster(state: GameState, clubId: string): string[] {
  const out: string[] = [];
  const rng = new Rng(state.seed++);
  const club = state.clubs.find((c) => c.id === clubId)!;
  const roster = () => Object.values(state.players).filter((p) => p.clubId === clubId);
  const need: [Pos[], number][] = [[['C', 'LW', 'RW'], 12], [['D'], 7], [['G'], 2]];
  for (const [pos, min] of need) {
    let guard = 0;
    while (roster().filter((p) => pos.includes(p.pos)).length < min && guard++ < 10) {
      const y = takeBestYouth(state, clubId, pos);
      if (y) {
        out.push(`${y.first} ${y.last} (U20)`);
        continue;
      }
      const fa = Object.values(state.players).filter((p) => !p.clubId && pos.includes(p.pos)).sort((a, b) => a.wage - b.wage || b.ovr - a.ovr)[0];
      if (fa) {
        fa.clubId = clubId;
        fa.contractUntil = state.seasonYear;
        out.push(`${fa.first} ${fa.last}`);
        continue;
      }
      const strength = CLUBS.find((x) => x.id === clubId)?.strength ?? 50;
      const p = makePlayer(rng, { pos: rng.pick(pos), base: strength - 4, clubId, country: club.country, seasonYear: state.seasonYear, age: rng.int(18, 20), isAI: true });
      state.players[p.id] = p;
      out.push(`${p.first} ${p.last}`);
    }
  }
  if (out.length) state.lines[clubId] = autoLines(roster());
  return out;
}

// --- končnica ---
function startPlayoffs(state: GameState) {
  state.phase = 'koncnica';
  const st = standings(state);
  const seeds = st.map((s) => s.clubId);
  state.series = [
    { id: newId('s'), stage: 'cetrtfinale', high: seeds[2], low: seeds[5], winsNeeded: 3, hw: 0, lw: 0 },
    { id: newId('s'), stage: 'cetrtfinale', high: seeds[3], low: seeds[4], winsNeeded: 3, hw: 0, lw: 0 },
  ];
  const name = (id: string) => state.clubs.find((c) => c.id === id)!.short;
  addNews(state, 'liga', 'Konec rednega dela', `Prvo mesto: ${name(seeds[0])}. ${name(seeds[0])} in ${name(seeds[1])} gresta neposredno v polfinale. Četrtfinale: ${name(seeds[2])}–${name(seeds[5])}, ${name(seeds[3])}–${name(seeds[4])}.`);
  for (const id of seeds.slice(0, 6)) book(state, id, 'bonusi', state.finance[id]?.sponsor.playoffBonus ?? 0);
  if (!seeds.slice(0, 6).includes(state.userClubId)) addNews(state, 'uprava', 'Brez končnice', 'Ekipa se ni uvrstila v končnico. Uprava je razočarana.');
  else unlock(state, 'koncnica');
  if (seeds[0] === state.userClubId) unlock(state, 'prvi_redni');
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
      date: addDays(state.date, 3),
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
    book(state, fin.winner, 'bonusi', state.finance[fin.winner]?.sponsor.titleBonus ?? 0);
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
  ensureV2(state);
  const finalStandings = standings(state);
  archiveSeason(state, season, finalStandings);
  if (state.champion) state.pastChampions.push({ season, clubId: state.champion });
  // uprava oceni sezono
  const userClub = state.clubs.find((c) => c.id === state.userClubId)!;
  const target = userClub.boardGoal === 'naslov' ? 1 : userClub.boardGoal === 'finale' ? 2 : userClub.boardGoal === 'polfinale' ? 4 : 6;
  const userPos = finalStandings.findIndex((s) => s.clubId === state.userClubId) + 1;
  const goalMet = state.champion === state.userClubId || userPos <= target;
  state.board = clamp((state.board ?? 55) + (goalMet ? 12 : -12), 0, 100);
  addNews(state, 'uprava', goalMet ? 'Uprava je zadovoljna s sezono' : 'Uprava je razočarana', goalMet ? `Cilj (${userClub.boardGoal}) je izpolnjen. Zaupanje uprave: ${Math.round(state.board)} %.` : `Cilj (${userClub.boardGoal}) ni bil izpolnjen. Zaupanje uprave: ${Math.round(state.board)} %.`);
  state.streak = 0;
  // igralci na seznamu za prodajo odidejo
  for (const p of Object.values(state.players)) {
    if (p.listed && p.clubId) {
      if (p.clubId === state.userClubId) addNews(state, 'prestopi', `${p.first} ${p.last} zapušča klub`, 'Igralec s seznama za prodajo je odšel kot prost igralec.');
      p.clubId = null;
      p.listed = false;
    }
  }
  const changes: DevChange[] = [];
  const retired: string[] = [];
  const youth: string[] = [];
  const nextYear = state.seasonYear + 1;

  for (const p of Object.values(state.players)) {
    if (p.clubId) p.history.push({ season, clubId: p.clubId, stats: p.stats });
    p.stats = emptyStats();
    const age = nextYear - p.birthYear;
    // upokojitev
    if (!p.clubId && age >= 33) {
      delete state.players[p.id];
      continue;
    }
    if (age >= 34 && rng.chance((age - 33) * 0.22)) {
      if (p.clubId) recordRetirement(state, p, season);
      if (p.clubId === state.userClubId) retired.push(`${p.first} ${p.last} (${age - 1} let)`);
      delete state.players[p.id];
      continue;
    }
    const before = p.ovr;
    let delta: number;
    let reason: string;
    const gp = p.history[p.history.length - 1]?.stats.gp ?? 0;
    if (age <= 23) {
      const tr = p.clubId ? infraOf(state, p.clubId).training : 2;
      const bonus = (gp > 20 ? 1 : 0) + (rng.chance((tr - 2) * 0.3) ? 1 : 0) + ((p.personality === 'profesionalec' || p.personality === 'delaven') && rng.chance(0.5) ? 1 : 0) + (p.mentorId && state.players[p.mentorId]?.clubId === p.clubId ? 1 : 0) + (p.clubId && rng.chance(devChance(state, p.clubId, p.pos === 'G')) ? 1 : 0);
      delta = Math.min(p.potential - p.ovr, rng.int(1, 4) + bonus);
      reason = [gp > 20 ? 'minutaža' : '', tr >= 4 ? 'trening center' : 'trening', p.clubId && devChance(state, p.clubId, p.pos === 'G') >= 0.25 ? 'trenerji' : '', p.mentorId ? 'mentor' : '', p.personality === 'profesionalec' ? 'profesionalnost' : ''].filter(Boolean).join(', ');
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
    if (p.clubId === state.userClubId && p.ovr - before >= 4) addStory(state, p, `Preboj v sezoni: ocena ${before} → ${p.ovr}`);
    if (p.clubId === state.userClubId && p.ovr !== before) changes.push({ playerId: p.id, name: `${p.first} ${p.last}`, age, before, after: p.ovr, reason });
  }

  // mladinska šola: razvoj, prehod U18 -> U20, prestari odidejo, nova generacija
  const yr = youthNewSeason(state, rng, season);
  if (yr.aged.length) addNews(state, 'klub', 'Mladinci, prestari za U20', `Niso bili poklicani v člansko ekipo in so odšli kot prosti igralci: ${yr.aged.join(', ')}.`);
  if (yr.intake.length) addNews(state, 'klub', 'Nova generacija v mladinski šoli', `V U18 prihajajo: ${yr.intake.join(', ')}.`);
  youth.push(...yr.intake);
  // kader dopolnijo najprej igralci iz U20, nato AI mladinci
  for (const c of state.clubs) {
    const roster = Object.values(state.players).filter((p) => p.clubId === c.id);
    const need = (pos: ('C' | 'LW' | 'RW' | 'D' | 'G')[], target: number) => target - roster.filter((p) => pos.includes(p.pos)).length;
    const strength = CLUBS.find((x) => x.id === c.id)!.strength + (infraOf(state, c.id).youth - 2) * 1.5;
    const used = new Set(roster.map((p) => p.number));
    const usedNames = new Set(roster.map((p) => p.last));
    const add = (pos: 'C' | 'LW' | 'RW' | 'D' | 'G', count: number) => {
      for (let i = 0; i < count; i++) {
        const fromYouth = takeBestYouth(state, c.id, pos === 'LW' || pos === 'RW' ? ['LW', 'RW'] : [pos]);
        if (fromYouth) {
          if (c.id === state.userClubId) addNews(state, 'klub', `${fromYouth.first} ${fromYouth.last} poklican iz U20`, 'Zaradi premalo igralcev na poziciji je pomočnik trenerja poklical mladinca v člansko ekipo.');
          continue;
        }
        const p = makePlayer(rng, { pos, base: strength - 2, clubId: c.id, country: c.country, seasonYear: nextYear, age: rng.int(17, 18), isAI: true, usedNumbers: used, usedNames });
        state.players[p.id] = p;

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
  // prosti igralci se postarajo, pridejo novi; novi sponzorji in proračuni
  const fa = Object.values(state.players).filter((p) => !p.clubId).sort((a, b) => b.ovr - a.ovr);
  fa.slice(50).forEach((p) => delete state.players[p.id]);
  const sc = infraOf(state, state.userClubId).scouting;
  addFreeAgents(state, 10 + sc * 2, sc - 1);
  const sn = staffNewSeason(state);
  if (sn.length) addNews(state, 'klub', 'Spremembe v štabu', sn.join(' '));
  for (const c of state.clubs) {
    if (state.champion === c.id) c.reputation = Math.min(90, c.reputation + 2);
    const fin = state.finance[c.id];
    if (!fin) continue;
    if (c.id !== state.userClubId) fin.sponsor = makeSponsor(c, rng);
    const mk = infraOf(state, c.id).marketing;
    if (c.id !== state.userClubId) fin.sponsor.monthly = Math.round((fin.sponsor.monthly * (1 + (mk - 2) * 0.08)) / 100) * 100;
    fin.wageBudget = Math.max(fin.wageBudget, Math.round((clubWages(state, c.id) * 1.08) / 100) * 100);
  }
  state.phase = 'poletje';
  state.champion = undefined;
  state.series = [];
  const regular = makeSchedule(state.clubs.map((c) => c.id), nextYear, rng);
  state.fixtures = [...makeFriendlies(state.clubs.map((c) => c.id), nextYear, rng), ...regular];
  state.youthFixtures = makeYouthSchedule(state);
  state.date = addDays(state.date, 1);
  addNews(state, 'liga', `Poletje ${nextYear}`, `Čas za sestavljanje ekipe: pogodbe, prestopi in sponzorji. Pogodbe potečejo 30. junija. Prijateljske tekme so v avgustu, redni del se začne ${fmtDate(regular[0].date)}.`);
  ensureV2(state);
  return { changes, retired, youth };
}

export function clubPlayers(state: GameState, clubId: string): Player[] {
  return Object.values(state.players).filter((p) => p.clubId === clubId);
}
