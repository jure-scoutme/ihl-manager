import { addStory } from './achievements';
import { book, clubWages, interestIn, wageDemand } from './finance';
import { Rng, clamp } from './rng';
import type { GameState, Player } from './types';

// Prestopi igralcev med klubi: ponudba klubu (odškodnina), nato pogodba z igralcem.

export function transferValue(state: GameState, p: Player): number {
  const age = state.seasonYear - p.birthYear;
  let v = Math.max(0, p.ovr - 40) ** 2 * 55;
  v *= age <= 22 ? 1.35 : age <= 26 ? 1.15 : age <= 30 ? 1 : age <= 33 ? 0.65 : 0.4;
  v *= 1 + Math.max(0, p.potential - p.ovr) / 40;
  const yearsLeft = Math.max(0, p.contractUntil - state.seasonYear);
  v *= 0.6 + 0.2 * Math.min(3, yearsLeft);
  if (p.listed) v *= 0.7;
  return Math.max(1000, Math.round(v / 500) * 500);
}

function isKeyPlayer(state: GameState, p: Player) {
  const mates = Object.values(state.players).filter((x) => x.clubId === p.clubId && x.pos === p.pos).sort((a, b) => b.ovr - a.ovr);
  const idx = mates.findIndex((x) => x.id === p.id);
  return p.pos === 'G' ? idx === 0 : p.pos === 'D' ? idx < 2 : idx < 2;
}

export type ClubResponse = { status: 'sprejeto' | 'protiponudba' | 'zavrnjeno'; text: string; fee?: number };

export function offerToClub(state: GameState, playerId: string, fee: number): ClubResponse {
  const p = state.players[playerId];
  if (!p || !p.clubId || p.clubId === state.userClubId) return { status: 'zavrnjeno', text: 'Igralec ni na voljo.' };
  const seller = state.clubs.find((c) => c.id === p.clubId)!;
  const fin = state.finance[state.userClubId];
  if (fin.balance < fee) return { status: 'zavrnjeno', text: `Na računu nimaš dovolj denarja (${Math.round(fin.balance).toLocaleString('sl-SI')} €).` };
  const roster = Object.values(state.players).filter((x) => x.clubId === seller.id);
  if (p.pos === 'G' && roster.filter((x) => x.pos === 'G').length <= 2) return { status: 'zavrnjeno', text: `${seller.short} ne proda golmana, ker bi jim ostal samo eden.` };
  if (roster.length <= 21) return { status: 'zavrnjeno', text: `${seller.short} ima premajhen kader in igralca ne proda.` };
  const value = transferValue(state, p);
  const key = isKeyPlayer(state, p);
  const rich = (state.finance[seller.id]?.balance ?? 0) > 150000;
  const required = Math.round((value * (key ? 1.5 : 1.1) * (rich ? 1.15 : 1) * (p.listed ? 0.85 : 1)) / 500) * 500;
  const rng = new Rng(state.seed++);
  if (fee >= required || (fee >= required * 0.92 && rng.chance(0.4))) {
    state.agreedFees = { ...(state.agreedFees ?? {}), [p.id]: fee };
    return { status: 'sprejeto', fee, text: `${seller.short} sprejema ponudbo ${fee.toLocaleString('sl-SI')} €. Zdaj se dogovori za pogodbo z igralcem.` };
  }
  if (fee >= required * 0.7) {
    return { status: 'protiponudba', fee: required, text: `${seller.short} zavrača, a bi igralca prodal za ${required.toLocaleString('sl-SI')} €.` };
  }
  return { status: 'zavrnjeno', text: key ? `${seller.short}: "${p.first} ${p.last} je ključni igralec, ponudba je preskromna."` : `${seller.short} ponudbo zavrača kot prenizko.` };
}

export function transferWageDemand(state: GameState, p: Player) {
  return Math.max(Math.round((p.wage * 1.15) / 50) * 50, wageDemand(p));
}

export function offerTransferContract(state: GameState, playerId: string, wage: number, years: number): { accepted: boolean; text: string } {
  const p = state.players[playerId];
  const fee = state.agreedFees?.[playerId];
  if (!p || fee === undefined || !p.clubId) return { accepted: false, text: 'Najprej se dogovori s klubom.' };
  const fin = state.finance[state.userClubId];
  const myRoster = Object.values(state.players).filter((x) => x.clubId === state.userClubId);
  if (myRoster.length >= 30) return { accepted: false, text: 'Kader je poln (30).' };
  if (fin.balance < fee) return { accepted: false, text: 'Na računu ni več dovolj denarja za odškodnino.' };
  if (clubWages(state, state.userClubId) + wage > fin.wageBudget) return { accepted: false, text: `Presežen proračun za plače (${fin.wageBudget.toLocaleString('sl-SI')} €/mes).` };
  const from = state.clubs.find((c) => c.id === p.clubId)!;
  const to = state.clubs.find((c) => c.id === state.userClubId)!;
  const interest = interestIn(state, p, to.id);
  const demand = transferWageDemand(state, p);
  const repGap = to.reputation - from.reputation; // v boljši klub gre rad
  let need = demand * (interest === 'ne pride' ? 1.9 : interest === 'nizek' ? 1.25 : interest === 'srednji' ? 1.05 : 0.95);
  need *= clamp(1 - repGap / 60, 0.8, 1.35);
  if (p.personality === 'zvest') need *= 1.2;
  if (p.personality === 'ambiciozen' && repGap > 0) need *= 0.9;
  const rng = new Rng(state.seed++);
  const chance = clamp(0.5 + ((wage - need) / Math.max(150, need)) * 2.2, 0.03, 0.97);
  if (!rng.chance(chance)) return { accepted: false, text: `${p.first} ${p.last} zavrača. Pričakuje okoli ${Math.round((need * 1.05) / 50) * 50} €/mes.` };
  book(state, to.id, 'nakupi', -fee);
  book(state, from.id, 'prodaje', fee);
  p.clubId = to.id;
  p.wage = wage;
  p.contractUntil = state.seasonYear + years;
  p.listed = false;
  p.morale = 78;
  p.benchStreak = 0;
  const used = new Set(myRoster.map((x) => x.number));
  while (used.has(p.number)) p.number = rng.int(2, 98);
  delete state.agreedFees![playerId];
  state.counters = { buys: (state.counters?.buys ?? 0) + 1, frees: state.counters?.frees ?? 0 };
  addStory(state, p, `Prestop iz ${from.short} za ${fee.toLocaleString('sl-SI')} €`);
  return { accepted: true, text: `Prestop je uradno potrjen: ${p.first} ${p.last} prihaja iz ${from.short} za ${fee.toLocaleString('sl-SI')} €. Pogodba do ${p.contractUntil}, ${wage} €/mes.` };
}

export function cancelTransfer(state: GameState, playerId: string) {
  if (state.agreedFees) delete state.agreedFees[playerId];
}
