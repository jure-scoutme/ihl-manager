// Trening (tedenski poudarek in intenzivnost) ter kemija med igralci.
import { calcOvr } from './players';
import { Rng, clamp } from './rng';
import { staffOf, type StaffBoost } from './staff';
import type { Attrs, GameState, Player } from './types';

export type Focus = 'napad' | 'obramba' | 'posebne' | 'kondicija' | 'vratarji' | 'taktika' | 'pocitek';
export type Intensity = 'nizka' | 'normalna' | 'visoka';
export interface TrainingPlan {
  focus: Focus;
  intensity: Intensity;
  delegated: boolean;
  lastGains?: { id: string; attr: keyof Attrs; date: string }[];
}

export const FOCUS: { id: Focus; label: string; desc: string }[] = [
  { id: 'napad', label: 'Napad', desc: 'Streli, podaje in vodenje ploščka. Več golov.' },
  { id: 'obramba', label: 'Obramba', desc: 'Postavljanje, blokiranje in moč. Manj prejetih golov.' },
  { id: 'posebne', label: 'Igralec več / manj', desc: 'Vaje za presilo in kazni. Boljši PP in PK.' },
  { id: 'kondicija', label: 'Kondicija', desc: 'Hitrejša regeneracija in vzdržljivost.' },
  { id: 'vratarji', label: 'Vratarji', desc: 'Poseben poudarek na golmanih.' },
  { id: 'taktika', label: 'Taktika in uigranost', desc: 'Napadi in pari se hitreje uigrajo (kemija).' },
  { id: 'pocitek', label: 'Počitek', desc: 'Lahek teden: svežina in morala, a manj ostrine.' },
];
export const INTENSITY: { id: Intensity; label: string; desc: string }[] = [
  { id: 'nizka', label: 'Nizka', desc: 'Manj napredka, hitrejša regeneracija.' },
  { id: 'normalna', label: 'Normalna', desc: 'Uravnoteženo.' },
  { id: 'visoka', label: 'Visoka', desc: 'Več napredka in učinka, a utrujenost in več poškodb.' },
];

const FOCUS_ATTRS: Record<Focus, (keyof Attrs)[]> = {
  napad: ['shooting', 'passing', 'puckHandling', 'skating'],
  obramba: ['positioning', 'blocking', 'strength', 'decisions'],
  posebne: ['passing', 'decisions', 'positioning', 'faceoffs'],
  kondicija: ['stamina', 'speed', 'strength', 'skating'],
  vratarji: ['reflexes', 'gPositioning', 'reboundControl', 'puckPlay'],
  taktika: ['decisions', 'positioning', 'workRate', 'passing'],
  pocitek: [],
};
const GOALIE_ATTRS: (keyof Attrs)[] = ['reflexes', 'gPositioning', 'reboundControl', 'puckPlay'];

export function planOf(s: GameState, clubId: string): TrainingPlan {
  s.training = s.training ?? {};
  if (!s.training[clubId]) s.training[clubId] = { focus: 'taktika', intensity: 'normalna', delegated: clubId !== s.userClubId };
  return s.training[clubId];
}

const iMult = (i: Intensity) => (i === 'visoka' ? 1.5 : i === 'nizka' ? 0.5 : 1);

// učinek treninga na tekmo (množitelji)
export function trainingBoost(s: GameState, clubId: string): StaffBoost {
  const p = planOf(s, clubId);
  const m = iMult(p.intensity);
  const b: StaffBoost = { off: 1, def: 1, pp: 1, pk: 1, goalie: 1 };
  if (p.focus === 'napad') b.off += 0.02 * m;
  if (p.focus === 'obramba') b.def += 0.02 * m;
  if (p.focus === 'posebne') { b.pp += 0.035 * m; b.pk += 0.035 * m; }
  if (p.focus === 'vratarji') b.goalie += 0.015 * m;
  if (p.focus === 'taktika') { b.off += 0.006 * m; b.def += 0.006 * m; }
  if (p.focus === 'pocitek') { b.off -= 0.01; b.def -= 0.01; }
  return b;
}

