// Pretekle sezone za igralce, ki jih igra še ni videla (nova igra, prosti igralci, uvoz).
// Statistika je ocenjena iz ocene igralca, da trg in profil nista prazna.
import { Rng } from './rng';
import { FOREIGN } from './sales';
import type { GameState, Player, SkaterStats } from './types';

const lbl = (y: number) => `${y}/${String(y + 1).slice(2)}`;

function skaterSeason(rng: Rng, p: Player, ovr: number, gpMax: number): SkaterStats {
  const d = p.pos === 'D';
  const gp = Math.max(4, Math.min(gpMax, Math.round(gpMax * (0.55 + Math.min(0.45, (ovr - 45) / 40)) + rng.normal(0, 3))));
  const ppg = Math.max(0.03, ((ovr - 44) / 26) * (d ? 0.45 : 1) * (0.75 + rng.next() * 0.5));
  const pts = Math.max(0, Math.round(gp * ppg + rng.normal(0, 1.5)));
  const g = Math.round(pts * (d ? 0.22 : 0.45) * (0.8 + rng.next() * 0.4));
  return { gp, g, a: Math.max(0, pts - g), pim: Math.round(gp * (0.3 + rng.next() * 1.1)), pm: Math.round(rng.normal((ovr - 55) / 3, 5)), sog: Math.round(g * (6 + rng.next() * 4) + gp * 0.6), sa: 0, ga: 0, w: 0, so: 0 };
}

function goalieSeason(rng: Rng, ovr: number, gpMax: number): SkaterStats {
  const gp = Math.max(2, Math.min(gpMax, Math.round(gpMax * (0.25 + Math.min(0.6, (ovr - 45) / 35)) + rng.normal(0, 3))));
  const sv = Math.min(0.945, Math.max(0.85, 0.872 + (ovr - 55) * 0.0022 + rng.normal(0, 0.008)));
  const sa = Math.round(gp * (27 + rng.next() * 6));
  return { gp, g: 0, a: rng.chance(0.3) ? 1 : 0, pim: rng.int(0, 4), pm: 0, sog: 0, sa, ga: Math.round(sa * (1 - sv)), w: Math.round(gp * (0.3 + (ovr - 50) / 60) * (0.8 + rng.next() * 0.4)), so: rng.chance(sv > 0.915 ? 0.5 : 0.15) ? rng.int(1, 3) : 0 };
}

function seed(s: GameState, p: Player, rng: Rng) {
  const age = s.seasonYear - p.birthYear;
  const seasons = Math.min(3, Math.max(0, age - 18));
  const ihl = s.clubs.map((c) => c.id);
  const foreign = FOREIGN.filter((L) => p.ovr >= L.minOvr - 6);
  for (let k = seasons; k >= 1; k--) {
    const y = s.seasonYear - k;
    const ovrThen = Math.max(35, p.ovr - (age - k <= 23 ? 3 * k : age - k >= 31 ? -k : 0));
    let clubId: string;
    let gpMax = 32;
    if (p.abroad) {
      clubId = k === 1 || rng.chance(0.6) ? p.abroad.club : rng.pick(ihl);
      gpMax = 44;
    } else if (p.clubId && (k === 1 ? rng.chance(0.75) : rng.chance(0.5))) clubId = p.clubId;
    else if (!p.real && foreign.length && rng.chance(0.25)) {
      const L = rng.pick(foreign);
      clubId = rng.pick(L.clubs);
      gpMax = 44;
    } else clubId = rng.pick(ihl.filter((c) => c !== p.clubId)) ?? ihl[0];
    const stats = p.pos === 'G' ? goalieSeason(rng, ovrThen, gpMax) : skaterSeason(rng, p, ovrThen, gpMax);
    p.history.push({ season: lbl(y), clubId, stats });
  }
}

// doda pretekle sezone vsem odraslim igralcem, ki še nimajo zgodovine
export function ensureHistory(s: GameState) {
  let rng: Rng | null = null;
  for (const p of Object.values(s.players)) {
    if (p.hs) continue;
    p.hs = true;
    if (p.history.length || p.youth || s.seasonYear - p.birthYear < 19) continue;
    rng ??= new Rng((s.seed ^ 0x5eed) + s.seasonYear * 7919 + Object.keys(s.players).length);
    seed(s, p, rng);
  }
}

// zadnja odigrana sezona (tekoča, če je že kaj tekem, sicer lanska)
export function shownSeason(s: GameState, p: Player): { label: string; stats: SkaterStats; clubId: string | null; current: boolean } | null {
  if (p.stats.gp > 0) return { label: lbl(s.seasonYear), stats: p.stats, clubId: p.clubId, current: true };
  const h = [...p.history].reverse().find((x) => !/ U\d\d$/.test(x.season));
  return h ? { label: h.season, stats: h.stats, clubId: h.clubId, current: false } : null;
}

export const svPct = (st: SkaterStats) => (st.sa ? ((st.sa - st.ga) / st.sa) * 100 : 0);
