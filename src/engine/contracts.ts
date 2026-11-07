// Pogodbe: podaljševanje, iztek (30. junij), prestopna okna.
import { addStory } from './achievements';
import { clubWages, wageDemand } from './finance';
import { Rng, clamp } from './rng';
import type { GameState, Player } from './types';

const news = (s: GameState, kind: 'prestopi' | 'garderoba' | 'liga', title: string, body: string) =>
  s.news.unshift({ id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, date: s.date, kind, title, body, read: false });

// pogodba z letnico Y velja do 30. junija leta Y+1 (konec sezone Y/Y+1)
export const expiresThisSeason = (s: GameState, p: Player) => p.contractUntil <= s.seasonYear && (s.phase !== 'poletje' || s.date < `${s.seasonYear}-07-01`);
export const expiring = (s: GameState) =>
  Object.values(s.players).filter((p) => p.clubId === s.userClubId && (s.phase === 'poletje' ? p.contractUntil < s.seasonYear : p.contractUntil <= s.seasonYear));

// prestopna okna za prestope med klubi; proste igralce lahko podpišeš kadarkoli
export function transferWindow(s: GameState): { open: boolean; label: string; closes?: string } {
  const md = s.date.slice(5);
  if (s.phase === 'poletje' && md <= '08-31') return { open: true, label: 'Poletni prestopni rok', closes: `${s.seasonYear}-08-31` };
  if (s.phase === 'redni' && (md >= '12-01' || md <= '01-31')) {
    const y = md >= '12-01' ? Number(s.date.slice(0, 4)) + 1 : Number(s.date.slice(0, 4));
    return { open: true, label: 'Zimski prestopni rok', closes: `${y}-01-31` };
  }
  return { open: false, label: s.phase === 'koncnica' || (md > '01-31' && md < '08-01') ? 'Prestopni rok je zaprt do poletja' : 'Prestopni rok je zaprt do 1. decembra' };
}

export interface RenewalAsk {
  wage: number;
  years: number;
  willing: boolean;
  reason: string;
}

// kaj zahteva agent igralca
export function renewalAsk(s: GameState, p: Player): RenewalAsk {
  const age = s.seasonYear - p.birthYear;
  const base = wageDemand(p);
  const club = s.clubs.find((c) => c.id === s.userClubId)!;
  let mult = 1.08;
  let reason = 'Agent pričakuje rahel dvig plače.';
  const gp = p.stats.gp;
  if (p.morale < 40) {
    mult += 0.25;
    reason = 'Igralec ni zadovoljen v klubu, zato agent zahteva precej več.';
  } else if ((p.benchStreak ?? 0) >= 4 && age < 30) {
    mult += 0.15;
    reason = 'Igralec premalo igra in razmišlja o odhodu.';
  } else if (gp >= 10 && (p.form >= 1 || p.stats.g + p.stats.a >= gp * 0.8)) {
    mult += 0.15;
    reason = 'Odlična sezona, agent ve, koliko je vreden.';
  }
  if (p.personality === 'zvest') mult -= 0.1;
  if (p.personality === 'ambiciozen' && p.ovr > club.reputation + 3) mult += 0.15;
  if (age >= 32) mult -= 0.1;
  const willing = !(p.personality === 'ambiciozen' && p.ovr > club.reputation + 10) && p.morale >= 25;
  if (!willing) reason = p.morale < 25 ? 'Igralec noče podaljšati pogodbe, ker je nezadovoljen.' : 'Igralec si želi v močnejši klub in ne bo podaljšal.';
  const years = age >= 31 ? 1 : age <= 23 ? 3 : 2;
  const ref = Math.max(p.wage, (p.wage + base) / 2);
  return { wage: Math.max(p.wage, Math.round((ref * mult) / 50) * 50), years, willing, reason };
}

