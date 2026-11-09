// Marketinški oddelek: sezonske karte, akcije za tekme, kampanje, sponzorska mesta, trgovina in komercialni objekti.
// Velja samo za klub uporabnika; AI klubi ostanejo na osnovnem modelu financ.
import { book, isDerby, refPrice } from './finance';
import { pushNews } from './news';
import { Rng, clamp } from './rng';
import type { Fixture, GameState } from './types';

export type PromoKey = 'none' | 'kids' | 'two' | 'stud' | 'theme';
export type CampaignKey = 'social' | 'posters' | 'schools' | 'signing' | 'video' | 'tv';
export type SlotKey = 'hrbet' | 'rokav' | 'celada' | 'hlace' | 'led' | 'ograja' | 'zaslon' | 'dvorana' | 'splet';
export type FacilityKey = 'fanshop' | 'loze' | 'bife';

export interface MarketingState {
  seasonPrice: number;
  seasonSold: number;
  seasonYear: number; // sezona, za katero so prodane karte
  promos: Record<string, PromoKey>; // fixtureId -> akcija
  campaigns: { key: CampaignKey; start: string; end: string; cost: number }[];
  slots: Partial<Record<SlotKey, { sponsor: string; monthly: number; until: number }>>;
  offers: { slot: SlotKey; sponsor: string; monthly: number; years: number; expires: string }[];
  searching: Partial<Record<SlotKey, string>>; // slot -> datum, ko pride ponudba
  facilities: Record<FacilityKey, number>; // 0-3
  builds: { key: FacilityKey; finish: string; cost: number }[];
  merch: number; // prodaja trgovine zadnji mesec
}

export const PROMOS: Record<PromoKey, { label: string; desc: string; att: number; rev: number; cost: number; fans: number }> = {
  none: { label: 'Brez akcije', desc: 'Običajne cene.', att: 1, rev: 1, cost: 0, fans: 0 },
  kids: { label: 'Otroci zastonj', desc: 'Družine pridejo v večjem številu, navdušenje navijačev +2.', att: 1.18, rev: 0.93, cost: 0, fans: 2 },
  two: { label: '2 za 1', desc: 'Veliko več gledalcev, a manjši prihodek na vstopnico.', att: 1.3, rev: 0.7, cost: 0, fans: 1 },
  stud: { label: 'Študentski popust', desc: 'Mladi navijači, več vzdušja v dvorani.', att: 1.08, rev: 0.96, cost: 0, fans: 1 },
  theme: { label: 'Tematska tekma', desc: 'Posebni dresi in šov v odmoru. Stane 400 €, navdušenje +3.', att: 1.12, rev: 1, cost: 400, fans: 3 },
};

export const CAMPAIGNS: Record<CampaignKey, { label: string; desc: string; cost: number; days: number; att: number; fansDay: number; merch: number; req?: { loze?: number; fans?: number } }> = {
  social: { label: 'Družbena omrežja', desc: 'Oglasi in objave pred tekmami. Obisk +6 %.', cost: 300, days: 7, att: 0.06, fansDay: 0.15, merch: 0 },
  posters: { label: 'Plakati in radio', desc: 'Oglaševanje po mestu. Obisk +8 %.', cost: 500, days: 10, att: 0.08, fansDay: 0.1, merch: 0 },
  schools: { label: 'Obisk šol', desc: 'Igralci obiščejo šole. Počasi pridobiva mlade navijače.', cost: 150, days: 21, att: 0.03, fansDay: 0.2, merch: 0.05 },
  signing: { label: 'Podpisovanje po tekmi', desc: 'Navdušenje +3, prodaja dresov +15 %.', cost: 100, days: 7, att: 0, fansDay: 0.4, merch: 0.15 },
  video: { label: 'Video serija »Za kuliso«', desc: 'Mesec dni vsebin iz slačilnice. Veliko novih navijačev.', cost: 800, days: 30, att: 0.04, fansDay: 0.25, merch: 0.1 },
  tv: { label: 'TV prenos tekem', desc: 'Prenosi domačih tekem. Sponzorji plačajo več (+15 %).', cost: 1500, days: 30, att: -0.03, fansDay: 0.3, merch: 0.1, req: { loze: 1, fans: 70 } },
};

