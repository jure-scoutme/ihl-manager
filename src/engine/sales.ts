// Prodaja igralcev: ponudbe IHL klubov in klubov iz tujine.
import { addStory, unlock } from './achievements';
import { transferWindow } from './contracts';
import { book, clubWages, wageDemand } from './finance';
import { Rng, clamp } from './rng';
import { transferValue } from './transfers';
import type { GameState, Player } from './types';

export interface ForeignLeague {
  id: string;
  name: string;
  minOvr: number;
  maxFee: number;
  clubs: string[];
}

// lige v tujini (resnična imena klubov, samo za novice in zgodovino igralcev)
export const FOREIGN: ForeignLeague[] = [
  { id: 'erste', name: 'Erste Liga', minOvr: 60, maxFee: 5000, clubs: ['FTC-Telekom', 'UTE Budapest', 'DVTK Jegesmedvék', 'Gyergyói HK', 'Corona Brașov'] },
  { id: 'alps', name: 'Alps Hockey League', minOvr: 63, maxFee: 9000, clubs: ['HDD SIJ Acroni Jesenice', 'Migross Asiago', 'Rittner Buam', 'SG Cortina', 'HC Gherdëina', 'EK Zell am See', 'EC Kitzbühel', 'Red Bull Hockey Juniors'] },
  { id: 'del2', name: 'DEL2', minOvr: 67, maxFee: 15000, clubs: ['Eispiraten Crimmitschau', 'Ravensburg Towerstars', 'Kassel Huskies', 'Krefeld Pinguine', 'Starbulls Rosenheim'] },
  { id: 'icehl', name: 'ICE Hockey League', minOvr: 69, maxFee: 25000, clubs: ['HK Olimpija Ljubljana', 'EC KAC', 'EC Red Bull Salzburg', 'Vienna Capitals', 'Graz99ers', 'EC VSV', 'HC Bolzano', 'HC Pustertal', 'Fehérvár AV19', 'Black Wings Linz'] },
  { id: 'svk', name: 'Tipos Extraliga', minOvr: 70, maxFee: 20000, clubs: ['HC Slovan Bratislava', 'HC Košice', 'HK Nitra', 'HK Poprad', 'HC 05 Banská Bystrica'] },
  { id: 'alls', name: 'HockeyAllsvenskan', minOvr: 71, maxFee: 22000, clubs: ['AIK', 'Mora IK', 'IF Björklöven', 'Södertälje SK', 'BIK Karlskoga'] },
  { id: 'cze', name: 'Tipsport Extraliga', minOvr: 74, maxFee: 40000, clubs: ['HC Sparta Praha', 'HC Oceláři Třinec', 'Bílí Tygři Liberec', 'HC Dynamo Pardubice', 'HC Kometa Brno'] },
  { id: 'liiga', name: 'Liiga', minOvr: 77, maxFee: 60000, clubs: ['Tappara', 'HIFK', 'Kärpät', 'Lukko', 'TPS'] },
];

export interface SaleOffer {
  id: string;
  buyer: string;
  buyerId?: string; // IHL klub
  league?: string; // tuja liga
  fee: number;
  sellOn?: number;
  expires: string;
}
export interface SaleListing {
  asking: number | null;
  until: string;
  offers: SaleOffer[];
}

const news = (s: GameState, kind: 'mediji' | 'prestopi', title: string, body: string) =>
  s.news.unshift({ id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, date: s.date, kind, title, body, read: false });