export function offerRenewal(s: GameState, id: string, wage: number, years: number): { ok: boolean; text: string } {
  const p = s.players[id];
  if (!p || p.clubId !== s.userClubId) return { ok: false, text: 'Igralec ni v tvojem klubu.' };
  const ask = renewalAsk(s, p);
  if (!ask.willing) return { ok: false, text: ask.reason };
  const fin = s.finance[s.userClubId];
  if (clubWages(s, s.userClubId) - p.wage + wage > fin.wageBudget) return { ok: false, text: `Presežen proračun za plače (${fin.wageBudget.toLocaleString('sl-SI')} €/mes).` };
  const rng = new Rng(s.seed++);
  const yearsPenalty = Math.abs(years - ask.years) * 0.12;
  const chance = clamp(0.5 + ((wage - ask.wage) / Math.max(100, ask.wage)) * 3 - yearsPenalty, 0.02, 0.98);
  p.negotiations = (p.negotiations ?? 0) + 1;
  if (rng.chance(chance)) {
    p.wage = wage;
    p.contractUntil = Math.max(p.contractUntil, s.seasonYear) + years;
    p.morale = clamp(p.morale + 8, 0, 100);
    p.negotiations = 0;
    addStory(s, p, `Podaljšal pogodbo do ${p.contractUntil}`);
    return { ok: true, text: `${p.first} ${p.last} je podaljšal pogodbo do ${p.contractUntil} za ${wage} €/mes.` };
  }
  if (p.negotiations >= 3) {
    p.morale = clamp(p.morale - 10, 0, 100);
    return { ok: false, text: `Agent ${p.first} ${p.last}a je užaljen zaradi nizkih ponudb. Morala igralca je padla.` };
  }
  return { ok: false, text: `Agent ponudbo zavrača. Zahteva okoli ${ask.wage} €/mes za ${ask.years} ${ask.years === 1 ? 'leto' : 'leta'}.` };
}

// 1. julij: potekle pogodbe
export function expireContracts(s: GameState) {
  returnLoans(s);
  const rng = new Rng(s.seed + 31 + s.seasonYear);
  const left: string[] = [];
  for (const p of Object.values(s.players)) {
    if (!p.clubId || p.contractUntil >= s.seasonYear) continue;
    if (p.clubId === s.userClubId) {
      left.push(`${p.first} ${p.last}`);
      addStory(s, p, 'Odšel kot prost igralec po izteku pogodbe');
      p.clubId = null;
      p.wage = wageDemand(p, rng);
      p.contractUntil = s.seasonYear;
      continue;
    }
    const age = s.seasonYear - p.birthYear;
    if (rng.chance(age >= 33 ? 0.45 : 0.72)) {
      p.contractUntil = s.seasonYear + rng.int(0, 2);
      p.wage = Math.round(((p.wage + wageDemand(p)) / 2) / 50) * 50;
    } else {
      p.clubId = null;
      p.wage = wageDemand(p, rng);
      p.contractUntil = s.seasonYear;
    }
  }
  if (left.length) news(s, 'prestopi', 'Potekle pogodbe', `Klub so zapustili igralci, ki jim je potekla pogodba: ${left.join(', ')}.`);
  news(s, 'liga', 'Trg prostih igralcev je poln', 'Igralci, ki jim je potekla pogodba, so zdaj prosti. Okrepi se, preden jih podpišejo drugi.');
}

// opomniki za pogodbe (1. v mesecu)
export function contractReminders(s: GameState) {
  const m = s.date.slice(5, 7);
  if (!['02', '04', '06'].includes(m)) return;
  const list = expiring(s);
  if (!list.length) return;
  const names = list.map((p) => p.first + ' ' + p.last).join(', ');
  news(s, 'garderoba', `Pogodba poteče ${list.length} igralcem`, `30. junija poteče pogodba: ${names}. Podaljšaj jih na strani igralca, sicer odidejo brez odškodnine.`);
}

