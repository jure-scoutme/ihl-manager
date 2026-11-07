import { CLUBS } from './data';
import { makePlayer } from './players';
import { Rng, clamp } from './rng';
import type { Club, ClubFinance, Fixture, GameState, Player } from './types';

export const INCOME_LABELS: Record<string, string> = {
  vstopnice: 'Vstopnice',
  bar: 'Bar in dresi',
  sponzorji: 'Sponzorji',
  bonusi: 'Bonusi sponzorjev',
};
export const EXPENSE_LABELS: Record<string, string> = {
  place: 'Plače',
  led: 'Najem ledu',
  potovanja: 'Potovanja',
  stab: 'Štab',
  mladinci: 'Mladinska šola',
  odpravnine: 'Odpravnine',
};

const SPONSORS = ['Gorenjska banka', 'Sava Turizem', 'Petrol', 'Telemach', 'Mercator', 'Generali', 'Lidl', 'Hervis', 'Elektro Gorenjska', 'Triglav zavarovalnica', 'Agrokor', 'Podravka', 'Konzum', 'NIS', 'Telekom Srbija', 'mts'];

export const refPrice = (club: Club) => Math.round(3 + club.reputation / 20);

export function clubWages(state: GameState, clubId: string) {
  return Object.values(state.players).filter((p) => p.clubId === clubId).reduce((s, p) => s + p.wage, 0);
}

export function makeFinance(state: GameState, club: Club, rng: Rng): ClubFinance {
  const wages = clubWages(state, club.id);
  const ref = refPrice(club);
  return {
    balance: 15000 + club.budget * 12000 + rng.int(0, 5000),
    wageBudget: Math.round((wages * (1.05 + club.budget * 0.03)) / 100) * 100,
    prices: { regular: ref, derby: ref + 3, playoff: ref + 4 },
    sponsor: makeSponsor(club, rng),
    ledger: {},
  };
}

export function makeSponsor(club: Club, rng: Rng) {
  const pool = SPONSORS.filter((_, i) => (club.country === 'SLO' ? i < 10 : club.country === 'HR' ? i >= 10 && i < 14 : i >= 14) || i % 3 === 0);
  return {
    name: rng.pick(pool),
    monthly: Math.round((club.reputation * 55 + club.budget * 400) / 100) * 100,
    playoffBonus: Math.round(club.reputation * 40 / 100) * 100,
    titleBonus: Math.round(club.reputation * 120 / 100) * 100,
  };
}

export function ensureFinance(state: GameState) {
  if (!state.finance) state.finance = {};
  const rng = new Rng(state.seed + 99);
  for (const c of state.clubs) if (!state.finance[c.id]) state.finance[c.id] = makeFinance(state, c, rng);
  if (!Object.values(state.players).some((p) => p.clubId === null)) addFreeAgents(state, 36);
}

export function book(state: GameState, clubId: string, key: string, amount: number) {
  const fin = state.finance?.[clubId];
  if (!fin || !amount) return;
  const month = state.date.slice(0, 7);
  fin.ledger[month] = fin.ledger[month] ?? {};
  fin.ledger[month][key] = (fin.ledger[month][key] ?? 0) + amount;
  fin.balance += amount;
}

const DERBY: string[][] = [['czv', 'par'], ['med', 'zag', 'mla'], ['tri', 'sla', 'cel']];
export const isDerby = (a: string, b: string) => DERBY.some((g) => g.includes(a) && g.includes(b));

export function ticketPrice(state: GameState, f: Fixture) {
  const fin = state.finance?.[f.home];
  const club = state.clubs.find((c) => c.id === f.home)!;
  if (!fin) return refPrice(club);
  if (f.stage !== 'redni') return fin.prices.playoff;
  if (isDerby(f.home, f.away)) return fin.prices.derby;
  return fin.prices.regular;
}