export const SLOTS: Record<SlotKey, { label: string; group: 'dres' | 'dvorana' | 'digital'; base: number }> = {
  hrbet: { label: 'Hrbet pod številko', group: 'dres', base: 0.11 },
  rokav: { label: 'Rokav', group: 'dres', base: 0.05 },
  celada: { label: 'Čelada', group: 'dres', base: 0.045 },
  hlace: { label: 'Hlače', group: 'dres', base: 0.04 },
  led: { label: 'Sredina ledu', group: 'dvorana', base: 0.1 },
  ograja: { label: 'Paket ograj', group: 'dvorana', base: 0.09 },
  zaslon: { label: 'LED zaslon', group: 'dvorana', base: 0.06 },
  dvorana: { label: 'Ime dvorane', group: 'dvorana', base: 0.15 },
  splet: { label: 'Spletna stran in omrežja', group: 'digital', base: 0.04 },
};

export const FACILITIES: Record<FacilityKey, { label: string; desc: (lv: number) => string; cost: (lv: number) => number; days: (lv: number) => number }> = {
  fanshop: { label: 'Fanshop', desc: (l) => `Prodaja dresov in šalov +${(l + 1) * 40} %.`, cost: (l) => 4000 + l * 5000, days: (l) => 20 + l * 10 },
  loze: { label: 'VIP lože', desc: (l) => `+${(l + 1) * 600} €/mes od podjetij. Pogoj za TV prenos.`, cost: (l) => 9000 + l * 6000, days: (l) => 45 + l * 15 },
  bife: { label: 'Bife in hrana', desc: (l) => `Zaslužek na gledalca +${((l + 1) * 0.6).toFixed(1)} €.`, cost: (l) => 3000 + l * 3000, days: (l) => 15 + l * 10 },
};

const BRANDS = ['Alpska mlekarna', 'Kranjski avto center', 'Gradnje Sava', 'Pivovarna Triglav', 'Elektro servis Novak', 'Optika Vid', 'Pekarna Zlato zrno', 'Fitnes Gibko', 'Zavarovalnica Gorenjc', 'Tiskarna Papir', 'Kava Jutro', 'Transport Kolar', 'Pizzeria Ledena', 'Športna trgovina Dres', 'IT Rešitve Bit', 'Hotel Gora'];

const addDays = (d: string, n: number) => {
  const x = new Date(d + 'T12:00:00Z');
  x.setUTCDate(x.getUTCDate() + Math.round(n));
  return x.toISOString().slice(0, 10);
};
const eur = (n: number) => `${Math.round(n).toLocaleString('sl-SI')} €`;
const rngOf = (s: GameState, salt: number) => new Rng(s.seed + Number(s.date.replace(/-/g, '')) * 7 + salt);

export function ensureMarketing(s: GameState) {
  if (s.mkt) return;
  const club = s.clubs.find((c) => c.id === s.userClubId)!;
  const rng = new Rng(s.seed + 4242);
  const reg = s.finance?.[club.id]?.prices.regular ?? refPrice(club);
  const slots: MarketingState['slots'] = {};
  for (const k of Object.keys(SLOTS) as SlotKey[]) {
    if (k === 'dvorana' || !rng.chance(0.45 + club.budget * 0.05)) continue;
    const used = Object.values(slots).map((x) => x!.sponsor);
    slots[k] = { sponsor: rng.pick(BRANDS.filter((x) => !used.includes(x))), monthly: Math.round(slotValue(s, k) * (0.85 + rng.next() * 0.2) / 10) * 10, until: s.seasonYear + rng.int(1, 2) };
  }
  s.mkt = {
    seasonPrice: reg * 11,
    seasonSold: 0,
    seasonYear: s.seasonYear,
    promos: {},
    campaigns: [],
    slots,
    offers: [],
    searching: {},
    facilities: { fanshop: club.budget >= 3 ? 1 : 0, loze: 0, bife: 1 },
    builds: [],
    merch: 0,
  };
  s.mkt.seasonSold = seasonDemand(s, s.mkt.seasonPrice);
  s.mkt.merch = merchEstimate(s);
}

// --- vrednosti ---
export function slotValue(s: GameState, k: SlotKey) {
  const club = s.clubs.find((c) => c.id === s.userClubId)!;
  const fans = s.fans ?? 50;
  const main = s.finance?.[club.id]?.sponsor.monthly ?? 4000;
  const tv = activeCampaign(s, 'tv') ? 1.15 : 1;
  return Math.round(main * SLOTS[k].base * (0.75 + fans / 200) * tv);
}