// novice ob odprtju/zaprtju prestopnega roka
export function windowNews(s: GameState) {
  const md = s.date.slice(5);
  if (md === '12-01' && s.phase === 'redni') news(s, 'liga', 'Zimski prestopni rok je odprt', 'Do 31. januarja lahko kupuješ igralce od drugih klubov. Po tem roku so mogoči le še podpisi prostih igralcev.');
  if (md === '01-31' && s.phase === 'redni') news(s, 'liga', 'Danes se zapre prestopni rok', 'Zadnji dan za prestope med klubi pred končnico.');
  if (md === '09-01') news(s, 'liga', 'Poletni prestopni rok je zaprt', 'Prestopi med klubi bodo spet mogoči 1. decembra. Proste igralce lahko podpišeš kadarkoli.');
}

// ---------- posoje ----------
export function loanTargets(s: GameState, p: Player) {
  return s.clubs
    .filter((c) => c.id !== s.userClubId)
    .filter((c) => {
      const roster = Object.values(s.players).filter((x) => x.clubId === c.id).sort((a, b) => b.ovr - a.ovr);
      const cut = roster[Math.min(19, roster.length - 1)]?.ovr ?? 0;
      return roster.length < 28 && p.ovr >= cut - 4;
    })
    .sort((a, b) => a.reputation - b.reputation);
}

export function loanOut(s: GameState, id: string, clubId: string): { ok: boolean; text: string } {
  const p = s.players[id];
  if (!p || p.clubId !== s.userClubId) return { ok: false, text: 'Igralec ni v tvojem klubu.' };
  if (s.seasonYear - p.birthYear > 23) return { ok: false, text: 'Na posojo lahko pošlješ le igralce do 23 let.' };
  if (!transferWindow(s).open) return { ok: false, text: 'Posoje so mogoče le v prestopnem roku.' };
  const roster = Object.values(s.players).filter((x) => x.clubId === s.userClubId);
  if (roster.length <= 20) return { ok: false, text: 'Kader mora imeti vsaj 20 igralcev.' };
  if (p.pos === 'G' && roster.filter((x) => x.pos === 'G').length <= 2) return { ok: false, text: 'Potrebuješ vsaj dva golmana.' };
  const club = loanTargets(s, p).find((c) => c.id === clubId);
  if (!club) return { ok: false, text: 'Klub igralca ne želi.' };
  p.loan = { from: s.userClubId, until: s.seasonYear };
  p.clubId = clubId;
  p.benchStreak = 0;
  addStory(s, p, `Posoja v ${club.short}`);
  return { ok: true, text: `${p.first} ${p.last} gre na posojo v ${club.short} do konca sezone. Tam bo dobil več minutaže.` };
}

export function recallLoan(s: GameState, id: string): { ok: boolean; text: string } {
  const p = s.players[id];
  if (!p?.loan || p.loan.from !== s.userClubId) return { ok: false, text: 'Igralec ni na posoji.' };
  if (!transferWindow(s).open) return { ok: false, text: 'Igralca lahko vrneš le v prestopnem roku.' };
  p.clubId = p.loan.from;
  p.loan = undefined;
  return { ok: true, text: `${p.first} ${p.last} se je vrnil s posoje.` };
}

// 1. julij: vrnitev s posoj (pred iztekom pogodb)
export function returnLoans(s: GameState) {
  const back: string[] = [];
  for (const p of Object.values(s.players)) {
    if (!p.loan || p.loan.until >= s.seasonYear) continue;
    const gp = p.history[p.history.length - 1]?.stats.gp ?? 0;
    if (p.loan.from === s.userClubId) {
      back.push(`${p.first} ${p.last} (${gp} tekem)`);
      addStory(s, p, `Vrnil se s posoje (${gp} tekem)`);
    }
    p.clubId = p.loan.from;
    p.loan = undefined;
  }
  if (back.length) news(s, 'prestopi', 'Vrnitve s posoje', `S posoje so se vrnili: ${back.join(', ')}.`);
}
