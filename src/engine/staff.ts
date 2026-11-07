// Strokovni štab: glavni trener, pomočnik, trener vratarjev.
import { CLUBS, IMPORT_NAMES, NAMES } from './data';
import { book } from './finance';
import { Rng, clamp } from './rng';
import type { GameState } from './types';

export type StaffRole = 'glavni' | 'pomocnik' | 'vratarji';
export type StaffSpec = 'napadalni' | 'obrambni' | 'uravnotezen' | 'PP' | 'PK' | 'razvoj' | 'vratarji';

export interface Staff {
  id: string;
  first: string;
  last: string;
  nat: string;
  age: number;
  role: StaffRole;
  rep: number; // renome 1–100
  spec: StaffSpec;
  wage: number;
  contractUntil: number;
  clubId: string | null;
}

export const ROLES: StaffRole[] = ['glavni', 'pomocnik', 'vratarji'];
export const ROLE_LABEL: Record<StaffRole, string> = { glavni: 'Glavni trener', pomocnik: 'Pomočnik trenerja', vratarji: 'Trener vratarjev' };
export const SPEC_LABEL: Record<StaffSpec, string> = {
  napadalni: 'Napadalni stil',
  obrambni: 'Obrambni stil',
  uravnotezen: 'Uravnotežen stil',
  PP: 'Specialist za igralca več',
  PK: 'Specialist za igralca manj',
  razvoj: 'Razvoj mladih',
  vratarji: 'Razvoj vratarjev',
};

const ROLE_WAGE: Record<StaffRole, number> = { glavni: 1, pomocnik: 0.6, vratarji: 0.45 };
export const askingWage = (s: Pick<Staff, 'rep' | 'role'>) => Math.round((Math.max(300, (s.rep - 15) * 34) * ROLE_WAGE[s.role]) / 10) * 10;

let sid = 0;
function makeStaff(rng: Rng, role: StaffRole, rep: number, clubId: string | null, seasonYear: number, country?: 'SLO' | 'HR' | 'SRB'): Staff {
  const imp = rng.chance(rep > 70 ? 0.35 : 0.12);
  const c = country ?? rng.pick(['SLO', 'HR', 'SRB'] as const);
  const first = imp ? rng.pick(IMPORT_NAMES.first) : rng.pick(NAMES[c].first);
  const last = imp ? rng.pick(IMPORT_NAMES.last) : rng.pick(NAMES[c].last);
  const spec: StaffSpec =
    role === 'glavni' ? rng.pick(['napadalni', 'obrambni', 'uravnotezen'] as const) : role === 'pomocnik' ? rng.pick(['PP', 'PK', 'razvoj'] as const) : 'vratarji';
  const s: Staff = {
    id: `st${Date.now().toString(36)}${(sid++).toString(36)}${rng.int(0, 999)}`,
    first,
    last,
    nat: imp ? rng.pick(IMPORT_NAMES.nats) : c,
    age: clamp(Math.round(34 + rep * 0.25 + rng.int(-6, 10)), 30, 68),
    role,
    rep: clamp(Math.round(rep), 10, 95),
    spec,
    wage: 0,
    contractUntil: seasonYear + rng.int(1, 3),
    clubId,
  };
  s.wage = askingWage(s);
  return s;
}

export function ensureStaff(state: GameState) {
  if (state.staff) return;
  const rng = new Rng(state.seed + 4242);
  state.staff = {};
  for (const c of state.clubs) {
    const strength = CLUBS.find((x) => x.id === c.id)?.strength ?? 50;
    const base = 35 + (strength - 48) * 3.2; // Triglav/Zvezda ~67, Mladost/Celje ~45
    const country = c.country as 'SLO' | 'HR' | 'SRB';
    for (const role of ROLES) {
      const s = makeStaff(rng, role, base + rng.int(-6, 6) - (role === 'glavni' ? 0 : 4), c.id, state.seasonYear, country);
      state.staff[s.id] = s;
    }
  }
  refreshStaffMarket(state, 14);
}

export function refreshStaffMarket(state: GameState, n: number) {
  const rng = new Rng(state.seed + 999 + n + state.seasonYear);
  for (let i = 0; i < n; i++) {
    const role = rng.pick(['glavni', 'glavni', 'pomocnik', 'pomocnik', 'vratarji'] as const);
    const rep = rng.chance(0.15) ? rng.int(72, 88) : rng.int(28, 70);
    const s = makeStaff(rng, role, rep, null, state.seasonYear);
    state.staff![s.id] = s;
  }
}