// faktor regeneracije svežine
export function recoveryFactor(s: GameState, clubId: string | null) {
  if (!clubId) return 1;
  const p = planOf(s, clubId);
  let f = p.intensity === 'visoka' ? 0.82 : p.intensity === 'nizka' ? 1.15 : 1;
  if (p.focus === 'kondicija') f *= 1.1;
  if (p.focus === 'pocitek') f *= 1.35;
  return f;
}

// pomočnik izbere trening glede na stanje ekipe
export function autoPlan(s: GameState, clubId: string, rng: Rng): TrainingPlan {
  const plan = planOf(s, clubId);
  const players = Object.values(s.players).filter((p) => p.clubId === clubId);
  const energy = players.reduce((a, p) => a + p.energy, 0) / Math.max(1, players.length);
  const a = staffOf(s, clubId, 'pomocnik');
  const smart = rng.chance(clamp(((a?.rep ?? 20) + 20) / 100, 0.2, 0.95));
  const recent = s.fixtures.filter((f) => f.played && f.result && f.stage !== 'prijateljska' && (f.home === clubId || f.away === clubId)).slice(-4);
  const gf = recent.reduce((x, f) => x + (f.home === clubId ? f.result!.hg : f.result!.ag), 0) / Math.max(1, recent.length);
  const ga = recent.reduce((x, f) => x + (f.home === clubId ? f.result!.ag : f.result!.hg), 0) / Math.max(1, recent.length);
  let focus: Focus;
  let intensity: Intensity = 'normalna';
  if (!smart) focus = rng.pick(['napad', 'obramba', 'taktika', 'kondicija'] as const);
  else if (energy < 72) { focus = 'pocitek'; intensity = 'nizka'; }
  else if (s.phase === 'poletje') { focus = 'kondicija'; intensity = 'visoka'; }
  else if (ga - gf > 1) focus = 'obramba';
  else if (gf < 2.5) focus = 'napad';
  else if (a?.spec === 'PP' || a?.spec === 'PK') focus = 'posebne';
  else focus = 'taktika';
  if (smart && energy > 88 && focus !== 'pocitek') intensity = 'visoka';
  plan.focus = focus;
  plan.intensity = intensity;
  return plan;
}

// tedenski trening: napredek mladih, utrujenost, poškodbe na treningu (kliče se ob ponedeljkih)
export function weeklyTraining(s: GameState): string[] {
  const out: string[] = [];
  const rng = new Rng(s.seed + Number(s.date.replace(/-/g, '')) + 17);
  for (const c of s.clubs) {
    const plan = c.id === s.userClubId && !planOf(s, c.id).delegated ? planOf(s, c.id) : autoPlan(s, c.id, rng);
    if (c.id === s.userClubId && plan.delegated) {
      const f = FOCUS.find((x) => x.id === plan.focus)!;
      out.push(`Pomočnik je za ta teden izbral trening: ${f.label.toLowerCase()} (${plan.intensity} intenzivnost).`);
    }
    const m = iMult(plan.intensity);
    const head = staffOf(s, c.id, 'glavni');
    const gk = staffOf(s, c.id, 'vratarji');
    const tr = s.infra?.[c.id]?.training ?? 2;
    const gains: { id: string; attr: keyof Attrs; date: string }[] = [];
    for (const p of Object.values(s.players)) {
      if (p.clubId !== c.id || p.injuryDays > 0) continue;
      const age = s.seasonYear - p.birthYear;
      if (plan.focus === 'pocitek') { p.morale = clamp(p.morale + 2, 0, 100); continue; }
      // utrujenost in poškodbe pri visoki intenzivnosti
      if (plan.intensity === 'visoka') {
        p.energy = clamp(p.energy - 4, 30, 100);
        if (rng.chance(0.004)) {
          p.injuryDays = rng.int(3, 12);
          if (c.id === s.userClubId) out.push(`${p.first} ${p.last} se je poškodoval na treningu (${p.injuryDays} dni).`);
        }
      }
      if (age > 24 || p.ovr >= p.potential) continue;
      const coach = p.pos === 'G' ? (gk?.rep ?? 20) : (head?.rep ?? 20);
      const chance = (0.05 + (tr - 2) * 0.01 + (coach - 50) / 1500 + (age <= 20 ? 0.02 : 0)) * m * (p.personality === 'delaven' || p.personality === 'profesionalec' ? 1.3 : 1);
      if (!rng.chance(Math.max(0.01, chance))) continue;
      const pool = p.pos === 'G' ? GOALIE_ATTRS : FOCUS_ATTRS[plan.focus].filter((k) => !GOALIE_ATTRS.includes(k));
      if (!pool.length) continue;
      const k = rng.pick(pool);
      if (p.attrs[k] >= 20) continue;
      p.attrs[k]++;
      const before = p.ovr;
      p.ovr = Math.min(p.potential, calcOvr(p.pos, p.attrs));
      if (p.ovr < before) p.ovr = before;
      gains.push({ id: p.id, attr: k, date: s.date });
    }
    if (c.id === s.userClubId) planOf(s, c.id).lastGains = [...gains, ...(planOf(s, c.id).lastGains ?? [])].slice(0, 30);
  }
  pruneChem(s);
  return out;
}

