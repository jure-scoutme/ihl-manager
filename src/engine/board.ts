// Pogovor z upravo: prošnje za denar ali nižji cilj, z obljubami in posledicami.
import { book } from './finance';
import { Rng, clamp } from './rng';
import type { GameState } from './types';

export type BoardAsk = 'place' | 'denar' | 'cilj';
export const BOARD_ASKS: { id: BoardAsk; label: string; desc: string }[] = [
  { id: 'place', label: 'Večji proračun za plače', desc: '+10 % za plače. Uprava pričakuje izpolnitev cilja sezone.' },
  { id: 'denar', label: 'Enkratna sredstva za okrepitve', desc: 'Nakazilo na račun. Uprava pričakuje izpolnitev cilja sezone.' },
  { id: 'cilj', label: 'Nižji cilj sezone', desc: 'Uprava zniža pričakovanja, a izgubi nekaj zaupanja.' },
];

const GOALS = ['naslov', 'finale', 'polfinale', 'končnica'];
const addDays = (d: string, n: number) => {
  const x = new Date(d + 'T12:00:00Z');
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const news = (s: GameState, title: string, body: string) =>
  s.news.unshift({ id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, date: s.date, kind: 'uprava', title, body, read: false });

export const boardCooldown = (s: GameState) => (s.boardTalk && s.boardTalk > addDays(s.date, -45) ? addDays(s.boardTalk, 45) : null);

export function askBoard(s: GameState, ask: BoardAsk): { ok: boolean; text: string } {
  if (boardCooldown(s)) return { ok: false, text: 'Z upravo si se pred kratkim že pogovarjal. Počakaj nekaj tednov.' };
  s.boardTalk = s.date;
  const club = s.clubs.find((c) => c.id === s.userClubId)!;
  const fin = s.finance[s.userClubId];
  const board = s.board ?? 55;
  const rng = new Rng(s.seed + Number(s.date.replace(/-/g, '')) + 3);
  if (ask === 'cilj') {
    const i = GOALS.indexOf(club.boardGoal);
    const gp = s.fixtures.filter((f) => f.played && f.stage === 'redni' && (f.home === s.userClubId || f.away === s.userClubId)).length;
    if (i < 0 || i >= GOALS.length - 1) return { ok: false, text: 'Cilj je že najnižji možen.' };
    if (gp > 16) return { ok: false, text: 'Sredi sezone uprava cilja ne spreminja več.' };
    club.boardGoal = GOALS[i + 1];
    s.board = clamp(board - 8, 0, 100);
    return { ok: true, text: `Uprava je cilj znižala na: ${club.boardGoal}. Zaupanje je padlo na ${Math.round(s.board)} %.` };
  }
  if (board < 55) {
    s.board = clamp(board - 2, 0, 100);
    return { ok: false, text: 'Uprava ti trenutno ne zaupa dovolj, da bi dala dodatna sredstva.' };
  }
  if ((fin?.balance ?? 0) < 0) return { ok: false, text: 'Klub je v minusu. Uprava ne bo dala dodatnega denarja.' };
  const chance = clamp((board - 45) / 40, 0.15, 0.95);
  if (!rng.chance(chance)) {
    s.board = clamp(board - 1, 0, 100);
    return { ok: false, text: 'Uprava je prošnjo zavrnila. Poskusi znova, ko bodo rezultati boljši.' };
  }
  s.boardPromise = { season: s.seasonYear, goal: club.boardGoal };
  if (ask === 'place') {
    fin.wageBudget = Math.round((fin.wageBudget * 1.1) / 100) * 100;
    news(s, 'Uprava je povečala proračun', `Proračun za plače je zdaj ${fin.wageBudget.toLocaleString('sl-SI')} €/mes. V zameno pričakuje cilj: ${club.boardGoal}.`);
    return { ok: true, text: `Proračun za plače je povečan na ${fin.wageBudget.toLocaleString('sl-SI')} €/mes. Uprava pričakuje cilj: ${club.boardGoal}.` };
  }
  const x = Math.round((3000 + club.budget * 2500) / 500) * 500;
  book(s, s.userClubId, 'uprava', x);
  news(s, 'Uprava je nakazala sredstva', `Za okrepitve je na račun prispelo ${x.toLocaleString('sl-SI')} €. V zameno pričakuje cilj: ${club.boardGoal}.`);
  return { ok: true, text: `Uprava je nakazala ${x.toLocaleString('sl-SI')} €. Pričakuje cilj: ${club.boardGoal}.` };
}

// konec sezone: ali je bila obljuba izpolnjena
export function checkBoardPromise(s: GameState, goalMet: boolean) {
  const p = s.boardPromise;
  if (!p || p.season !== s.seasonYear) return;
  s.boardPromise = undefined;
  if (goalMet) {
    s.board = clamp((s.board ?? 55) + 5, 0, 100);
    news(s, 'Obljuba upravi izpolnjena', 'Uprava ceni, da si dodatna sredstva spremenil v rezultat.');
  } else {
    s.board = clamp((s.board ?? 55) - 15, 0, 100);
    news(s, 'Prelomljena obljuba upravi', 'Kljub dodatnim sredstvom cilj ni bil dosežen. Zaupanje uprave je močno padlo.');
  }
}