// pričakovan obisk (brez naključja) za prikaz in izračun
export function expectedAttendance(state: GameState, f: Fixture, price = ticketPrice(state, f), standingPos?: number) {
  const home = state.clubs.find((c) => c.id === f.home)!;
  const away = state.clubs.find((c) => c.id === f.away)!;
  const pos = standingPos ?? 4;
  let fill = 0.26 + home.reputation / 180 + (9 - pos) * 0.012 + away.reputation / 600;
  if (isDerby(f.home, f.away)) fill += 0.2;
  if (f.stage !== 'redni') fill += 0.15 + (f.stage === 'finale' ? 0.2 : 0);
  const ref = refPrice(home) + (isDerby(f.home, f.away) ? 2 : 0) + (f.stage !== 'redni' ? 3 : 0);
  fill *= clamp(Math.pow(ref / Math.max(1, price), 1.1), 0.15, 1.5);
  return Math.round(home.arena.capacity * clamp(fill, 0.05, 1));
}

export function matchFinances(state: GameState, f: Fixture, attendance: number) {
  const price = ticketPrice(state, f);
  book(state, f.home, 'vstopnice', attendance * price);
  book(state, f.home, 'bar', Math.round(attendance * 2));
  const h = state.clubs.find((c) => c.id === f.home)!;
  const a = state.clubs.find((c) => c.id === f.away)!;
  const travel = h.city === a.city ? 0 : h.country === a.country ? 350 : 1100;
  book(state, f.away, 'potovanja', -travel);
}

export function monthlyFinances(state: GameState) {
  for (const c of state.clubs) {
    const fin = state.finance?.[c.id];
    if (!fin) continue;
    book(state, c.id, 'place', -clubWages(state, c.id));
    book(state, c.id, 'led', -(1800 + c.budget * 350));
    book(state, c.id, 'stab', -(1200 + c.budget * 300));
    book(state, c.id, 'mladinci', -(600 + c.budget * 200));
    // sponzor plačuje med septembrom in aprilom
    const m = Number(state.date.slice(5, 7));
    if (m >= 9 || m <= 4) book(state, c.id, 'sponzorji', fin.sponsor.monthly);
  }
}

// --- trg prostih igralcev ---
export function addFreeAgents(state: GameState, n: number) {
  const rng = new Rng(state.seed + 7 + n);
  const countries = ['SLO', 'HR', 'SRB'] as const;
  const positions = ['C', 'LW', 'RW', 'D', 'D', 'C', 'LW', 'RW', 'G'] as const;
  for (let i = 0; i < n; i++) {
    const pos = positions[i % positions.length];
    const roll = rng.next();
    // veterani, mladi, igralci od zunaj (AI)
    const age = roll < 0.3 ? rng.int(30, 35) : roll < 0.55 ? rng.int(18, 21) : rng.int(22, 29);
    const importPlayer = rng.chance(0.3);
    const base = rng.int(46, 63) + (importPlayer ? 2 : 0);
    const p = makePlayer(rng, { pos, base, clubId: null, country: rng.pick(countries), seasonYear: state.seasonYear, age, importPlayer, isAI: true });
    p.wage = wageDemand(p, rng);
    p.contractUntil = state.seasonYear;
    state.players[p.id] = p;
  }
}

export function wageDemand(p: Player, rng?: Rng) {
  const base = Math.max(100, (p.ovr - 38) * 32);
  const f = rng ? 1 + rng.next() * 0.3 : 1.15;
  return Math.round((base * f) / 50) * 50;
}

export type Interest = 'visok' | 'srednji' | 'nizek' | 'ne pride';
export function interestIn(state: GameState, p: Player, clubId: string): Interest {
  const club = state.clubs.find((c) => c.id === clubId)!;
  const gap = p.ovr - club.reputation;
  if (gap > 14) return 'ne pride';
  if (gap > 8) return 'nizek';
  if (gap > 0) return 'srednji';
  return 'visok';
}

export const freeAgents = (state: GameState) => Object.values(state.players).filter((p) => p.clubId === null);