export function seasonDemand(s: GameState, price: number) {
  const club = s.clubs.find((c) => c.id === s.userClubId)!;
  const ref = (s.finance?.[club.id]?.prices.regular ?? refPrice(club)) * 11;
  const base = (40 + club.reputation * 2.2) * (0.6 + (s.fans ?? 50) / 125);
  return Math.round(clamp(base * Math.pow(ref / Math.max(1, price), 1.3), 0, club.arena.capacity * 0.5));
}

export const activeCampaign = (s: GameState, k: CampaignKey) => (s.mkt?.campaigns ?? []).some((c) => c.key === k && c.start <= s.date && c.end >= s.date);
const formFactor = (s: GameState) => ((s.streak ?? 0) <= -3 ? 0.5 : 1);

// faktor obiska za domačo tekmo uporabnika (akcija + kampanje)
export function attendanceBoost(s: GameState, f: Fixture) {
  if (!s.mkt || f.home !== s.userClubId) return 1;
  let m = PROMOS[s.mkt.promos[f.id] ?? 'none'].att;
  for (const c of s.mkt.campaigns) if (c.start <= f.date && c.end >= f.date) m += CAMPAIGNS[c.key].att * formFactor(s);
  return m;
}

// prihodki tekme za uporabnika: imetniki sezonskih kart ne plačajo vstopnice, akcija spremeni prihodek
export function userMatchIncome(s: GameState, f: Fixture, attendance: number, price: number) {
  const m = s.mkt!;
  const promo = PROMOS[m.promos[f.id] ?? 'none'];
  const holders = Math.min(attendance, Math.round(m.seasonSold * 0.85));
  const paying = Math.max(0, attendance - holders);
  book(s, f.home, 'vstopnice', Math.round(paying * price * promo.rev));
  book(s, f.home, 'bar', Math.round(attendance * (1.6 + m.facilities.bife * 0.6)));
  if (promo.cost) book(s, f.home, 'marketing', -promo.cost);
  if (promo.fans) s.fans = clamp((s.fans ?? 50) + promo.fans, 0, 100);
}

// --- dejanja uporabnika ---
export function setPromo(s: GameState, fixtureId: string, k: PromoKey) {
  if (!s.mkt) return;
  if (k === 'none') delete s.mkt.promos[fixtureId];
  else s.mkt.promos[fixtureId] = k;
}

export function startCampaign(s: GameState, k: CampaignKey): { ok: boolean; text: string } {
  const m = s.mkt!;
  const c = CAMPAIGNS[k];
  if (activeCampaign(s, k)) return { ok: false, text: 'Ta kampanja že teče.' };
  if (c.req?.loze && m.facilities.loze < c.req.loze) return { ok: false, text: 'Za TV prenos potrebuješ VIP lože.' };
  if (c.req?.fans && (s.fans ?? 50) < c.req.fans) return { ok: false, text: `Za TV prenos potrebuješ navdušenje navijačev vsaj ${c.req.fans}.` };
  if (s.finance[s.userClubId].balance < c.cost) return { ok: false, text: 'Na računu ni dovolj denarja.' };
  book(s, s.userClubId, 'marketing', -c.cost);
  m.campaigns.push({ key: k, start: s.date, end: addDays(s.date, c.days - 1), cost: c.cost });
  return { ok: true, text: `Kampanja »${c.label}« se je začela in traja ${c.days} dni.` };
}

export function searchSponsor(s: GameState, k: SlotKey): { ok: boolean; text: string } {
  const m = s.mkt!;
  if (m.slots[k]) return { ok: false, text: 'To mesto je že prodano.' };
  if (m.searching[k] || m.offers.some((o) => o.slot === k)) return { ok: false, text: 'Iskanje že poteka ali ponudba čaka.' };
  const rng = rngOf(s, k.length * 13);
  m.searching[k] = addDays(s.date, rng.int(3, 8));
  return { ok: true, text: 'Komercialist išče sponzorja. Ponudbo pričakuj v nekaj dneh.' };
}

export function answerOffer(s: GameState, idx: number, accept: boolean): string {
  const m = s.mkt!;
  const o = m.offers[idx];
  if (!o) return '';
  m.offers.splice(idx, 1);
  if (!accept) return `Ponudbo podjetja ${o.sponsor} si zavrnil.`;
  m.slots[o.slot] = { sponsor: o.sponsor, monthly: o.monthly, until: s.seasonYear + o.years };
  return `${o.sponsor} je nov sponzor (${SLOTS[o.slot].label}) za ${eur(o.monthly)} na mesec.`;
}

