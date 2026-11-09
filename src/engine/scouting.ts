// Skavtiranje: atributi in potencial tujih igralcev so delno skriti, dokler jih skavt ne oceni.
import { Rng, clamp } from './rng';
import { pushNews } from './news';
import type { Attrs, GameState, Player } from './types';


const lvl = (s: GameState) => s.infra?.[s.userClubId]?.scouting ?? 1;

export function knowledge(s: GameState, p: Player): number {
  if (p.clubId === s.userClubId) return 100;
  const k = s.scout?.known?.[p.id];
  if (k !== undefined) return k;
  // igralci v ligi so delno znani, prosti igralci in tuji mladinci manj
  const base = p.youth ? 20 : p.clubId ? 45 : p.abroad ? 25 : 30;
  return clamp(base + (lvl(s) - 1) * 8, 0, 95);
}

function offset(p: Player, salt: number) {
  let h = 0;
  for (let i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i) + salt) >>> 0;
  return ((h % 1000) / 1000) - 0.5; // -0.5 .. 0.5
}

export const attrErr = (k: number) => (k >= 100 ? 0 : Math.max(1, Math.round((100 - k) / 18)));

export function attrRange(s: GameState, p: Player, key: keyof Attrs): [number, number] {
  const k = knowledge(s, p);
  const e = attrErr(k);
  if (!e) return [p.attrs[key], p.attrs[key]];
  const c = p.attrs[key] + Math.round(offset(p, key.length * 7) * e);
  return [clamp(c - e, 1, 20), clamp(c + e, 1, 20)];
}

export function shownOvr(s: GameState, p: Player): { value: number; exact: boolean } {
  const k = knowledge(s, p);
  if (k >= 100) return { value: p.ovr, exact: true };
  const e = Math.round((100 - k) / 12);
  return { value: clamp(p.ovr + Math.round(offset(p, 3) * e * 2), 30, 99), exact: false };
}

export function shownPotential(s: GameState, p: Player): string {
  const k = knowledge(s, p);
  if (k >= 100) return String(p.potential);
  if (k < 60) return '?';
  const e = Math.round((100 - k) / 6);
  const c = p.potential + Math.round(offset(p, 11) * e);
  return `${clamp(c - e, 30, 99)}–${clamp(c + e, 30, 99)}`;
}

export const potentialKnown = (s: GameState, p: Player) => knowledge(s, p) >= 70;

export const scoutSlots = (s: GameState) => lvl(s) + 1;
export const scoutDays = (s: GameState) => Math.max(2, Math.round(9 - lvl(s) * 1.5));
export const scouting = (s: GameState, id: string) => s.scout?.tasks.find((t) => t.playerId === id);

export function assignScout(s: GameState, id: string): { ok: boolean; text: string } {
  s.scout = s.scout ?? { known: {}, tasks: [] };
  const p = s.players[id] ?? s.youth?.[id];
  if (!p) return { ok: false, text: 'Igralec ne obstaja.' };
  if (knowledge(s, p) >= 100) return { ok: false, text: 'Igralec je že v celoti ocenjen.' };
  if (scouting(s, id)) return { ok: false, text: 'Skavt že spremlja tega igralca.' };
  if (s.scout.tasks.length >= scoutSlots(s)) return { ok: false, text: `Vsi skavti so zasedeni (${scoutSlots(s)}). Več skavtov dobiš z nadgradnjo skavtske službe.` };
  const d = new Date(s.date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + scoutDays(s));
  s.scout.tasks.push({ playerId: id, until: d.toISOString().slice(0, 10) });
  return { ok: true, text: `Skavt je odšel spremljat igralca ${p.first} ${p.last}. Poročilo pričakuj čez ${scoutDays(s)} dni.` };
}

function report(s: GameState, p: Player): string {
  const club = s.clubs.find((c) => c.id === s.userClubId)!;
  const avg = Object.values(s.players).filter((x) => x.clubId === s.userClubId).sort((a, b) => b.ovr - a.ovr).slice(0, 18);
  const lineup = avg.length ? avg[avg.length - 1].ovr : 55;
  const top = avg.length ? avg[Math.min(5, avg.length - 1)].ovr : 65;
  const age = s.seasonYear - p.birthYear;
  const grade = p.ovr >= top ? 'A' : p.ovr >= lineup + 2 ? 'B' : p.ovr >= lineup - 3 ? 'C' : p.potential >= top ? 'B' : 'D';
  const now = grade === 'A' ? 'Takojšnja okrepitev za prvo postavo.' : grade === 'B' ? 'Dober igralec za rotacijo.' : grade === 'C' ? 'Igralec za globino kadra.' : 'Trenutno ni na ravni naše ekipe.';
  const fut = p.potential - p.ovr >= 10 && age <= 22 ? ' Ima velik potencial in lahko postane zvezda lige.' : p.potential - p.ovr >= 5 && age <= 24 ? ' Še bo napredoval.' : age >= 31 ? ' Vrhunec kariere ima za sabo.' : '';
  void club;
  return `Ocena ${grade}: ${now}${fut} Ocena ${p.ovr}, potencial ${p.potential}.`;
}

export function scoutDay(s: GameState) {
  if (!s.scout?.tasks.length) return;
  const done = s.scout.tasks.filter((t) => t.until <= s.date);
  s.scout.tasks = s.scout.tasks.filter((t) => t.until > s.date);
  for (const t of done) {
    const p = s.players[t.playerId] ?? s.youth?.[t.playerId];
    if (!p) continue;
    s.scout.known[p.id] = 100;
    pushNews(s, 'klub', `Skavtsko poročilo: ${p.first} ${p.last}`, report(s, p), { from: 'Glavni skavt', action: { label: 'Profil igralca', href: `/igralec?id=${p.id}` } });
  }
  // znanje o igralcih počasi zastari ob menjavi sezone ni potrebno; počisti pokojne
  void Rng;
}
