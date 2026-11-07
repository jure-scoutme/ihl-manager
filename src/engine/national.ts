// Reprezentance: SP U18 (april), SP U20 (december/januar), člansko SP (maj).
import { addStory, unlock } from './achievements';
import { Rng, clamp } from './rng';
import type { GameState, Player } from './types';

type Event = 'U18' | 'U20' | 'SP';
const NATIONS: { id: string; name: string; div: Record<Event, string>; seniorSlots: number; base: Record<Event, number> }[] = [
  { id: 'SLO', name: 'Slovenija', div: { U18: 'divizija I A', U20: 'divizija I A', SP: 'divizija I A' }, seniorSlots: 6, base: { SP: 66, U20: 54, U18: 48 } },
  { id: 'HR', name: 'Hrvaška', div: { U18: 'divizija II A', U20: 'divizija II A', SP: 'divizija II A' }, seniorSlots: 14, base: { SP: 61.5, U20: 48.5, U18: 43 } },
  { id: 'SRB', name: 'Srbija', div: { U18: 'divizija II A', U20: 'divizija II B', SP: 'divizija II A' }, seniorSlots: 16, base: { SP: 63.5, U20: 52.5, U18: 49 } },
];
const EVENT_NAME: Record<Event, string> = { U18: 'SP U18', U20: 'SP U20', SP: 'svetovno prvenstvo' };

const news = (s: GameState, kind: 'liga' | 'garderoba' | 'mediji', title: string, body: string) =>
  s.news.unshift({ id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, date: s.date, kind, title, body, read: false });

const allPlayers = (s: GameState): Player[] => [...Object.values(s.players).filter((p) => p.clubId), ...Object.values(s.youth ?? {})];

function callUp(s: GameState, ev: Event, days: number) {
  const year = Number(s.date.slice(0, 4)) + (ev === 'U20' ? 1 : 0);
  const maxAge = ev === 'U18' ? 17 : ev === 'U20' ? 19 : 99;
  s.national = { event: ev, year, squads: {} };
  const mine: string[] = [];
  for (const n of NATIONS) {
    const pool = allPlayers(s)
      .filter((p) => p.nat === n.id && !p.injuryDays && year - p.birthYear <= maxAge && (ev !== 'SP' || year - p.birthYear >= 18))
      .sort((a, b) => b.ovr - a.ovr);
    const slots = ev === 'SP' ? n.seniorSlots : 22;
    // mladinske reprezentance: igralci iz lige + mladinci; ostalo so igralci iz tujine
    const squad = pool.slice(0, slots);
    s.national.squads[n.id] = squad.map((p) => p.id);
    for (const p of squad) {
      p.awayDays = days;
      if (p.clubId === s.userClubId) {
        mine.push(`${p.first} ${p.last} (${n.name})`);
        p.morale = clamp(p.morale + 6, 0, 100);
        addStory(s, p, `Vpoklic v reprezentanco: ${n.name} ${ev === 'SP' ? '' : ev + ' '}(${EVENT_NAME[ev]} ${year})`.replace('  ', ' '));
      }
    }
  }
  const label = ev === 'SP' ? `Svetovno prvenstvo ${year}` : `${EVENT_NAME[ev]} ${year}`;
  if (mine.length) {
    const who = mine.join(', ');
    if (ev === 'SP') news(s, 'garderoba', `Vpoklici: ${label}`, `Selektorji so poklicali igralce tvojega kluba: ${who}.`);
    else news(s, 'garderoba', `Vpoklici: ${label}`, `Selektorji so poklicali igralce tvojega kluba: ${who}. Odsotni bodo približno ${days} dni.`);
    s.fans = clamp((s.fans ?? 50) + Math.min(3, mine.length), 0, 100);
    unlock(s, 'reprezentant');
  } else news(s, 'liga', `Vpoklici: ${label}`, 'Selektorji so objavili sezname. Iz tvojega kluba tokrat ni nikogar.');
}

function finish(s: GameState) {
  const nt = s.national;
  if (!nt) return;
  const rng = new Rng(s.seed + nt.year + nt.event.length);
  const lines: string[] = [];
  for (const n of NATIONS) {
    const squad = (nt.squads[n.id] ?? []).map((id) => s.players[id] ?? s.youth?.[id]).filter(Boolean) as Player[];
    const avg = squad.length ? squad.reduce((a, p) => a + p.ovr, 0) / squad.length : 45;
    // pričakovana raven divizije; SLO ima v članski ekipi tudi legionarje iz tujine
    const base = n.base[nt.event];
    const strength = avg + rng.normal(0, 2.5);
    const place = clamp(Math.round(3.5 - (strength - base) / 2.5), 1, 6);
    const extra = place === 1 ? ' in napredovanje v višjo divizijo!' : place === 6 ? ', kar pomeni izpad.' : '.';
    lines.push(`${n.name}: ${place}. mesto (${n.div[nt.event]})${extra}`);
    for (const p of squad) {
      const gp = 5;
      const ppg = Math.max(0, (p.ovr - 45) / 25) * (p.pos === 'G' ? 0 : p.pos === 'D' ? 0.6 : 1);
      const g = p.pos === 'G' ? 0 : Math.round(rng.next() * ppg * gp * 0.45);
      const a = p.pos === 'G' ? 0 : Math.round(rng.next() * ppg * gp * 0.55);
      p.caps = [...(p.caps ?? []), { event: `${EVENT_NAME[nt.event]} ${nt.year}`, team: nt.event === 'SP' ? n.id : `${n.id} ${nt.event}`, gp, g, a, place }];
      if (p.clubId === s.userClubId) {
        addStory(s, p, `${EVENT_NAME[nt.event]} ${nt.year}: ${place}. mesto, ${g} golov, ${a} podaj`);
        if (g + a >= 5) news(s, 'mediji', `Odlično na ${EVENT_NAME[nt.event]}: ${p.first} ${p.last}`, `${p.first} ${p.last} je za reprezentanco zbral ${g + a} točk (${g} golov, ${a} podaj).`);
      }
    }
  }
  news(s, 'liga', `Konec: ${EVENT_NAME[nt.event]} ${nt.year}`, lines.join(' '));
  if (nt.event === 'SP') {
    const myCalls = (nt.squads.SLO ?? []).concat(nt.squads.HR ?? [], nt.squads.SRB ?? []).filter((id) => s.players[id]?.clubId === s.userClubId).length;
    if (myCalls >= 2) s.manager.reputation = clamp(s.manager.reputation + 1, 1, 100);
  }
  s.national = undefined;
}

// dnevno preverjanje koledarja reprezentanc
export function nationalDay(s: GameState) {
  const md = s.date.slice(5);
  if (md === '12-15') callUp(s, 'U20', 21);
  if (md === '01-05') finish(s);
  if (md === '04-05') callUp(s, 'U18', 18);
  if (md === '04-25') finish(s);
  if (md === '05-02') callUp(s, 'SP', 0);
  if (md === '05-22') finish(s);
  for (const p of [...Object.values(s.players), ...Object.values(s.youth ?? {})]) if ((p.awayDays ?? 0) > 0) p.awayDays!--;
}
