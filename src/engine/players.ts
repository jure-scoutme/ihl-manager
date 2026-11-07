import { CLUBS, IMPORT_NAMES, NAMES } from './data';
import { Rng, clamp } from './rng';
import type { Attrs, Lines, Player, Pos, SkaterStats } from './types';

export const ATTR_LABELS: Record<keyof Attrs, string> = {
  skating: 'Drsanje',
  shooting: 'Strel',
  passing: 'Podaja',
  puckHandling: 'Vodenje ploščka',
  faceoffs: 'Buliji',
  blocking: 'Blokiranje strelov',
  decisions: 'Odločanje',
  positioning: 'Pozicioniranje',
  workRate: 'Delavnost',
  leadership: 'Vodstvo',
  aggression: 'Agresivnost',
  strength: 'Moč',
  speed: 'Hitrost',
  stamina: 'Vzdržljivost',
  reflexes: 'Refleksi',
  gPositioning: 'Postavljanje',
  reboundControl: 'Kontrola odbitkov',
  puckPlay: 'Igra s ploščkom',
};

export const ATTR_GROUPS: { label: string; keys: (keyof Attrs)[] }[] = [
  { label: 'Tehnični', keys: ['skating', 'shooting', 'passing', 'puckHandling', 'faceoffs', 'blocking'] },
  { label: 'Mentalni', keys: ['decisions', 'positioning', 'workRate', 'leadership', 'aggression'] },
  { label: 'Fizični', keys: ['strength', 'speed', 'stamina'] },
];
export const GOALIE_GROUP: { label: string; keys: (keyof Attrs)[] } = {
  label: 'Golman',
  keys: ['reflexes', 'gPositioning', 'reboundControl', 'puckPlay'],
};

const W: Record<'F' | 'C' | 'D' | 'G', Partial<Record<keyof Attrs, number>>> = {
  F: { skating: 3, shooting: 3, passing: 2.5, puckHandling: 2.5, decisions: 2, positioning: 1.5, workRate: 1, strength: 1, speed: 1.5 },
  C: { skating: 2.5, shooting: 2.5, passing: 3, puckHandling: 2.5, faceoffs: 2, decisions: 2, positioning: 1.5, workRate: 1, strength: 1, speed: 1 },
  D: { skating: 2.5, passing: 2, puckHandling: 1.5, shooting: 1, blocking: 2, decisions: 2, positioning: 3, strength: 2, speed: 1 },
  G: { reflexes: 4, gPositioning: 3.5, reboundControl: 2, puckPlay: 0.5, decisions: 1 },
};

export function calcOvr(pos: Pos, a: Attrs): number {
  const w = pos === 'G' ? W.G : pos === 'D' ? W.D : pos === 'C' ? W.C : W.F;
  let s = 0;
  let t = 0;
  for (const k in w) {
    const key = k as keyof Attrs;
    s += a[key] * (w[key] as number);
    t += w[key] as number;
  }
  return Math.round(clamp((s / t) * 5, 1, 99));
}

export const emptyStats = (): SkaterStats => ({ gp: 0, g: 0, a: 0, pim: 0, pm: 0, sog: 0, sa: 0, ga: 0, w: 0, so: 0 });

export function ageOf(p: Player, seasonYear: number) {
  return seasonYear - p.birthYear;
}

function makeAttrs(rng: Rng, pos: Pos, base: number): Attrs {
  const b = base / 5;
  const r = (adj = 0, sd = 1.6) => Math.round(clamp(rng.normal(b + adj, sd), 1, 20));
  const isG = pos === 'G';
  const a: Attrs = {
    skating: r(isG ? -3 : 0),
    shooting: r(isG ? -8 : pos === 'D' ? -1.5 : 0.5),
    passing: r(isG ? -6 : 0),
    puckHandling: r(isG ? -6 : pos === 'D' ? -1 : 0),
    faceoffs: r(pos === 'C' ? 1.5 : isG ? -9 : -4),
    blocking: r(pos === 'D' ? 1.5 : isG ? -6 : -2),
    decisions: r(0),
    positioning: r(pos === 'D' ? 1 : 0),
    workRate: r(0, 2.4),
    leadership: r(-1, 2.8),
    aggression: r(pos === 'D' ? 0.5 : -0.5, 2.8),
    strength: r(pos === 'D' ? 1 : 0, 2),
    speed: r(isG ? -3 : 0),
    stamina: r(0, 2),
    reflexes: r(isG ? 0.5 : -9),
    gPositioning: r(isG ? 0 : -9),
    reboundControl: r(isG ? -0.5 : -9),
    puckPlay: r(isG ? -1.5 : -9),
  };
  return a;
}

