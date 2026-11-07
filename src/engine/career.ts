// Kariera managerja: odpustitev, ponudbe drugih klubov, menjava klopi.
import { Rng, clamp } from './rng';
import { planOf } from './training';
import { fanPosts } from './fans';
import type { GameState } from './types';

export interface CareerEntry {
  clubId: string;
  from: string;
  to?: string;
  gp0: number;
  w0: number;
  titles0: number;
  gp?: number;
  w?: number;
  titles?: number;
  reason?: 'odpuščen' | 'prestop' | 'odstop';
}

const news = (s: GameState, kind: 'uprava' | 'liga' | 'klub', title: string, body: string) =>
  s.news.unshift({ id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, date: s.date, kind, title, body, read: false });

export function ensureCareer(s: GameState) {
  if (s.career?.length) return;
  const ms = s.managerStats ?? { gp: 0, w: 0, l: 0, titles: 0, seasons: 0 };
  s.career = [{ clubId: s.userClubId, from: s.date, gp0: ms.gp, w0: ms.w, titles0: ms.titles }];
}

const short = (s: GameState, id: string) => s.clubs.find((c) => c.id === id)?.short ?? id;

function closeEntry(s: GameState, reason: CareerEntry['reason']) {
  ensureCareer(s);
  const e = s.career![s.career!.length - 1];
  const ms = s.managerStats!;
  e.to = s.date;
  e.gp = ms.gp - e.gp0;
  e.w = ms.w - e.w0;
  e.titles = ms.titles - e.titles0 + (s.champion === e.clubId ? 1 : 0);
  e.reason = reason;
}

function offerOptions(s: GameState, maxRep: number, exclude: string[]) {
  const rng = new Rng(s.seed + Number(s.date.replace(/-/g, '')));
  const pool = s.clubs.filter((c) => !exclude.includes(c.id) && c.reputation <= maxRep).sort(() => rng.next() - 0.5);
  const pick = pool.slice(0, 3);
  if (!pick.length) {
    const weakest = [...s.clubs].filter((c) => !exclude.includes(c.id)).sort((a, b) => a.reputation - b.reputation)[0];
    if (weakest) pick.push(weakest);
  }
  return pick;
}

function pushDecision(s: GameState, title: string, body: string, options: { label: string; effect: string }[], blocking: boolean) {
  s.decisions = s.decisions ?? [];
  s.decisions.push({ id: `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, date: s.date, kind: 'uprava', title, body, options, blocking });
}

export function fireManager(s: GameState, why: string) {
  closeEntry(s, 'odpuščen');
  const club = short(s, s.userClubId);
  s.manager.reputation = clamp(s.manager.reputation - 6, 1, 100);
  news(s, 'uprava', `Odpuščen iz kluba ${club}`, why);
  const offers = offerOptions(s, s.manager.reputation + 4, [s.userClubId]);
  pushDecision(
    s,
    'Ponudbe za delo',
    `Uprava ${club} te je odpustila. Na mizi imaš ponudbe drugih klubov. Izberi novo klop.`,
    offers.map((c) => ({ label: `${c.name} (ugled ${c.reputation}, cilj: ${c.boardGoal})`, effect: `job_${c.id}` })),
    true,
  );
  s.unemployed = true;
}

// tedensko: preveri, ali je uprava izgubila potrpljenje
export function checkSacking(s: GameState) {
  if (s.unemployed || (s.phase !== 'redni' && s.phase !== 'koncnica')) return;
  const gp = s.fixtures.filter((f) => f.played && f.stage === 'redni' && (f.home === s.userClubId || f.away === s.userClubId)).length;
  if (gp < 8) return;
  if ((s.board ?? 55) < 12) fireManager(s, `Zaupanje uprave je padlo na ${Math.round(s.board ?? 0)} %. Uprava je sklenila, da je čas za spremembo na klopi.`);
}

// konec sezone: odpustitev ali ponudbe boljših klubov
export function seasonEndCareer(s: GameState) {
  if ((s.board ?? 55) < 25) {
    fireManager(s, 'Sezona ni izpolnila pričakovanj uprave. Pogodba s trenerjem je bila prekinjena.');
    return;
  }
  const cur = s.clubs.find((c) => c.id === s.userClubId)!;
  if (s.manager.reputation < 55) return;
  const rng = new Rng(s.seed + s.seasonYear * 7);
  if (!rng.chance(0.55)) return;
  const better = s.clubs.filter((c) => c.id !== cur.id && c.reputation > cur.reputation && c.reputation <= s.manager.reputation + 8).sort(() => rng.next() - 0.5).slice(0, 2);
  if (!better.length) return;
  pushDecision(
    s,
    'Ponudba drugega kluba',
    `Tvoje delo ni ostalo neopaženo. ${better.map((c) => c.name).join(' in ')} ${better.length > 1 ? 'te želita' : 'te želi'} za glavnega trenerja.`,
    [...better.map((c) => ({ label: `Sprejmi: ${c.name} (ugled ${c.reputation})`, effect: `job_${c.id}` })), { label: `Ostani v klubu ${cur.short}`, effect: 'job_stay' }],
    false,
  );
}

export function takeJob(s: GameState, effect: string): string {
  if (effect === 'job_stay') {
    s.board = clamp((s.board ?? 55) + 5, 0, 100);
    s.fans = clamp((s.fans ?? 50) + 3, 0, 100);
    return 'Ostal si. Uprava in navijači cenijo tvojo zvestobo.';
  }
  const id = effect.slice(4);
  const club = s.clubs.find((c) => c.id === id);
  if (!club) return '';
  if (!s.unemployed) closeEntry(s, 'prestop');
  const old = s.userClubId;
  planOf(s, old).delegated = true;
  s.userClubId = id;
  s.unemployed = false;
  s.board = 55;
  s.fans = 50;
  s.streak = 0;
  s.challenge = undefined;
  s.sponsorOffers = undefined;
  s.promises = [];
  s.pressMood = undefined;
  s.agreedFees = {};
  s.decisions = (s.decisions ?? []).filter((d) => d.kind !== 'konferenca' && d.kind !== 'garderoba');
  planOf(s, id).delegated = false;
  const ms = s.managerStats!;
  s.career!.push({ clubId: id, from: s.date, gp0: ms.gp, w0: ms.w, titles0: ms.titles });
  news(s, 'uprava', `Dobrodošli v klubu ${club.short}`, `Prevzel si ${club.name}. Cilj uprave: ${club.boardGoal}. Zaupanje uprave in navijačev se začne znova.`);
  s.fanFeed = [];
  fanPosts(s, 'nov_trener', [], 2);
  news(s, 'liga', `${club.short} ima novega trenerja`, `${s.manager.first} ${s.manager.last} je novi glavni trener kluba ${club.name}.`);
  return `Nova služba: ${club.name}.`;
}