const addDays = (d: string, n: number) => {
  const x = new Date(d + 'T12:00:00Z');
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const fmt = (n: number) => n.toLocaleString('sl-SI');

export const listing = (s: GameState, id: string) => s.sales?.[id];

export function listForSale(s: GameState, id: string, asking: number | null): { ok: boolean; text: string } {
  const p = s.players[id];
  if (!p || p.clubId !== s.userClubId) return { ok: false, text: 'Igralec ni v tvojem klubu.' };
  if (!transferWindow(s).open) return { ok: false, text: 'Igralce lahko prodajaš le v prestopnem roku.' };
  s.sales = s.sales ?? {};
  s.sales[id] = { asking, until: addDays(s.date, 14), offers: s.sales[id]?.offers ?? [] };
  if (asking) return { ok: true, text: `${p.first} ${p.last} je ponujen klubom za ${fmt(asking)} €. Ponudbe pričakuj v naslednjih dveh tednih.` };
  return { ok: true, text: `${p.first} ${p.last} je ponujen klubom. Ponudbe pričakuj v naslednjih dveh tednih.` };
}

export function withdrawSale(s: GameState, id: string) {
  if (s.sales) delete s.sales[id];
}

function contractFactor(s: GameState, p: Player) {
  const left = p.contractUntil - s.seasonYear;
  return left <= 0 ? 0.3 : left === 1 ? 0.75 : 1;
}

// možni kupci za igralca
function buyers(s: GameState, p: Player, rng: Rng): Omit<SaleOffer, 'id' | 'expires'>[] {
  const out: Omit<SaleOffer, 'id' | 'expires'>[] = [];
  const age = s.seasonYear - p.birthYear;
  const value = transferValue(s, p) * contractFactor(s, p);
  // IHL klubi
  for (const c of s.clubs) {
    if (c.id === s.userClubId) continue;
    const roster = Object.values(s.players).filter((x) => x.clubId === c.id);
    const samePos = roster.filter((x) => (p.pos === 'G' ? x.pos === 'G' : p.pos === 'D' ? x.pos === 'D' : ['C', 'LW', 'RW'].includes(x.pos))).sort((a, b) => b.ovr - a.ovr);
    const slot = p.pos === 'G' ? 1 : p.pos === 'D' ? 4 : 7;
    const upgrade = p.ovr > (samePos[slot]?.ovr ?? 0) + 1;
    const bal = s.finance[c.id]?.balance ?? 0;
    const fee = Math.round((value * (0.8 + rng.next() * 0.35)) / 500) * 500;
    if (upgrade && roster.length < 29 && bal > fee * 1.6 && clubWages(s, c.id) + p.wage <= (s.finance[c.id]?.wageBudget ?? 0) * 1.15) out.push({ buyer: c.name, buyerId: c.id, fee: Math.max(500, fee) });
  }
  // tuji klubi
  for (const L of FOREIGN) {
    const bonus = age <= 21 && p.potential >= L.minOvr + 3 ? 4 : 0;
    if (p.ovr + bonus < L.minOvr) continue;
    if (age >= 32 && L.minOvr >= 70) continue;
    const quality = clamp((p.ovr + bonus - L.minOvr + 4) / 12, 0.2, 1);
    const fee = Math.round((Math.min(L.maxFee * quality, value * 1.3) * contractFactor(s, p) * (0.85 + rng.next() * 0.3)) / 500) * 500;
    out.push({ buyer: rng.pick(L.clubs), league: L.name, fee: Math.max(0, fee) });
  }
  return out;
}

// dnevno: nove ponudbe za ponujene igralce
export function salesDay(s: GameState) {
  if (!s.sales) return;
  const rng = new Rng(s.seed + Number(s.date.replace(/-/g, '')) + 77);
  for (const [id, l] of Object.entries(s.sales)) {
    const p = s.players[id];
    if (!p || p.clubId !== s.userClubId) {
      delete s.sales[id];
      continue;
    }
    l.offers = l.offers.filter((o) => o.expires >= s.date);
    if (s.date > l.until && !l.offers.length) {
      delete s.sales[id];
      news(s, 'prestopi', `Ni zanimanja za igralca ${p.first} ${p.last}`, 'V dveh tednih ni prispela nobena ustrezna ponudba. Igralec ostaja v klubu.');
      continue;
    }
    if (s.date > l.until || !transferWindow(s).open || l.offers.length >= 3 || !rng.chance(0.22)) continue;
    const cands = buyers(s, p, rng).filter((b) => !l.offers.some((o) => o.buyer === b.buyer));
    if (!cands.length) continue;
    const c = rng.pick(cands);
    if (l.asking && c.fee < l.asking * 0.65) continue;
    const sellOn = c.league && rng.chance(0.35) ? 15 : undefined;
    const offer: SaleOffer = { ...c, id: `o${Date.now().toString(36)}${rng.int(0, 999)}`, fee: sellOn ? Math.round((c.fee * 0.8) / 500) * 500 : c.fee, sellOn, expires: addDays(s.date, 5) };
    l.offers.push(offer);
    const who = offer.league ? `${offer.buyer} (${offer.league})` : offer.buyer;
    if (sellOn) news(s, 'mediji', `Ponudba za igralca ${p.first} ${p.last}`, `${who} ponuja ${fmt(offer.fee)} € in ${sellOn} % od nadaljnje prodaje. Odloči se na strani igralca.`);
    else news(s, 'mediji', `Ponudba za igralca ${p.first} ${p.last}`, `${who} ponuja ${fmt(offer.fee)} €. Odloči se na strani igralca.`);
  }
}

// tedensko v prestopnem roku: nepovabljene ponudbe iz tujine za najboljše
export function unsolicitedOffers(s: GameState) {
  if (!transferWindow(s).open) return;
  const rng = new Rng(s.seed + Number(s.date.replace(/-/g, '')) + 91);
  for (const p of Object.values(s.players).filter((x) => x.clubId === s.userClubId)) {
    if (s.sales?.[p.id] || s.seasonYear - p.birthYear > 28) continue;
    const foreign = buyers(s, p, rng).filter((b) => b.league && b.fee > 0);
    if (!foreign.length || !rng.chance(0.05)) continue;
    const c = foreign.sort((a, b) => b.fee - a.fee)[0];
    s.sales = s.sales ?? {};
    s.sales[p.id] = { asking: null, until: addDays(s.date, 5), offers: [{ ...c, id: `o${Date.now().toString(36)}${rng.int(0, 999)}`, expires: addDays(s.date, 5) }] };
    news(s, 'mediji', `Ponudba iz tujine za igralca ${p.first} ${p.last}`, `${c.buyer} (${c.league}) želi igralca ${p.first} ${p.last} in ponuja ${fmt(c.fee)} €. Odloči se v 5 dneh na strani igralca.`);
  }
}

export function rejectOffer(s: GameState, id: string, offerId: string) {
  const l = s.sales?.[id];
  if (l) l.offers = l.offers.filter((o) => o.id !== offerId);
}

export function counterOffer(s: GameState, id: string, offerId: string, fee: number): { ok: boolean; text: string } {
  const l = s.sales?.[id];
  const o = l?.offers.find((x) => x.id === offerId);
  if (!l || !o) return { ok: false, text: 'Ponudba ne velja več.' };
  const rng = new Rng(s.seed++);
  const ratio = fee / Math.max(500, o.fee);
  if (ratio <= 1.05 || (ratio <= 1.3 && rng.chance(1.4 - ratio))) {
    o.fee = fee;
    return { ok: true, text: `${o.buyer} sprejema protiponudbo ${fmt(fee)} €. Zdaj lahko prodajo potrdiš.` };
  }
  l.offers = l.offers.filter((x) => x.id !== offerId);
  return { ok: false, text: `${o.buyer} se je umaknil, ker je protiponudba previsoka.` };
}

export function acceptOffer(s: GameState, id: string, offerId: string): { ok: boolean; text: string } {
  const p = s.players[id];
  const l = s.sales?.[id];
  const o = l?.offers.find((x) => x.id === offerId);
  if (!p || !l || !o) return { ok: false, text: 'Ponudba ne velja več.' };
  if (!transferWindow(s).open) return { ok: false, text: 'Prestopni rok je zaprt.' };
  const roster = Object.values(s.players).filter((x) => x.clubId === s.userClubId);
  if (roster.length <= 20) return { ok: false, text: 'Kader mora imeti vsaj 20 igralcev.' };
  if (p.pos === 'G' && roster.filter((x) => x.pos === 'G').length <= 2) return { ok: false, text: 'Potrebuješ vsaj dva golmana.' };
  const rng = new Rng(s.seed++);
  // igralec se mora strinjati
  if (o.league && p.personality === 'zvest' && p.homegrown === s.userClubId && rng.chance(0.5)) {
    l.offers = l.offers.filter((x) => x.id !== offerId);
    return { ok: false, text: `${p.first} ${p.last} noče zapustiti domačega kluba. Ponudbo je zavrnil.` };
  }
  const from = s.clubs.find((c) => c.id === s.userClubId)!;
  book(s, s.userClubId, 'prodaje', o.fee);
  delete s.sales![id];
  for (const k of Object.keys(s.agreedFees ?? {})) if (k === id) delete s.agreedFees![k];
  p.listed = false;
  p.loan = undefined;
  if (o.buyerId) {
    book(s, o.buyerId, 'nakupi', -o.fee);
    p.clubId = o.buyerId;
    p.contractUntil = s.seasonYear + 2;
    p.wage = Math.max(p.wage, wageDemand(p));
    addStory(s, p, `Prestop iz ${from.short} v ${s.clubs.find((c) => c.id === o.buyerId)!.short} za ${fmt(o.fee)} €`);
  } else {
    p.clubId = null;
    p.abroad = { club: o.buyer, league: o.league ?? '', since: s.seasonYear };
    if (o.sellOn) p.sellOn = { clubId: s.userClubId, pct: o.sellOn };
    addStory(s, p, `Odšel v tujino: ${o.buyer} (${o.league}) za ${fmt(o.fee)} €`);
    unlock(s, 'izvoz');
  }
  s.counters = { buys: s.counters?.buys ?? 0, frees: s.counters?.frees ?? 0, sales: (s.counters?.sales ?? 0) + 1 };
  if (p.homegrown === s.userClubId) s.fans = clamp((s.fans ?? 50) - 2, 0, 100);
  return { ok: true, text: `${p.first} ${p.last} je prodan klubu ${o.buyer} za ${fmt(o.fee)} €.` };
}

// poletje: igralci iz tujine se lahko vrnejo; najboljši AI igralci odidejo v tujino
export function abroadSeason(s: GameState) {
  const rng = new Rng(s.seed + s.seasonYear * 13);
  for (const p of Object.values(s.players)) {
    if (p.abroad && s.seasonYear - p.abroad.since >= 2 && rng.chance(0.2)) {
      const was = p.abroad.club;
      p.abroad = undefined;
      p.contractUntil = s.seasonYear;
      p.wage = wageDemand(p);
      if (p.homegrown === s.userClubId || p.story?.some((x) => x.text.startsWith('Odšel v tujino'))) {
        news(s, 'prestopi', `${p.first} ${p.last} se vrača iz tujine`, `Po letih v klubu ${was} je ${p.first} ${p.last} prost igralec in se želi vrniti v IHL.`);
      }
      addStory(s, p, `Vrnil se iz tujine (${was}), prost igralec`);
    }
  }
  // igralci v tujini z deležem od nadaljnje prodaje lahko prestopijo v močnejši klub
  for (const p of Object.values(s.players)) {
    if (!p.abroad || !p.sellOn || p.sellOn.clubId !== s.userClubId) continue;
    const cur = FOREIGN.findIndex((x) => x.name === p.abroad!.league);
    const next = FOREIGN.slice(cur + 1).find((x) => p.ovr >= x.minOvr - 1);
    if (!next || !rng.chance(0.3)) continue;
    const fee = Math.round((next.maxFee * 0.6) / 500) * 500;
    const cut = Math.round((fee * p.sellOn.pct) / 100);
    book(s, s.userClubId, 'prodaje', cut);
    const club = rng.pick(next.clubs);
    news(s, 'prestopi', `${p.first} ${p.last} prestopa v ${next.name}`, `${p.first} ${p.last} je iz kluba ${p.abroad.club} prestopil v ${club}. Tvoj klub prejme ${p.sellOn.pct} % odškodnine: ${fmt(cut)} €.`);
    p.abroad = { club, league: next.name, since: s.seasonYear };
    p.sellOn = undefined;
  }
  // odhodi najboljših iz AI klubov
  for (const p of Object.values(s.players)) {
    if (!p.clubId || p.clubId === s.userClubId || p.loan) continue;
    const age = s.seasonYear - p.birthYear;
    const L = [...FOREIGN].reverse().find((x) => p.ovr >= x.minOvr);
    if (!L || L.minOvr < 69 || age > 28 || !rng.chance(0.18)) continue;
    const fee = Math.round(Math.min(L.maxFee, transferValue(s, p)) / 500) * 500;
    const from = s.clubs.find((c) => c.id === p.clubId)!;
    book(s, from.id, 'prodaje', fee);
    if (p.sellOn?.clubId === s.userClubId) {
      const cut = Math.round((fee * p.sellOn.pct) / 100);
      book(s, s.userClubId, 'prodaje', cut);
      news(s, 'prestopi', 'Delež od nadaljnje prodaje', `${p.first} ${p.last} je odšel iz kluba ${from.short} v tujino. Tvoj klub prejme ${p.sellOn.pct} % odškodnine: ${fmt(cut)} €.`);
    }
    const club = rng.pick(L.clubs);
    p.clubId = null;
    p.abroad = { club, league: L.name, since: s.seasonYear };
    p.sellOn = undefined;
    news(s, 'prestopi', `${p.first} ${p.last} odhaja v tujino`, `${from.short} je prodal igralca ${p.first} ${p.last} klubu ${club} (${L.name}).`);
  }
}