let idCounter = 0;
export const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${(idCounter++).toString(36)}`;

export function makePlayer(
  rng: Rng,
  opts: { pos: Pos; base: number; clubId: string | null; country: 'SLO' | 'HR' | 'SRB'; seasonYear: number; age?: number; isAI?: boolean; importPlayer?: boolean; usedNumbers?: Set<number> },
): Player {
  const age = opts.age ?? clamp(Math.round(rng.normal(25, 4.5)), 17, 36);
  let first: string;
  let last: string;
  let nat: string;
  if (opts.importPlayer) {
    first = rng.pick(IMPORT_NAMES.first);
    last = rng.pick(IMPORT_NAMES.last);
    nat = rng.pick(IMPORT_NAMES.nats);
  } else {
    const n = NAMES[opts.country];
    first = rng.pick(n.first);
    last = rng.pick(n.last);
    nat = opts.country;
  }
  // mladi igralci so še v razvoju, starejši izgubljajo
  let base = opts.base;
  if (age < 22) base -= (22 - age) * 1.6;
  if (age > 32) base -= (age - 32) * 1.2;
  const attrs = makeAttrs(rng, opts.pos, base);
  const ovr = calcOvr(opts.pos, attrs);
  const growth = age < 24 ? Math.max(0, (24 - age) * rng.int(1, 3)) : 0;
  const potential = clamp(ovr + growth + rng.int(0, 3), ovr, 90);
  let number = opts.pos === 'G' ? rng.pick([1, 30, 31, 33, 35, 29, 40, 60, 70]) : rng.int(2, 98);
  if (opts.usedNumbers) {
    while (opts.usedNumbers.has(number)) number = rng.int(2, 98);
    opts.usedNumbers.add(number);
  }
  return {
    id: newId('p'),
    first,
    last,
    nat,
    clubId: opts.clubId,
    number,
    pos: opts.pos,
    shoots: rng.chance(0.62) ? 'L' : 'D',
    birthYear: opts.seasonYear - age,
    attrs,
    potential,
    ovr,
    morale: rng.int(60, 85),
    form: 0,
    energy: 100,
    injuryDays: 0,
    wage: Math.max(150, Math.round(((ovr - 38) * 45) / 50) * 50),
    contractUntil: opts.seasonYear + rng.int(1, 3),
    isAI: opts.isAI ?? true,
    stats: emptyStats(),
    history: [],
  };
}

const ROSTER: { pos: Pos; slot: number }[] = [
  ...[0, 1, 2, 3].flatMap((s) => [
    { pos: 'LW' as Pos, slot: s },
    { pos: 'C' as Pos, slot: s },
    { pos: 'RW' as Pos, slot: s },
  ]),
  { pos: 'C', slot: 4 },
  { pos: 'LW', slot: 4 },
  ...[0, 0, 1, 1, 2, 2, 3].map((s) => ({ pos: 'D' as Pos, slot: s })),
  { pos: 'D', slot: 4 },
  { pos: 'G', slot: 0 },
  { pos: 'G', slot: 2 },
  { pos: 'G', slot: 4 },
];
const SLOT_OFFSET = [7, 2, -3, -7, -10];

export function generateLeague(rng: Rng, seasonYear: number): Record<string, Player> {
  const players: Record<string, Player> = {};
  for (const club of CLUBS) {
    const used = new Set<number>();
    const importCount = club.budget >= 4 ? 3 : club.budget >= 3 ? 2 : 1;
    ROSTER.forEach((r, i) => {
      const isImport = i < 9 && r.slot <= 1 && rng.chance(importCount / 6);
      const base = club.strength + SLOT_OFFSET[r.slot] + rng.normal(0, 2.5) + (isImport ? 2.5 : 0);
      const youngSlot = r.slot >= 3 && rng.chance(0.5);
      const p = makePlayer(rng, {
        pos: r.pos,
        base,
        clubId: club.id,
        country: club.country,
        seasonYear,
        age: youngSlot ? rng.int(17, 20) : undefined,
        importPlayer: isImport,
        usedNumbers: used,
      });
      players[p.id] = p;
    });
  }
  return players;
}

// --- postave ---

const lineScore = (p: Player) => p.ovr + p.form * 1.5 - (p.energy < 60 ? 6 : 0);

export function autoLines(players: Player[]): Lines {
  const avail = players.filter((p) => p.injuryDays <= 0);
  const by = (pos: Pos[]) => avail.filter((p) => pos.includes(p.pos)).sort((a, b) => lineScore(b) - lineScore(a));
  const used = new Set<string>();
  const take = (pool: Player[], fallback: Player[]) => {
    const p = pool.find((x) => !used.has(x.id)) ?? fallback.find((x) => !used.has(x.id));
    if (!p) return '';
    used.add(p.id);
    return p.id;
  };
  const allF = by(['C', 'LW', 'RW']);
  const C = by(['C']);
  const LW = by(['LW', 'RW']);
  const RW = by(['RW', 'LW']);
  const f: [string, string, string][] = [];
  for (let i = 0; i < 4; i++) {
    const c = take(C, allF);
    const lw = take(LW, allF);
    const rw = take(RW, allF);
    f.push([lw, c, rw]);
  }
  const D = by(['D']);
  const d: [string, string][] = [];
  for (let i = 0; i < 3; i++) d.push([take(D, allF), take(D, allF)]);
  const G = by(['G']);
  const g: [string, string] = [G[0]?.id ?? '', G[1]?.id ?? ''];

  const ids = (arr: Player[], n: number, excl: string[] = []) => arr.filter((p) => !excl.includes(p.id)).slice(0, n).map((p) => p.id);
  const attackF = [...allF].sort((a, b) => b.attrs.shooting + b.attrs.passing + b.attrs.puckHandling - (a.attrs.shooting + a.attrs.passing + a.attrs.puckHandling));
  const ppF = ids(attackF, 6);
  const ppD = ids([...D].sort((a, b) => b.attrs.passing + b.attrs.shooting - (a.attrs.passing + a.attrs.shooting)), 4);
  const defF = [...allF].sort((a, b) => b.attrs.positioning + b.attrs.workRate + b.attrs.blocking - (a.attrs.positioning + a.attrs.workRate + a.attrs.blocking));
  const pkF = ids(defF, 4);
  const pkD = ids([...D].sort((a, b) => b.attrs.positioning + b.attrs.blocking - (a.attrs.positioning + a.attrs.blocking)), 4);
  return {
    f,
    d,
    g,
    pp: [
      { f: [ppF[0], ppF[1], ppF[2]], d: [ppD[0], ppD[1]] },
      { f: [ppF[3], ppF[4], ppF[5]], d: [ppD[2], ppD[3]] },
    ],
    pk: [
      { f: [pkF[0], pkF[1]], d: [pkD[0], pkD[1]] },
      { f: [pkF[2], pkF[3]], d: [pkD[2], pkD[3]] },
    ],
  };
}

export function validateLines(lines: Lines, players: Record<string, Player>, clubId: string): boolean {
  const all = [...lines.f.flat(), ...lines.d.flat(), lines.g[0]];
  return all.every((id) => id && players[id] && players[id].clubId === clubId && players[id].injuryDays <= 0) && new Set(all).size === all.length;
}

export const fullName = (p?: Player) => (p ? `${p.first} ${p.last}` : '—');
export const shortName = (p?: Player) => (p ? `${p.first[0]}. ${p.last}` : '—');