export const clubStaff = (state: GameState, clubId: string) => Object.values(state.staff ?? {}).filter((s) => s.clubId === clubId);
export const staffOf = (state: GameState, clubId: string, role: StaffRole) => clubStaff(state, clubId).find((s) => s.role === role);
export const freeStaff = (state: GameState) => Object.values(state.staff ?? {}).filter((s) => !s.clubId);
export const staffWages = (state: GameState, clubId: string) => clubStaff(state, clubId).reduce((a, s) => a + s.wage, 0);

export interface StaffBoost {
  off: number;
  def: number;
  pp: number;
  pk: number;
  goalie: number;
}

// Vpliv štaba na moč ekipe na tekmi (množitelji okoli 1).
export function staffBoost(state: GameState, clubId: string): StaffBoost {
  const h = staffOf(state, clubId, 'glavni');
  const a = staffOf(state, clubId, 'pomocnik');
  const g = staffOf(state, clubId, 'vratarji');
  const hr = ((h?.rep ?? 15) - 50) / 50;
  const ar = ((a?.rep ?? 15) - 50) / 50;
  const gr = ((g?.rep ?? 15) - 50) / 50;
  const base = hr * 0.06 + ar * 0.015;
  const tilt = h?.spec === 'napadalni' ? 0.012 : h?.spec === 'obrambni' ? -0.012 : 0;
  return {
    off: 1 + base + tilt,
    def: 1 + base - tilt,
    pp: 1 + ar * 0.03 + (a?.spec === 'PP' ? 0.025 : 0),
    pk: 1 + ar * 0.03 + (a?.spec === 'PK' ? 0.025 : 0),
    goalie: 1 + gr * 0.045,
  };
}

// skupen prispevek štaba v % (za prikaz)
export function staffImpact(state: GameState, clubId: string) {
  const b = staffBoost(state, clubId);
  return ((b.off + b.def) / 2 - 1) * 100 + (b.goalie - 1) * 50 + ((b.pp + b.pk) / 2 - 1) * 20;
}

// dodatni razvojni bonus mladih (verjetnost +1)
export function devChance(state: GameState, clubId: string, goalie: boolean) {
  const h = staffOf(state, clubId, 'glavni');
  const a = staffOf(state, clubId, 'pomocnik');
  const g = staffOf(state, clubId, 'vratarji');
  if (goalie) return clamp(((g?.rep ?? 15) - 40) / 80, 0, 0.6);
  return clamp(((h?.rep ?? 15) - 45) / 120 + (a?.spec === 'razvoj' ? 0.25 : 0) + ((a?.rep ?? 15) - 50) / 200, 0, 0.6);
}

const months = (state: GameState, s: Staff) => {
  const [y, m] = state.date.split('-').map(Number);
  // pogodba poteče 30. junija leta contractUntil + 1
  return Math.max(0, (s.contractUntil + 1 - y) * 12 + (6 - m));
};
export const severance = (state: GameState, s: Staff) => Math.min(6, months(state, s)) * s.wage;

function news(state: GameState, kind: 'klub' | 'liga', title: string, body: string) {
  state.news.unshift({ id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, date: state.date, kind, title, body, read: false });
}

export function fireStaff(state: GameState, id: string, clubId = state.userClubId): { ok: boolean; text: string } {
  const s = state.staff?.[id];
  if (!s || s.clubId !== clubId) return { ok: false, text: 'Trener ni v tvojem štabu.' };
  const pay = severance(state, s);
  book(state, clubId, 'odpravnine', -pay);
  s.clubId = null;
  s.wage = askingWage(s);
  if (clubId === state.userClubId) {
    state.board = clamp((state.board ?? 55) - (s.role === 'glavni' ? 3 : 1), 0, 100);
    return { ok: true, text: `${s.first} ${s.last} je odpuščen. Odpravnina: ${pay.toLocaleString('sl-SI')} €.` };
  }
  return { ok: true, text: '' };
}

