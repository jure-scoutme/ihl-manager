// Napoved medijev pred sezono in podelitev nagrad ob koncu sezone.
import { addStory, unlock } from './achievements';
import { clamp } from './rng';
import { staffImpact, staffOf } from './staff';
import type { GameState, Player, Standing } from './types';

export interface Award {
  key: 'mvp' | 'strelec' | 'golman' | 'branilec' | 'novinec' | 'trener';
  title: string;
  name: string;
  clubId: string;
  detail: string;
  playerId?: string;
}

const news = (s: GameState, title: string, body: string) =>
  s.news.unshift({ id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, date: s.date, kind: 'liga', title, body, read: false });
const short = (s: GameState, id: string) => s.clubs.find((c) => c.id === id)?.short ?? id;

export function makePrediction(s: GameState) {
  const score = (id: string) => {
    const top = Object.values(s.players).filter((p) => p.clubId === id).sort((a, b) => b.ovr - a.ovr).slice(0, 20);
    const avg = top.reduce((a, p) => a + p.ovr, 0) / Math.max(1, top.length);
    return avg + staffImpact(s, id) * 0.6;
  };
  const order = s.clubs.map((c) => c.id).sort((a, b) => score(b) - score(a));
  s.prediction = { season: s.seasonYear, order };
  const my = order.indexOf(s.userClubId) + 1;
  news(s, 'Napoved medijev', `Strokovnjaki pred sezono napovedujejo: ${order.map((id, i) => `${i + 1}. ${short(s, id)}`).join(', ')}. Tvojo ekipo vidijo na ${my}. mestu.`);
}

export function giveAwards(s: GameState, st: Standing[]) {
  const all = Object.values(s.players).filter((p) => p.clubId && p.stats.gp >= 8);
  const nm = (p: Player) => `${p.first} ${p.last}`;
  const pts = (p: Player) => p.stats.g + p.stats.a;
  const awards: Award[] = [];
  const pos = (id: string) => st.findIndex((x) => x.clubId === id) + 1;
  const sk = all.filter((p) => p.pos !== 'G');
  const mvp = [...sk].sort((a, b) => pts(b) * 1 + (10 - pos(b.clubId!)) * 0.8 + b.ovr / 10 - (pts(a) + (10 - pos(a.clubId!)) * 0.8 + a.ovr / 10))[0];
  if (mvp) awards.push({ key: 'mvp', title: 'Najkoristnejši igralec (MVP)', name: nm(mvp), clubId: mvp.clubId!, detail: `${mvp.stats.g} golov, ${mvp.stats.a} podaj`, playerId: mvp.id });
  const sc = [...sk].sort((a, b) => b.stats.g - a.stats.g)[0];
  if (sc) awards.push({ key: 'strelec', title: 'Najboljši strelec', name: nm(sc), clubId: sc.clubId!, detail: `${sc.stats.g} golov`, playerId: sc.id });
  const gk = all.filter((p) => p.pos === 'G' && p.stats.gp >= 10 && p.stats.sa > 0).sort((a, b) => (b.stats.sa - b.stats.ga) / b.stats.sa - (a.stats.sa - a.stats.ga) / a.stats.sa)[0];
  if (gk) awards.push({ key: 'golman', title: 'Najboljši golman', name: nm(gk), clubId: gk.clubId!, detail: `${(((gk.stats.sa - gk.stats.ga) / gk.stats.sa) * 100).toFixed(1)} % obramb`, playerId: gk.id });
  const df = sk.filter((p) => p.pos === 'D').sort((a, b) => pts(b) + b.stats.pm * 0.3 - (pts(a) + a.stats.pm * 0.3))[0];
  if (df) awards.push({ key: 'branilec', title: 'Najboljši branilec', name: nm(df), clubId: df.clubId!, detail: `${pts(df)} točk, ${df.stats.pm > 0 ? '+' : ''}${df.stats.pm}`, playerId: df.id });
  const rk = sk.filter((p) => s.seasonYear - p.birthYear <= 21).sort((a, b) => pts(b) - pts(a))[0];
  if (rk) awards.push({ key: 'novinec', title: 'Novinec leta', name: nm(rk), clubId: rk.clubId!, detail: `${s.seasonYear - rk.birthYear} let, ${pts(rk)} točk`, playerId: rk.id });
  // trener leta: največji preskok glede na napoved
  const pred = s.prediction?.season === s.seasonYear ? s.prediction.order : st.map((x) => x.clubId);
  const coach = [...st].map((x, i) => ({ id: x.clubId, gain: pred.indexOf(x.clubId) - i + (s.champion === x.clubId ? 1.5 : 0) })).sort((a, b) => b.gain - a.gain)[0];
  if (coach) {
    const isMe = coach.id === s.userClubId;
    const h = staffOf(s, coach.id, 'glavni');
    awards.push({ key: 'trener', title: 'Trener leta', name: isMe ? `${s.manager.first} ${s.manager.last}` : h ? `${h.first} ${h.last}` : short(s, coach.id), clubId: coach.id, detail: `napoved ${pred.indexOf(coach.id) + 1}., končal ${st.findIndex((x) => x.clubId === coach.id) + 1}.` });
    if (isMe) {
      s.manager.reputation = clamp(s.manager.reputation + 3, 1, 100);
      unlock(s, 'trener_leta');
    }
  }
  const season = `${s.seasonYear}/${String(s.seasonYear + 1).slice(2)}`;
  for (const a of awards) {
    const p = a.playerId ? s.players[a.playerId] : undefined;
    if (p && p.clubId === s.userClubId) {
      addStory(s, p, `${a.title} ${season}`);
      p.morale = clamp(p.morale + 10, 5, 100);
    }
  }
  s.lastAwards = { season, list: awards };
  news(s, `Nagrade IHL ${season}`, awards.map((a) => `${a.title}: ${a.name} (${short(s, a.clubId)}, ${a.detail})`).join(' · '));
}