export function buildFacility(s: GameState, k: FacilityKey): { ok: boolean; text: string } {
  const m = s.mkt!;
  const lv = m.facilities[k];
  if (lv >= 3) return { ok: false, text: 'Že na najvišji stopnji.' };
  if (m.builds.some((b) => b.key === k)) return { ok: false, text: 'Gradnja že poteka.' };
  const cost = FACILITIES[k].cost(lv);
  if (s.finance[s.userClubId].balance < cost) return { ok: false, text: `Ni dovolj denarja (potrebno ${eur(cost)}).` };
  if ((s.board ?? 50) < 40 + lv * 8) return { ok: false, text: `Uprava ti za to investicijo ne zaupa dovolj (potrebno ${40 + lv * 8} %).` };
  book(s, s.userClubId, 'investicije', -cost);
  const finish = addDays(s.date, FACILITIES[k].days(lv));
  m.builds.push({ key: k, finish, cost });
  return { ok: true, text: `Gradnja se je začela. Konec del: ${finish}.` };
}

// --- dnevno in mesečno ---
export function marketingDay(s: GameState) {
  const m = s.mkt;
  if (!m) return;
  const rng = rngOf(s, 77);
  const href = '/marketing';
  // kampanje: navijači rastejo, ob koncu novica
  let fd = 0;
  for (const c of m.campaigns) if (c.start <= s.date && c.end >= s.date) fd += CAMPAIGNS[c.key].fansDay * formFactor(s);
  if (fd) s.fans = clamp((s.fans ?? 50) + fd, 0, 100);
  const ended = m.campaigns.filter((c) => c.end < s.date);
  if (ended.length) {
    m.campaigns = m.campaigns.filter((c) => c.end >= s.date);
    for (const c of ended) pushNews(s, 'klub', `Kampanja končana: ${CAMPAIGNS[c.key].label}`, [`Kampanja »${CAMPAIGNS[c.key].label}« se je končala. Navdušenje navijačev je zdaj ${Math.round(s.fans ?? 50)}.`, 'Novo kampanjo lahko začneš v oddelku Marketing.'], { from: 'Marketing', action: { label: 'Marketing', href: `${href}?tab=kampanje` } });
  }
  // gradnje
  for (const b of m.builds.filter((x) => x.finish <= s.date)) {
    m.facilities[b.key] = Math.min(3, m.facilities[b.key] + 1);
    pushNews(s, 'klub', `${FACILITIES[b.key].label}: gradnja končana`, [`${FACILITIES[b.key].label} je zdaj na stopnji ${m.facilities[b.key]}.`], { from: 'Marketing', action: { label: 'Dvorana', href: `${href}?tab=dvorana` } });
  }
  m.builds = m.builds.filter((x) => x.finish > s.date);
  // iskanje sponzorjev -> ponudba
  for (const [k, d] of Object.entries(m.searching) as [SlotKey, string][]) {
    if (d > s.date) continue;
    delete m.searching[k];
    makeOffer(s, k, rng);
  }
  // spontane ponudbe ob ponedeljkih za prosta mesta
  if (new Date(s.date + 'T12:00:00Z').getUTCDay() === 1) {
    const free = (Object.keys(SLOTS) as SlotKey[]).filter((k) => !m.slots[k] && !m.offers.some((o) => o.slot === k) && !m.searching[k]);
    if (free.length && rng.chance(0.12 + (s.fans ?? 50) / 400)) makeOffer(s, rng.pick(free), rng);
  }
  // potekle ponudbe
  m.offers = m.offers.filter((o) => o.expires >= s.date);
  // sezonske karte: prodaja se zaključi 1. septembra
  if (s.date.endsWith('-09-01') && m.seasonYear !== s.seasonYear) {
    m.seasonYear = s.seasonYear;
    m.seasonSold = seasonDemand(s, m.seasonPrice);
    book(s, s.userClubId, 'vstopnice', m.seasonSold * m.seasonPrice);
    pushNews(s, 'klub', `Prodanih ${m.seasonSold} sezonskih kart`, [`Za sezono smo prodali ${m.seasonSold} sezonskih kart po ${eur(m.seasonPrice)}. Na račun je prišlo ${eur(m.seasonSold * m.seasonPrice)}.`, 'Imetniki kart ne plačajo vstopnic na domačih tekmah.'], { from: 'Marketing', action: { label: 'Vstopnice', href: `${href}?tab=vstopnice` } });
  }
  // pogodbe sponzorskih mest potečejo 1. julija
  if (s.date.endsWith('-07-01')) {
    for (const [k, v] of Object.entries(m.slots) as [SlotKey, NonNullable<MarketingState['slots'][SlotKey]>][]) {
      if (v.until > s.seasonYear) continue;
      if (rng.chance(0.35 + (s.fans ?? 50) / 200)) {
        v.until = s.seasonYear + 1;
        v.monthly = Math.max(v.monthly, Math.round(slotValue(s, k) / 10) * 10);
      } else {
        delete m.slots[k];
        pushNews(s, 'klub', `Sponzor ${v.sponsor} ni podaljšal`, [`Pogodba za mesto »${SLOTS[k].label}« je potekla. Poišči novega sponzorja.`], { from: 'Marketing', action: { label: 'Sponzorji', href: `${href}?tab=sponzorji` } });
      }
    }
  }
}