// ---------- kemija ----------
const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export function pairChem(s: GameState, a: Player, b: Player): number {
  const k = key(a.id, b.id);
  const v = s.chem?.[k];
  if (v !== undefined) return v;
  let base = 35;
  if (a.nat === b.nat) base += 8;
  if (a.mentorId === b.id || b.mentorId === a.id) base += 10;
  if (a.homegrown && a.homegrown === b.homegrown) base += 8;
  return base;
}

export function groupChem(s: GameState, ids: string[]): number {
  const ps = ids.map((id) => s.players[id]).filter(Boolean);
  if (ps.length < 2) return 50;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) { sum += pairChem(s, ps[i], ps[j]); n++; }
  return Math.round(sum / n);
}

// po tekmi: igralci v istem napadu / paru se uigrajo
export function growChem(s: GameState, clubId: string) {
  const lines = s.lines[clubId];
  if (!lines) return;
  s.chem = s.chem ?? {};
  const fast = planOf(s, clubId).focus === 'taktika' ? 2 : 1;
  const groups = [...lines.f, ...lines.d, ...(lines.pp ?? []).map((u) => [...u.f, ...u.d]), ...(lines.pk ?? []).map((u) => [...u.f, ...u.d])];
  for (const g of groups) {
    const ps = g.map((id) => s.players[id]).filter(Boolean);
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++) {
        const k = key(ps[i].id, ps[j].id);
        const cur = s.chem[k] ?? pairChem(s, ps[i], ps[j]);
        s.chem[k] = clamp(cur + (cur < 60 ? 2.5 : cur < 80 ? 1.5 : 0.6) * fast, 0, 100);
      }
  }
}

// odstrani pare, ki niso več v istem klubu
function pruneChem(s: GameState) {
  if (!s.chem) return;
  for (const k of Object.keys(s.chem)) {
    const [a, b] = k.split('|');
    const pa = s.players[a];
    const pb = s.players[b];
    if (!pa || !pb || !pa.clubId || pa.clubId !== pb.clubId) delete s.chem[k];
    else s.chem[k] = Math.max(30, s.chem[k] - 0.3); // počasno pozabljanje
  }
}

// kemija za simulacijo: avg kemija vseh parov na ledu -> množitelj
export const chemMult = (chem: number) => 1 + ((chem - 50) / 50) * 0.035;

export function combine(a: StaffBoost, b: StaffBoost): StaffBoost {
  return { off: a.off * b.off, def: a.def * b.def, pp: a.pp * b.pp, pk: a.pk * b.pk, goalie: a.goalie * b.goalie };
}