export function offerContract(state: GameState, playerId: string, wage: number, years: number): { accepted: boolean; text: string } {
  const p = state.players[playerId];
  const clubId = state.userClubId;
  const fin = state.finance[clubId];
  const rng = new Rng(state.seed++);
  if (!p || p.clubId !== null) return { accepted: false, text: 'Igralec ni več prost.' };
  const roster = Object.values(state.players).filter((x) => x.clubId === clubId);
  if (roster.length >= 30) return { accepted: false, text: 'Kader je poln (največ 30 igralcev). Najprej koga odpusti.' };
  if (clubWages(state, clubId) + wage > fin.wageBudget) return { accepted: false, text: `Presežen proračun za plače (${fin.wageBudget.toLocaleString('sl-SI')} €/mes).` };
  const interest = interestIn(state, p, clubId);
  const need = p.wage * (interest === 'ne pride' ? 1.9 : interest === 'nizek' ? 1.25 : interest === 'srednji' ? 1.05 : 0.95);
  const yearsOk = p.birthYear > state.seasonYear - 31 || years <= 2;
  const chance = clamp(0.5 + (wage - need) / Math.max(150, need) * 2.2, 0.03, 0.97) * (yearsOk ? 1 : 0.6);
  if (rng.chance(chance)) {
    p.clubId = clubId;
    p.wage = wage;
    p.contractUntil = state.seasonYear + years;
    p.morale = 75;
    const used = new Set(roster.map((x) => x.number));
    while (used.has(p.number)) p.number = rng.int(2, 98);
    return { accepted: true, text: `${p.first} ${p.last} je podpisal pogodbo do ${p.contractUntil} za ${wage} €/mes.` };
  }
  p.wage = Math.round((p.wage * 1.08) / 50) * 50;
  return { accepted: false, text: `${p.first} ${p.last} je ponudbo zavrnil. Pričakuje več (okoli ${Math.round(need * 1.08 / 50) * 50} €/mes).` };
}

export function releasePlayer(state: GameState, playerId: string): { ok: boolean; text: string } {
  const p = state.players[playerId];
  if (!p || p.clubId !== state.userClubId) return { ok: false, text: 'Igralec ni v tvojem klubu.' };
  const roster = Object.values(state.players).filter((x) => x.clubId === state.userClubId);
  if (p.pos === 'G' && roster.filter((x) => x.pos === 'G').length <= 2) return { ok: false, text: 'Potrebuješ vsaj dva golmana.' };
  if (roster.length <= 20) return { ok: false, text: 'Kader mora imeti vsaj 20 igralcev.' };
  const cost = p.wage * 2;
  book(state, state.userClubId, 'odpravnine', -cost);
  p.clubId = null;
  p.wage = wageDemand(p);
  p.contractUntil = state.seasonYear;
  return { ok: true, text: `${p.first} ${p.last} je odpuščen. Odpravnina: ${cost} €.` };
}

// AI klubi enkrat na teden dopolnijo kader
export function aiSignings(state: GameState): string[] {
  const out: string[] = [];
  const rng = new Rng(state.seed++);
  for (const c of state.clubs) {
    if (c.id === state.userClubId) continue;
    const roster = Object.values(state.players).filter((p) => p.clubId === c.id && p.injuryDays <= 0);
    const need: ('F' | 'D' | 'G')[] = [];
    if (roster.filter((p) => ['C', 'LW', 'RW'].includes(p.pos)).length < 13) need.push('F');
    if (roster.filter((p) => p.pos === 'D').length < 7) need.push('D');
    if (roster.filter((p) => p.pos === 'G').length < 2) need.push('G');
    if (!need.length || !rng.chance(0.6)) continue;
    const want = need[0];
    const fin = state.finance[c.id];
    const cands = freeAgents(state)
      .filter((p) => (want === 'F' ? ['C', 'LW', 'RW'].includes(p.pos) : p.pos === want))
      .filter((p) => interestIn(state, p, c.id) !== 'ne pride' && clubWages(state, c.id) + p.wage <= fin.wageBudget * 1.1)
      .sort((a, b) => b.ovr - a.ovr);
    const p = cands[0];
    if (!p) continue;
    p.clubId = c.id;
    p.contractUntil = state.seasonYear + rng.int(1, 2);
    out.push(`${c.short} je podpisal ${p.first} ${p.last} (${p.pos}, ocena ${p.ovr}).`);
  }
  return out;
}

export { CLUBS };
