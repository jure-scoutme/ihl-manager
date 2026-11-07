// Tedenski izzivi in nakazila uprave.
import { book } from './finance';
import { Rng, clamp } from './rng';
import type { Fixture, GameState } from './types';

export type ChallengeKind = 'zmaga_gost' | 'brez_poraza' | 'nicla' | 'gol5' | 'mlad_tocka' | 'derbi' | 'pp2' | 'obisk';
export interface Challenge {
  kind: ChallengeKind;
  text: string;
  reward: { money?: number; board?: number; fans?: number };
  start: string;
  end: string;
  done?: boolean;
  failed?: boolean;
  games?: number;
  losses?: number;
}

const TEXT: Record<ChallengeKind, string> = {
  zmaga_gost: 'Zmagaj na gostovanju',
  brez_poraza: 'Ta teden brez poraza v rednem času',
  nicla: 'Zmagaj brez prejetega gola',
  gol5: 'Doseži vsaj 5 golov na tekmi',
  mlad_tocka: 'Igralec, star 21 let ali manj, naj doseže točko',
  derbi: 'Zmagaj derbi',
  pp2: 'Doseži 2 gola z igralcem več na eni tekmi',
  obisk: 'Napolni domačo dvorano vsaj do 80 %',
};

const DERBY: string[][] = [['czv', 'par'], ['med', 'zag', 'mla'], ['tri', 'sla', 'cel']];
const derby = (f: Fixture) => DERBY.some((g) => g.includes(f.home) && g.includes(f.away));
const addDays = (d: string, n: number) => {
  const x = new Date(d + 'T12:00:00Z');
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const news = (s: GameState, title: string, body: string) =>
  s.news.unshift({ id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, date: s.date, kind: 'uprava', title, body, read: false });

export const rewardText = (r: Challenge['reward']) =>
  r.money ? `${r.money.toLocaleString('sl-SI')} €` : r.board ? `+${r.board} % zaupanja uprave` : `+${r.fans} % podpore navijačev`;

// ponedeljek: nov izziv za ta teden
export function newWeeklyChallenge(s: GameState) {
  if (s.phase !== 'redni' && s.phase !== 'koncnica') {
    s.challenge = undefined;
    return;
  }
  const end = addDays(s.date, 6);
  const week = s.fixtures.filter((f) => f.date >= s.date && f.date <= end && (f.home === s.userClubId || f.away === s.userClubId) && f.stage !== 'prijateljska');
  if (!week.length) {
    s.challenge = undefined;
    return;
  }
  const rng = new Rng(s.seed + Number(s.date.replace(/-/g, '')));
  const opts: ChallengeKind[] = ['nicla', 'gol5', 'mlad_tocka', 'pp2'];
  if (week.some((f) => f.away === s.userClubId)) opts.push('zmaga_gost', 'zmaga_gost');
  if (week.some((f) => f.home === s.userClubId)) opts.push('obisk');
  if (week.some(derby)) opts.push('derbi', 'derbi', 'derbi');
  if (week.length >= 2) opts.push('brez_poraza', 'brez_poraza');
  const kind = rng.pick(opts);
  const club = s.clubs.find((c) => c.id === s.userClubId)!;
  const hard = kind === 'nicla' || kind === 'pp2' || kind === 'brez_poraza';
  const r = rng.next();
  const reward = r < 0.6 ? { money: Math.round(((800 + club.budget * 350) * (hard ? 1.6 : 1)) / 100) * 100 } : r < 0.8 ? { board: hard ? 5 : 3 } : { fans: hard ? 6 : 4 };
  s.challenge = { kind, text: TEXT[kind], reward, start: s.date, end, games: 0, losses: 0 };
}

function complete(s: GameState) {
  const c = s.challenge!;
  c.done = true;
  if (c.reward.money) book(s, s.userClubId, 'izzivi', c.reward.money);
  if (c.reward.board) s.board = clamp((s.board ?? 55) + c.reward.board, 0, 100);
  if (c.reward.fans) s.fans = clamp((s.fans ?? 50) + c.reward.fans, 0, 100);
  news(s, 'Izziv opravljen!', `${c.text}. Nagrada: ${rewardText(c.reward)}.`);
}

// po tekmi uporabnika
export function checkChallenge(s: GameState, f: Fixture) {
  const c = s.challenge;
  if (!c || c.done || c.failed || f.date < c.start || f.date > c.end || !f.result) return;
  const r = f.result;
  const us = f.home === s.userClubId;
  const side = us ? 'home' : 'away';
  const my = us ? r.hg : r.ag;
  const op = us ? r.ag : r.hg;
  const won = my > op;
  c.games = (c.games ?? 0) + 1;
  if (!won && !r.ot && !r.so) c.losses = (c.losses ?? 0) + 1;
  const ok =
    (c.kind === 'zmaga_gost' && won && !us) ||
    (c.kind === 'nicla' && won && op === 0) ||
    (c.kind === 'gol5' && my >= 5) ||
    (c.kind === 'derbi' && won && derby(f)) ||
    (c.kind === 'pp2' && r.goals.filter((g) => g.team === side && g.strength === 'PP').length >= 2) ||
    (c.kind === 'obisk' && us && r.attendance >= s.clubs.find((x) => x.id === s.userClubId)!.arena.capacity * 0.8) ||
    (c.kind === 'mlad_tocka' &&
      r.goals.some((g) => g.team === side && [g.scorer, ...g.assists].some((id) => { const p = s.players[id]; return p && s.seasonYear - p.birthYear <= 21; })));
  if (ok) complete(s);
  else if (c.kind === 'brez_poraza' && (c.losses ?? 0) > 0) c.failed = true;
}

// nedelja/ponedeljek: zaključek tedna
export function closeWeek(s: GameState) {
  const c = s.challenge;
  if (!c || c.done || c.failed) return;
  if (s.date > c.end) {
    if (c.kind === 'brez_poraza' && (c.games ?? 0) > 0 && !(c.losses ?? 0)) complete(s);
    else c.failed = true;
  }
}

// nakazila uprave
export function derbyBonus(s: GameState, won: boolean, isDerby: boolean) {
  if (!won || !isDerby) return;
  const rng = new Rng(s.seed + Number(s.date.replace(/-/g, '')) + 5);
  if (!rng.chance(0.55)) return;
  const club = s.clubs.find((c) => c.id === s.userClubId)!;
  const x = Math.round((600 + club.budget * 300 + rng.int(0, 600)) / 100) * 100;
  book(s, s.userClubId, 'uprava', x);
  news(s, 'Premija za derbi', `Uprava je navdušena nad zmago v derbiju in je ekipi nakazala ${x.toLocaleString('sl-SI')} €.`);
}

export function monthlyBoard(s: GameState) {
  if (s.phase !== 'redni' && s.phase !== 'koncnica') return;
  const board = s.board ?? 55;
  if (board < 72) return;
  const club = s.clubs.find((c) => c.id === s.userClubId)!;
  const rng = new Rng(s.seed + Number(s.date.replace(/-/g, '')) + 9);
  if (!rng.chance(board >= 85 ? 0.8 : 0.45)) return;
  const x = Math.round(((1000 + club.budget * 700) * (board >= 85 ? 1.5 : 1)) / 100) * 100;
  book(s, s.userClubId, 'uprava', x);
  news(s, 'Uprava je zadovoljna', `Zaradi dobrega dela je uprava klubu nakazala dodatnih ${x.toLocaleString('sl-SI')} €.`);
}

// poletje: zadovoljna uprava poveča proračun za plače
export function summerBudget(s: GameState) {
  const fin = s.finance[s.userClubId];
  if (!fin) return;
  const board = s.board ?? 55;
  const pct = board >= 75 ? 0.08 : board >= 60 ? 0.04 : board < 35 ? -0.05 : 0;
  if (!pct) return;
  fin.wageBudget = Math.round((fin.wageBudget * (1 + pct)) / 100) * 100;
  news(s, pct > 0 ? 'Večji proračun za plače' : 'Manjši proračun za plače', pct > 0 ? `Uprava je zadovoljna in je proračun za plače povečala na ${fin.wageBudget.toLocaleString('sl-SI')} €/mes.` : `Uprava je nezadovoljna in je proračun za plače zmanjšala na ${fin.wageBudget.toLocaleString('sl-SI')} €/mes.`);
}