export function hireStaff(state: GameState, id: string, years: number, clubId = state.userClubId): { ok: boolean; text: string } {
  const s = state.staff?.[id];
  if (!s || s.clubId) return { ok: false, text: 'Trener ni več na voljo.' };
  const club = state.clubs.find((c) => c.id === clubId)!;
  const current = staffOf(state, clubId, s.role);
  if (current) return { ok: false, text: `Mesto je zasedeno. Najprej odpusti: ${current.first} ${current.last}.` };
  if (clubId === state.userClubId) {
    const prestige = club.reputation * 0.7 + state.manager.reputation * 0.3 + 18;
    if (s.rep > prestige) return { ok: false, text: `${s.first} ${s.last} meni, da ${club.short} še ni klub zanj. Izboljšaj ugled kluba in svoj ugled.` };
    const bal = state.finance[clubId]?.balance ?? 0;
    if (bal < s.wage * 2) return { ok: false, text: `Na računu potrebuješ vsaj ${(s.wage * 2).toLocaleString('sl-SI')} € (dve plači).` };
  }
  s.clubId = clubId;
  s.contractUntil = state.seasonYear + clamp(years, 1, 3) - 1;
  if (clubId === state.userClubId) {
    state.fans = clamp((state.fans ?? 50) + (s.role === 'glavni' && s.rep >= 70 ? 3 : 0), 0, 100);
    news(state, 'klub', `Nov član štaba: ${s.first} ${s.last}`, `${club.short} je zaposlil novega trenerja (${ROLE_LABEL[s.role].toLowerCase()}). Renome ${s.rep}, pogodba do ${s.contractUntil}.`);
    return { ok: true, text: `${s.first} ${s.last} je podpisal pogodbo do ${s.contractUntil} za ${s.wage} €/mes.` };
  }
  return { ok: true, text: '' };
}

// AI: zapolni prazna mesta, včasih odpusti trenerja ob slabih rezultatih (kliče se ob ponedeljkih)
export function aiStaffWeekly(state: GameState, posOf: (id: string) => number, gp: number): string[] {
  ensureStaff(state);
  const out: string[] = [];
  const rng = new Rng(state.seed + Number(state.date.replace(/-/g, '')));
  for (const c of state.clubs) {
    if (c.id === state.userClubId) continue;
    const exp = [...CLUBS].sort((a, b) => b.strength - a.strength).findIndex((x) => x.id === c.id) + 1;
    const head = staffOf(state, c.id, 'glavni');
    if (head && gp >= 10 && posOf(c.id) - exp >= 3 && rng.chance(0.12)) {
      fireStaff(state, head.id, c.id);
      out.push(`${c.short} je odpustil glavnega trenerja ${head.first} ${head.last}.`);
    }
    for (const role of ROLES) {
      if (staffOf(state, c.id, role)) continue;
      const pool = freeStaff(state).filter((s) => s.role === role && s.rep <= c.reputation + 12).sort((a, b) => b.rep - a.rep);
      const pick = pool[0];
      if (pick) {
        hireStaff(state, pick.id, rng.int(1, 3), c.id);
        if (role === 'glavni') out.push(`${c.short} ima novega glavnega trenerja: ${pick.first} ${pick.last} (renome ${pick.rep}).`);
      }
    }
  }
  if (freeStaff(state).length < 8) refreshStaffMarket(state, 6);
  return out;
}

// nova sezona: staranje, iztek pogodb, upokojitve, nov trg
export function staffNewSeason(state: GameState): string[] {
  ensureStaff(state);
  const out: string[] = [];
  const rng = new Rng(state.seed + 77 + state.seasonYear);
  const st = state.seasonRecords?.[state.seasonRecords.length - 1];
  for (const s of Object.values(state.staff!)) {
    s.age++;
    if (s.clubId) {
      // renome raste z uspehom kluba
      const champ = st?.champion === s.clubId;
      s.rep = clamp(s.rep + (champ ? rng.int(2, 5) : rng.int(-1, 1)), 10, 95);
    }
    if (s.age >= 66 && rng.chance(0.4)) {
      if (s.clubId === state.userClubId) out.push(`${s.first} ${s.last} (${ROLE_LABEL[s.role].toLowerCase()}) se je upokojil.`);
      delete state.staff![s.id];
      continue;
    }
    if (s.clubId && s.contractUntil < state.seasonYear) {
      if (s.clubId !== state.userClubId && rng.chance(0.7)) {
        s.contractUntil = state.seasonYear + rng.int(1, 2);
        s.wage = askingWage(s);
      } else {
        if (s.clubId === state.userClubId) out.push(`${s.first} ${s.last} je odšel, ker mu je potekla pogodba.`);
        s.clubId = null;
        s.wage = askingWage(s);
      }
    }
  }
  // stari prosti trenerji odidejo s trga
  for (const s of freeStaff(state)) if (rng.chance(0.35)) delete state.staff![s.id];
  refreshStaffMarket(state, 8);
  return out;
}

// podaljšanje pogodbe svojega trenerja
export function extendStaff(state: GameState, id: string, years: number): { ok: boolean; text: string } {
  const s = state.staff?.[id];
  if (!s || s.clubId !== state.userClubId) return { ok: false, text: 'Trener ni v tvojem štabu.' };
  s.wage = Math.max(s.wage, askingWage(s));
  s.contractUntil = Math.max(s.contractUntil, state.seasonYear) + clamp(years, 1, 3);
  return { ok: true, text: `Pogodba podaljšana do ${s.contractUntil} (${s.wage} €/mes).` };
}