function makeOffer(s: GameState, k: SlotKey, rng: Rng) {
  const m = s.mkt!;
  const sponsor = rng.pick(BRANDS.filter((b) => !Object.values(m.slots).some((x) => x?.sponsor === b)));
  const monthly = Math.round((slotValue(s, k) * (0.8 + rng.next() * 0.35)) / 10) * 10;
  const years = rng.int(1, 2);
  m.offers.push({ slot: k, sponsor, monthly, years, expires: addDays(s.date, 7) });
  pushNews(s, 'klub', `Sponzorska ponudba: ${SLOTS[k].label}`, [
    `Podjetje ${sponsor} želi mesto »${SLOTS[k].label}« za ${eur(monthly)} na mesec (pogodba: ${years === 1 ? 'ena sezona' : 'dve sezoni'}).`,
    `Ocenjena vrednost mesta: ${eur(slotValue(s, k))} na mesec. Ponudba velja 7 dni.`,
  ], { important: true, from: 'Marketing', action: { label: 'Odgovori', href: '/marketing?tab=sponzorji' } });
}

export function merchEstimate(s: GameState) {
  const m = s.mkt!;
  const star = Math.max(0, ...Object.values(s.players).filter((p) => p.clubId === s.userClubId).map((p) => p.ovr));
  let boost = 1 + m.facilities.fanshop * 0.4;
  for (const c of m.campaigns) boost += CAMPAIGNS[c.key].merch;
  const month = Number(s.date.slice(5, 7));
  const season = month >= 9 || month <= 4 ? 1 : 0.4;
  return Math.round((s.fans ?? 50) * 14 * boost * (0.7 + Math.max(0, star - 55) / 40) * season);
}

export function monthlyMarketing(s: GameState) {
  const m = s.mkt;
  if (!m) return;
  const slots = Object.values(m.slots).reduce((a, x) => a + (x?.monthly ?? 0), 0);
  if (slots) book(s, s.userClubId, 'sponzorji', slots);
  if (m.facilities.loze) book(s, s.userClubId, 'loze', m.facilities.loze * 600);
  m.merch = merchEstimate(s);
  book(s, s.userClubId, 'trgovina', m.merch);
  const upkeep = m.facilities.fanshop * 150 + m.facilities.loze * 250 + m.facilities.bife * 100;
  if (upkeep) book(s, s.userClubId, 'infrastruktura', -upkeep);
}

// napoved za domačo tekmo (za zaslon vstopnic)
export function promoPreview(s: GameState, f: Fixture, base: number, price: number, k: PromoKey) {
  const m = s.mkt!;
  const cap = s.clubs.find((c) => c.id === f.home)!.arena.capacity;
  const cur = attendanceBoost(s, f);
  const without = base / Math.max(0.1, cur);
  const p = PROMOS[k];
  const camp = cur - PROMOS[m.promos[f.id] ?? 'none'].att;
  const att = Math.min(cap, Math.round(without * (p.att + camp)));
  const holders = Math.min(att, Math.round(m.seasonSold * 0.85));
  const rev = Math.round((att - holders) * price * p.rev) - p.cost;
  return { att, rev, cap, derby: isDerby(f.home, f.away) };
}
