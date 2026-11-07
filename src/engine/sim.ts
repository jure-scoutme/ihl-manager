import { Rng, clamp } from './rng';
import { shortName } from './players';
import type { Attrs, GoalEvent, Lines, Player, Tactics } from './types';

// Simulacija tekme po korakih po 5 sekund (720 korakov v 60 minutah).

export const STEP = 5;
const PERIOD = 1200;

export type Side = 'home' | 'away';
export interface LiveEvent {
  t: number;
  side?: Side;
  kind: 'gol' | 'kazen' | 'obramba' | 'strel' | 'tretjina' | 'bulij' | 'konec' | 'info' | 'blok';
  text: string;
}

interface Penalty {
  playerId: string;
  until: number;
}

interface TeamState {
  clubId: string;
  name: string;
  lines: Lines;
  tactics: Tactics;
  fIdx: number;
  dIdx: number;
  fShift: number;
  dShift: number;
  fUsed: number[];
  ppUnit: number;
  ppShift: number;
  goalie: string;
  goaliePulled: boolean;
  penalties: Penalty[];
  score: number;
  shots: number;
  attempts: number;
  pim: number;
  ppGoals: number;
  ppOpps: number;
  possession: number;
}

export interface PlayerLine {
  g: number;
  a: number;
  pim: number;
  pm: number;
  sog: number;
  sa: number;
  ga: number;
}

export interface MatchSetup {
  homeId: string;
  awayId: string;
  homeName: string;
  awayName: string;
  players: Record<string, Player>;
  lines: Record<string, Lines>;
  tactics: Record<string, Tactics>;
  playoff: boolean;
  seed: number;
  staff?: Record<string, import('./staff').StaffBoost>;
}

const eff = (p: Player, energy: number, k: keyof Attrs) => p.attrs[k] * (0.72 + 0.28 * (energy / 100)) * (1 + p.form * 0.02) * (0.96 + p.morale / 1250);

export class MatchSim {
  t = 0;
  period = 1;
  over = false;
  inOT = false;
  shootout = false;
  rng: Rng;
  home: TeamState;
  away: TeamState;
  players: Record<string, Player>;
  energy: Record<string, number> = {};
  stat: Record<string, PlayerLine> = {};
  events: LiveEvent[] = [];
  goals: GoalEvent[] = [];
  faceoffPending = true;
  possession: Side = 'home';
  playoff: boolean;
  dressed = new Set<string>();
  soWinner?: Side;
  shotsByPeriod: { home: number[]; away: number[] } = { home: [0, 0, 0, 0], away: [0, 0, 0, 0] };
  penaltyLog: { t: number; side: Side; playerId: string; min: number; reason: string }[] = [];
  soAttempts: { side: Side; playerId: string; scored: boolean }[] = [];
  staffB?: MatchSetup['staff'];

  private pIdx() {
    return Math.min(3, this.period - 1);
  }

  constructor(s: MatchSetup) {
    this.rng = new Rng(s.seed);
    this.staffB = s.staff;
    this.players = s.players;
    this.playoff = s.playoff;
    this.home = this.makeTeam(s.homeId, s.homeName, s.lines[s.homeId], s.tactics[s.homeId]);
    this.away = this.makeTeam(s.awayId, s.awayName, s.lines[s.awayId], s.tactics[s.awayId]);
    for (const team of [this.home, this.away]) {
      const ids = [
        ...team.lines.f.flat(),
        ...team.lines.d.flat(),
        team.lines.g[0],
        ...team.lines.pp.flatMap((u) => [...u.f, ...u.d]),
        ...team.lines.pk.flatMap((u) => [...u.f, ...u.d]),
      ];
      for (const id of ids) {
        if (!id) continue;
        this.dressed.add(id);
        this.energy[id] = clamp(this.players[id]?.energy ?? 100, 40, 100);
        this.stat[id] = { g: 0, a: 0, pim: 0, pm: 0, sog: 0, sa: 0, ga: 0 };
      }
    }
    this.log({ kind: 'tretjina', text: `Začetek tekme: ${s.homeName} – ${s.awayName}` });
  }

  private makeTeam(clubId: string, name: string, lines: Lines, tactics: Tactics): TeamState {
    return {
      clubId, name, lines, tactics,
      fIdx: 0, dIdx: 0, fShift: 0, dShift: 0, fUsed: [0, 0, 0, 0], ppUnit: 0, ppShift: 0,
      goalie: lines.g[0], goaliePulled: false, penalties: [],
      score: 0, shots: 0, attempts: 0, pim: 0, ppGoals: 0, ppOpps: 0, possession: 0,
    };
  }

  team(side: Side) {
    return side === 'home' ? this.home : this.away;
  }
  other(side: Side): Side {
    return side === 'home' ? 'away' : 'home';
  }

  setTactics(side: Side, t: Partial<Tactics>) {
    const team = this.team(side);
    team.tactics = { ...team.tactics, ...t };
  }

  private log(e: Omit<LiveEvent, 't'>) {
    this.events.push({ t: this.t, ...e });
  }

  clock(t = this.t) {
    const per = t >= 3600 ? 3 + Math.floor((t - 3600) / (this.playoff ? PERIOD : 300)) : Math.floor(t / PERIOD);
    const inP = t >= 3600 ? (t - 3600) % (this.playoff ? PERIOD : 300) : t - per * PERIOD;
    const m = Math.floor(inP / 60);
    const sec = Math.floor(inP % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  // --- kdo je na ledu ---
  skatersOnIce(side: Side): { f: string[]; d: string[] } {
    const me = this.team(side);
    const opp = this.team(this.other(side));
    const myPen = me.penalties.length;
    const oppPen = opp.penalties.length;
    if (this.inOT && !this.playoff) {
      const i = me.fIdx % 3;
      const fl = me.lines.f[i];
      return { f: [fl[1], fl[0]], d: [me.lines.d[i % 3][0]] };
    }
    if (myPen > oppPen) {
      const u = me.lines.pk[me.ppUnit % 2];
      if (myPen - oppPen >= 2) return { f: [u.f[0]], d: u.d };
      return { f: u.f, d: u.d };
    }
    if (oppPen > myPen) {
      const u = me.lines.pp[me.ppUnit % 2];
      return { f: [...u.f], d: [...u.d] };
    }
    const fl = me.lines.f[me.fIdx];
    const dp = me.lines.d[me.dIdx];
    if (myPen > 0) return { f: [fl[0], fl[1]], d: [...dp] }; // 4 na 4
    return { f: [...fl], d: [...dp] };
  }

  private onIceIds(side: Side) {
    const s = this.skatersOnIce(side);
    return [...s.f, ...s.d].filter((id) => id && !this.isPenalized(side, id));
  }

  private isPenalized(side: Side, id: string) {
    return this.team(side).penalties.some((p) => p.playerId === id);
  }

  private teamRatings(side: Side) {
    const ids = this.onIceIds(side);
    const tac = this.team(side).tactics;
    let off = 0;
    let def = 0;
    for (const id of ids) {
      const p = this.players[id];
      const e = this.energy[id] ?? 80;
      off += (eff(p, e, 'skating') + eff(p, e, 'passing') + eff(p, e, 'puckHandling') + 0.8 * eff(p, e, 'shooting') + 0.8 * eff(p, e, 'decisions') + 0.6 * eff(p, e, 'speed')) / 5.2;
      def += (1.2 * eff(p, e, 'positioning') + 0.7 * eff(p, e, 'strength') + 0.7 * eff(p, e, 'skating') + 0.6 * eff(p, e, 'workRate') + 0.6 * eff(p, e, 'decisions') + 0.4 * eff(p, e, 'blocking')) / 4.2;
    }
    const n = Math.max(1, ids.length);
    off /= n;
    def /= n;
    const sb = this.staffB?.[this.team(side).clubId];
    if (sb) {
      off *= sb.off;
      def *= sb.def;
      const oppN = this.onIceIds(this.other(side)).length;
      if (ids.length > oppN) off *= sb.pp;
      else if (ids.length < oppN) def *= sb.pk;
    }
    if (tac.forecheck === 'agresiven') {
      off *= 1.04;
      def *= 0.97;
    } else if (tac.forecheck === 'pasiven') {
      off *= 0.96;
      def *= 1.04;
    }
    return { off, def, n: ids.length + (this.team(side).goaliePulled ? 1 : 0) };
  }

  private goalieQ(side: Side) {
    const team = this.team(side);
    if (team.goaliePulled) return 0;
    const g = this.players[team.goalie];
    if (!g) return 6;
    const e = this.energy[team.goalie] ?? 100;
    const gb = this.staffB?.[team.clubId]?.goalie ?? 1;
    return ((1.2 * eff(g, e, 'reflexes') + eff(g, e, 'gPositioning') + 0.5 * eff(g, e, 'reboundControl')) / 2.7) * gb;
  }

  // --- en korak ---
  step() {
    if (this.over) return;
    this.updatePenalties();
    this.manageGoalie();
    this.changes();

    const h = this.teamRatings('home');
    const a = this.teamRatings('away');

    if (this.faceoffPending) {
      this.possession = this.faceoff();
      this.faceoffPending = false;
    } else {
      let pHome = 0.5 + ((h.off - a.def) - (a.off - h.def)) * 0.022 + (h.n - a.n) * 0.12 + 0.022;
      if (this.home.tactics.forecheck === 'agresiven') pHome += 0.02;
      if (this.away.tactics.forecheck === 'agresiven') pHome -= 0.02;
      pHome = clamp(pHome, 0.15, 0.85);
      this.possession = this.rng.chance(pHome) ? 'home' : 'away';
    }
    this.team(this.possession).possession++;

    const att = this.possession;
    const def = this.other(att);
    const ra = att === 'home' ? h : a;
    const rd = att === 'home' ? a : h;

    // gol v prazno mrežo
    if (this.team(def).goaliePulled && this.rng.chance(0.05)) {
      this.scoreGoal(att, this.pickShooter(att), true);
    } else {
      const tempo = (t: Tactics) => (t.tempo === 'hiter' ? 1.1 : t.tempo === 'pocasen' ? 0.9 : 1);
      let pAtt = 0.118 * Math.pow(ra.off / Math.max(4, rd.def), 0.9) * tempo(this.team(att).tactics) * Math.sqrt(tempo(this.team(def).tactics));
      const diff = ra.n - rd.n;
      if (diff >= 2) pAtt *= 1.8;
      else if (diff === 1) pAtt *= 1.45;
      else if (diff === -1) pAtt *= 0.45;
      else if (diff <= -2) pAtt *= 0.3;
      if (this.inOT && !this.playoff) pAtt *= 1.35;
      if (this.rng.chance(clamp(pAtt, 0.02, 0.5))) this.shot(att, diff);
    }

    this.penaltyCheck('home');
    this.penaltyCheck('away');
    this.fatigue();

    this.t += STEP;
    this.checkClock();
  }

  runToEnd() {
    let guard = 0;
    while (!this.over && guard++ < 5000) this.step();
  }

  private faceoff(): Side {
    const c = (side: Side) => {
      const s = this.skatersOnIce(side);
      const id = s.f.length > 1 ? s.f[1] : s.f[0];
      const p = this.players[id];
      return p ? eff(p, this.energy[id] ?? 90, 'faceoffs') : 8;
    };
    const ch = c('home');
    const ca = c('away');
    return this.rng.chance(clamp(0.5 + (ch - ca) * 0.025, 0.25, 0.75)) ? 'home' : 'away';
  }

  private pickShooter(side: Side): string {
    const s = this.skatersOnIce(side);
    const ids = [...s.f, ...s.d].filter((id) => id && !this.isPenalized(side, id));
    const w = ids.map((id) => {
      const p = this.players[id];
      const base = Math.pow(p.attrs.shooting, 2) + 20;
      return p.pos === 'D' ? base * 0.55 : base;
    });
    return this.rng.weighted(ids, w);
  }

  private shot(att: Side, diff: number) {
    const def = this.other(att);
    const shooterId = this.pickShooter(att);
    const shooter = this.players[shooterId];
    const team = this.team(att);
    team.attempts++;
    const defIds = this.onIceIds(def);
    const blockAvg = defIds.reduce((s, id) => s + this.players[id].attrs.blocking, 0) / Math.max(1, defIds.length);
    const shootQ = eff(shooter, this.energy[shooterId] ?? 80, 'shooting');

    if (this.rng.chance(clamp(0.22 * (blockAvg / 10) * (diff > 0 ? 1.15 : 1), 0.08, 0.4))) {
      if (this.rng.chance(0.3)) {
        const blocker = this.rng.pick(defIds);
        this.log({ side: def, kind: 'blok', text: `${shortName(this.players[blocker])} blokira strel ${shortName(shooter)}.` });
      }
      return;
    }
    if (this.rng.chance(clamp(0.27 - (shootQ - 10) * 0.012, 0.12, 0.4))) {
      if (this.rng.chance(0.2)) this.log({ side: att, kind: 'strel', text: this.rng.pick([`${shortName(shooter)} strelja mimo gola.`, `${shortName(shooter)} zadene vratnico!`, `Strel ${shortName(shooter)} gre čez gol.`]) });
      return;
    }
    this.onGoal(att, shooterId, shootQ, diff, false);
  }

  private onGoal(att: Side, shooterId: string, shootQ: number, diff: number, rebound: boolean) {
    const def = this.other(att);
    const team = this.team(att);
    const dTeam = this.team(def);
    team.shots++;
    this.shotsByPeriod[att][this.pIdx()]++;
    this.stat[shooterId].sog++;
    if (dTeam.goaliePulled) {
      this.scoreGoal(att, shooterId, false);
      return;
    }
    const gq = this.goalieQ(def);
    let pGoal = 0.088 * Math.pow(shootQ / Math.max(5, gq), 1.15);
    if (diff >= 1) pGoal *= 1.35;
    if (rebound) pGoal *= 1.6;
    if (this.inOT && !this.playoff) pGoal *= 1.15;
    const gid = dTeam.goalie;
    this.stat[gid].sa++;
    if (this.rng.chance(clamp(pGoal, 0.02, 0.32))) {
      this.scoreGoal(att, shooterId, false);
      return;
    }
    const g = this.players[gid];
    if (this.rng.chance(rebound ? 0.6 : 0.3)) {
      const sh = shortName(this.players[shooterId]);
      const gn = shortName(g);
      const lines = rebound
        ? [`${sh} poskusi z odbitkom, ${gn} spet ubrani.`, `Strel iz odbitka, ${gn} je na mestu.`]
        : [`${sh} strelja, ${gn} ubrani.`, `Strel ${sh} s točke, ${gn} ga ujame.`, `Odlična obramba: ${gn} ustavi ${sh}.`, `${sh} iz zapestja, ${gn} z blokerjem.`, `${gn} z ščitnikom ustavi strel ${sh}.`];
      this.log({ side: def, kind: 'obramba', text: this.rng.pick(lines) });
    }
    const pReb = clamp(0.17 - (g.attrs.reboundControl - 10) * 0.012, 0.05, 0.3);
    if (!rebound && this.rng.chance(pReb)) {
      const second = this.pickShooter(att);
      this.onGoal(att, second, eff(this.players[second], this.energy[second] ?? 80, 'shooting'), diff, true);
      return;
    }
    if (this.rng.chance(0.38)) this.faceoffPending = true;
  }

  private scoreGoal(att: Side, scorerId: string, emptyNet: boolean) {
    const def = this.other(att);
    const team = this.team(att);
    const dTeam = this.team(def);
    team.score++;
    if (emptyNet) {
      team.shots++;
      this.shotsByPeriod[att][this.pIdx()]++;
    }
    if (!emptyNet && this.stat[dTeam.goalie]) this.stat[dTeam.goalie].ga++;
    if (emptyNet && this.stat[scorerId]) this.stat[scorerId].sog++;

    const onIce = this.onIceIds(att);
    const mates = onIce.filter((id) => id !== scorerId);
    const assists: string[] = [];
    const r = this.rng.next();
    const nA = r < 0.08 ? 0 : r < 0.36 ? 1 : 2;
    const pool = [...mates];
    for (let i = 0; i < nA && pool.length; i++) {
      const w = pool.map((id) => Math.pow(this.players[id].attrs.passing, 2) + 15);
      const pick = this.rng.weighted(pool, w);
      assists.push(pick);
      pool.splice(pool.indexOf(pick), 1);
    }
    this.stat[scorerId].g++;
    assists.forEach((id) => this.stat[id].a++);

    const myPen = team.penalties.length;
    const oppPen = dTeam.penalties.length;
    let strength: GoalEvent['strength'] = 'EV';
    if (emptyNet) strength = 'EN';
    else if (oppPen > myPen) strength = 'PP';
    else if (myPen > oppPen) strength = 'SH';

    if (strength === 'EV' || strength === 'EN') {
      onIce.forEach((id) => (this.stat[id].pm += 1));
      this.onIceIds(def).forEach((id) => (this.stat[id].pm -= 1));
    }
    if (strength === 'PP') {
      team.ppGoals++;
      dTeam.penalties.sort((x, y) => x.until - y.until);
      dTeam.penalties.shift();
    }
    this.goals.push({ t: this.t, team: att, scorer: scorerId, assists, strength });
    const sc = this.players[scorerId];
    const aTxt = assists.length ? `, podaja ${assists.map((id) => shortName(this.players[id])).join(', ')}` : '';
    const tag = strength === 'PP' ? ' (igralec več)' : strength === 'SH' ? ' (igralec manj)' : strength === 'EN' ? ' (prazna mreža)' : '';
    this.log({ side: att, kind: 'gol', text: `GOL! ${team.name} ${this.home.score}:${this.away.score}. ${shortName(sc)}${aTxt}${tag}.` });
    this.faceoffPending = true;
    if (this.inOT) this.finish();
  }

  private penaltyCheck(side: Side) {
    if (this.inOT && !this.playoff) return;
    const team = this.team(side);
    if (team.penalties.length >= 2) return;
    const ids = this.onIceIds(side);
    if (!ids.length) return;
    const agg = ids.reduce((s, id) => s + this.players[id].attrs.aggression, 0) / ids.length;
    const fc = team.tactics.forecheck === 'agresiven' ? 1.2 : team.tactics.forecheck === 'pasiven' ? 0.85 : 1;
    const p = 0.0042 * Math.pow(agg / 10, 1.3) * fc;
    if (!this.rng.chance(p)) return;
    const pid = this.rng.weighted(ids, ids.map((id) => this.players[id].attrs.aggression + 3 + (this.players[id].personality === 'temperamenten' ? 6 : 0)));
    const dur = this.rng.chance(0.04) ? 300 : 120;
    team.penalties.push({ playerId: pid, until: this.t + dur });
    team.pim += dur / 60;
    this.stat[pid].pim += dur / 60;
    this.team(this.other(side)).ppOpps++;
    const reasons = ['spotikanje', 'zadrževanje', 'udarec s palico', 'oviranje', 'nedovoljen napad', 'zadrževanje s palico', 'grobost', 'kavljanje'];
    const reason = dur === 300 ? 'napad na glavo' : this.rng.pick(reasons);
    this.penaltyLog.push({ t: this.t, side, playerId: pid, min: dur / 60, reason });
    this.log({ side, kind: 'kazen', text: `Kazen: ${shortName(this.players[pid])} (${team.name}), ${reason}, ${dur / 60} min.` });
    this.faceoffPending = true;
  }

  private updatePenalties() {
    for (const team of [this.home, this.away]) {
      team.penalties = team.penalties.filter((p) => p.until > this.t);
    }
  }

  private manageGoalie() {
    if (this.inOT || this.period !== 3) {
      this.home.goaliePulled = false;
      this.away.goaliePulled = false;
      return;
    }
    for (const side of ['home', 'away'] as Side[]) {
      const me = this.team(side);
      const opp = this.team(this.other(side));
      const behind = opp.score - me.score;
      const shouldPull = behind >= 1 && behind <= 2 && this.t >= 3600 - (behind === 2 ? 150 : 90) && me.penalties.length === 0;
      if (shouldPull && !me.goaliePulled) this.log({ side, kind: 'info', text: `${me.name} umakne golmana za dodatnega napadalca.` });
      me.goaliePulled = shouldPull;
    }
  }

  private changes() {
    for (const side of ['home', 'away'] as Side[]) {
      const me = this.team(side);
      const tempo = me.tactics.tempo === 'hiter' ? 8 : me.tactics.tempo === 'pocasen' ? 10 : 9;
      me.fShift++;
      me.dShift++;
      me.ppShift++;
      if (me.ppShift >= 14) {
        me.ppUnit++;
        me.ppShift = 0;
      }
      if (me.fShift >= tempo) {
        me.fShift = 0;
        const w = me.tactics.lineUsage;
        let best = 0;
        let bestScore = -1;
        for (let i = 0; i < 4; i++) {
          if (i === me.fIdx) continue;
          const line = me.lines.f[i];
          const en = line.reduce((s, id) => s + (this.energy[id] ?? 80), 0) / 3;
          const score = (w[i] / (me.fUsed[i] + 1)) * (en / 100);
          if (score > bestScore) {
            bestScore = score;
            best = i;
          }
        }
        me.fIdx = best;
        me.fUsed[best]++;
      }
      if (me.dShift >= tempo + 1) {
        me.dShift = 0;
        me.dIdx = (me.dIdx + 1) % 3;
        if (me.dIdx === 2 && this.rng.chance(0.3)) me.dIdx = 0;
      }
    }
  }

  private fatigue() {
    const on = new Set([...this.onIceIds('home'), ...this.onIceIds('away')]);
    for (const id of Object.keys(this.energy)) {
      const p = this.players[id];
      if (p.pos === 'G') continue;
      if (on.has(id)) {
        const team = p.clubId === this.home.clubId ? this.home : this.away;
        const tf = team.tactics.tempo === 'hiter' ? 1.15 : team.tactics.tempo === 'pocasen' ? 0.9 : 1;
        this.energy[id] = Math.max(15, this.energy[id] - 1.1 * (1.25 - p.attrs.stamina / 40) * tf);
      } else {
        this.energy[id] = Math.min(100, this.energy[id] + 0.4);
      }
    }
  }

  private checkClock() {
    if (this.inOT) {
      const otLen = this.playoff ? PERIOD : 300;
      if (this.t >= 3600 + otLen * (this.playoff ? this.period - 3 : 1)) {
        if (this.playoff) {
          this.period++;
          this.log({ kind: 'tretjina', text: `Konec podaljška brez gola, igra se naprej.` });
          this.intermission();
        } else {
          this.runShootout();
        }
      }
      return;
    }
    if (this.t >= this.period * PERIOD) {
      if (this.period < 3) {
        this.log({ kind: 'tretjina', text: `Konec ${this.period}. tretjine: ${this.home.score}:${this.away.score}` });
        this.period++;
        this.intermission();
      } else if (this.home.score !== this.away.score) {
        this.finish();
      } else {
        this.inOT = true;
        this.period = 4;
        this.home.goaliePulled = false;
        this.away.goaliePulled = false;
        this.log({ kind: 'tretjina', text: `Neodločeno ${this.home.score}:${this.away.score}, sledi podaljšek${this.playoff ? '' : ' (3 na 3)'}.` });
        this.intermission();
      }
    }
  }

  private intermission() {
    for (const id of Object.keys(this.energy)) this.energy[id] = Math.min(100, this.energy[id] + 22);
    this.faceoffPending = true;
    for (const team of [this.home, this.away]) {
      team.fIdx = 0;
      team.dIdx = 0;
      team.fShift = 0;
      team.dShift = 0;
    }
  }

  private runShootout() {
    this.shootout = true;
    this.log({ kind: 'tretjina', text: 'Sledijo kazenski streli.' });
    const shooters = (side: Side) =>
      this.team(side).lines.f.flat().map((id) => this.players[id]).filter(Boolean).sort((x, y) => y.attrs.shooting + y.attrs.puckHandling - (x.attrs.shooting + x.attrs.puckHandling));
    const hs = shooters('home');
    const as = shooters('away');
    let h = 0;
    let a = 0;
    const attempt = (side: Side, p: Player) => {
      const gq = this.goalieQ(this.other(side));
      const prob = clamp(0.33 * Math.pow((p.attrs.shooting + p.attrs.puckHandling) / 2 / Math.max(5, gq), 1.4), 0.12, 0.6);
      const ok = this.rng.chance(prob);
      this.soAttempts.push({ side, playerId: p.id, scored: ok });
      this.log({ side, kind: ok ? 'gol' : 'obramba', text: `${shortName(p)}: ${ok ? 'zadetek' : 'zgreši'}` });
      return ok;
    };
    for (let r = 0; r < 20; r++) {
      if (attempt('home', hs[r % hs.length])) h++;
      if (attempt('away', as[r % as.length])) a++;
      if (r >= 2 && h !== a) break;
      if (r < 2) {
        const left = 2 - r;
        if (h > a + left || a > h + left) break;
      }
    }
    if (h === a) h++;
    this.soWinner = h > a ? 'home' : 'away';
    this.team(this.soWinner).score++;
    this.finish();
  }

  private finish() {
    this.over = true;
    const tag = this.shootout ? ' po kazenskih strelih' : this.inOT ? ' po podaljšku' : '';
    this.log({ kind: 'konec', text: `Konec tekme: ${this.home.name} ${this.home.score}:${this.away.score} ${this.away.name}${tag}.` });
  }

  winner(): Side {
    return this.home.score > this.away.score ? 'home' : 'away';
  }
}
