'use client';
import { useGame, type Lang } from '@/store/game';

// Prevodi vmesnika. Ključ je slovensko besedilo; [hr, sr (latinica), en].
const D: Record<string, [string, string, string]> = {
  // navigacija
  Domov: ['Početna', 'Početna', 'Home'],
  Kader: ['Momčad', 'Tim', 'Squad'],
  Tekma: ['Utakmica', 'Utakmica', 'Match'],
  Liga: ['Liga', 'Liga', 'League'],
  Prestopi: ['Transferi', 'Transferi', 'Transfers'],
  Klub: ['Klub', 'Klub', 'Club'],
  // splošno
  Nadaljuj: ['Nastavi', 'Nastavi', 'Continue'],
  'Najprej sprejmi odločitev': ['Prvo donesi odluku', 'Prvo donesi odluku', 'Make a decision first'],
  Koledar: ['Kalendar', 'Kalendar', 'Calendar'],
  Zapri: ['Zatvori', 'Zatvori', 'Close'],
  OK: ['OK', 'OK', 'OK'],
  Nazaj: ['Natrag', 'Nazad', 'Back'],
  Prekliči: ['Odustani', 'Otkaži', 'Cancel'],
  Vse: ['Sve', 'Sve', 'All'],
  Nastavitve: ['Postavke', 'Podešavanja', 'Settings'],
  Jezik: ['Jezik', 'Jezik', 'Language'],
  // domov
  DANES: ['DANAS', 'DANAS', 'TODAY'],
  'Redni del': ['Regularni dio', 'Regularni deo', 'Regular season'],
  Četrtfinale: ['Četvrtfinale', 'Četvrtfinale', 'Quarter-final'],
  Polfinale: ['Polufinale', 'Polufinale', 'Semi-final'],
  Finale: ['Finale', 'Finale', 'Final'],
  '▶ Igraj v živo': ['▶ Igraj uživo', '▶ Igraj uživo', '▶ Play live'],
  'Hitra simulacija': ['Brza simulacija', 'Brza simulacija', 'Quick sim'],
  Mesto: ['Mjesto', 'Mesto', 'Position'],
  Morala: ['Moral', 'Moral', 'Morale'],
  Račun: ['Račun', 'Račun', 'Balance'],
  Forma: ['Forma', 'Forma', 'Form'],
  'še ni tekem': ['još nema utakmica', 'još nema utakmica', 'no games yet'],
  Svežina: ['Svježina', 'Svežina', 'Fitness'],
  Navijači: ['Navijači', 'Navijači', 'Fans'],
  Uprava: ['Uprava', 'Uprava', 'Board'],
  Pošta: ['Pošta', 'Pošta', 'Inbox'],
  Lestvica: ['Ljestvica', 'Tabela', 'Table'],
  'vsi zdravi': ['svi zdravi', 'svi zdravi', 'all fit'],
  poškodovanih: ['ozlijeđenih', 'povređenih', 'injured'],
  točk: ['bodova', 'bodova', 'points'],
  'Poročilo s tekme →': ['Izvještaj s utakmice →', 'Izveštaj sa utakmice →', 'Match report →'],
  Slačilnica: ['Svlačionica', 'Svlačionica', 'Dressing room'],
  Mediji: ['Mediji', 'Mediji', 'Media'],
  'zahteva odločitev': ['zahtijeva odluku', 'zahteva odluku', 'decision required'],
  'Pošlji pomočnika': ['Pošalji pomoćnika', 'Pošalji pomoćnika', 'Send assistant'],
  // nadaljuj
  'Nadaljujem…': ['Nastavljam…', 'Nastavljam…', 'Continuing…'],
  Ustavljeno: ['Zaustavljeno', 'Zaustavljeno', 'Stopped'],
  Ustavi: ['Zaustavi', 'Zaustavi', 'Stop'],
  Naprej: ['Dalje', 'Dalje', 'Next'],
  'Trening in priprave': ['Trening i pripreme', 'Trening i pripreme', 'Training and preparation'],
  'Danes igra tvoja ekipa.': ['Danas igra tvoja momčad.', 'Danas igra tvoj tim.', 'Your team plays today.'],
  'Prispela je pomembna novica.': ['Stigla je važna vijest.', 'Stigla je važna vest.', 'Important news arrived.'],
  'Čaka te odločitev.': ['Čeka te odluka.', 'Čeka te odluka.', 'A decision awaits.'],
  'Sezona je končana.': ['Sezona je završena.', 'Sezona je završena.', 'The season is over.'],
  pon: ['pon', 'pon', 'Mon'], tor: ['uto', 'uto', 'Tue'], sre: ['sri', 'sre', 'Wed'], čet: ['čet', 'čet', 'Thu'], pet: ['pet', 'pet', 'Fri'], sob: ['sub', 'sub', 'Sat'], ned: ['ned', 'ned', 'Sun'],
  // kader
  Napadalci: ['Napadači', 'Napadači', 'Forwards'],
  Branilci: ['Obrambeni', 'Odbrambeni', 'Defence'],
  Golmani: ['Vratari', 'Golmani', 'Goalies'],
  Postave: ['Postave', 'Postave', 'Lines'],
  Mladinci: ['Juniori', 'Juniori', 'Youth'],
  igralcev: ['igrača', 'igrača', 'players'],
  'povp. ocena': ['prosj. ocjena', 'prosečna ocena', 'avg rating'],
  plače: ['plaće', 'plate', 'wages'],
  let: ['god.', 'god.', 'yrs'],
  tč: ['bod.', 'bod.', 'pts'],
  'dobra forma': ['dobra forma', 'dobra forma', 'good form'],
  povprečna: ['prosječna', 'prosečna', 'average'],
  slaba: ['loša', 'loša', 'poor'],
  'velik potencial': ['veliki potencijal', 'veliki potencijal', 'high potential'],
  'T = točke': ['B = bodovi', 'B = bodovi', 'P = points'],
  // tekma
  'V ŽIVO': ['UŽIVO', 'UŽIVO', 'LIVE'],
  KONEC: ['KRAJ', 'KRAJ', 'FINAL'],
  'Streli na gol': ['Udarci u okvir', 'Šutevi u okvir', 'Shots on goal'],
  Posest: ['Posjed', 'Posed', 'Possession'],
  'Igralec več': ['Igrač više', 'Igrač više', 'Power play'],
  'Kazenske min': ['Kaznene min', 'Kaznene min', 'Penalty min'],
  'Na ledu': ['Na ledu', 'Na ledu', 'On ice'],
  'Napad:': ['Napad:', 'Napad:', 'Forwards:'],
  'Obramba:': ['Obrana:', 'Odbrana:', 'Defence:'],
  Prenos: ['Prijenos', 'Prenos', 'Play-by-play'],
  Forček: ['Forček', 'Forček', 'Forecheck'],
  Agresiven: ['Agresivan', 'Agresivan', 'Aggressive'],
  Uravnotežen: ['Uravnotežen', 'Uravnotežen', 'Balanced'],
  Pasiven: ['Pasivan', 'Pasivan', 'Passive'],
  'Time-out': ['Time-out', 'Tajm-aut', 'Time-out'],
  Pavza: ['Pauza', 'Pauza', 'Pause'],
  Hitrost: ['Brzina', 'Brzina', 'Speed'],
  'Simuliraj do konca': ['Simuliraj do kraja', 'Simuliraj do kraja', 'Sim to end'],
  'Zaključi tekmo': ['Završi utakmicu', 'Završi utakmicu', 'Finish match'],
  '▶ Začni tekmo': ['▶ Započni utakmicu', '▶ Započni utakmicu', '▶ Start match'],
  'Uredi postave pred tekmo': ['Uredi postave prije utakmice', 'Uredi postave pre utakmice', 'Edit lines before match'],
  'Naslednja tekma': ['Sljedeća utakmica', 'Sledeća utakmica', 'Next match'],
  'Celotno poročilo s tekme': ['Cijeli izvještaj s utakmice', 'Ceo izveštaj sa utakmice', 'Full match report'],
  // liga
  Razpored: ['Raspored', 'Raspored', 'Fixtures'],
  Statistika: ['Statistika', 'Statistika', 'Stats'],
  Končnica: ['Doigravanje', 'Plej-of', 'Playoffs'],
  'Moje tekme': ['Moje utakmice', 'Moje utakmice', 'My games'],
  'Vse tekme': ['Sve utakmice', 'Sve utakmice', 'All games'],
  Strelci: ['Strijelci', 'Strelci', 'Scorers'],
  Klub_: ['Klub', 'Klub', 'Club'],
  // prestopi
  'Prosti igralci': ['Slobodni igrači', 'Slobodni igrači', 'Free agents'],
  'Prostor za plače': ['Prostor za plaće', 'Prostor za plate', 'Wage room'],
  'Razvrsti:': ['Sortiraj:', 'Sortiraj:', 'Sort:'],
  Vsi: ['Svi', 'Svi', 'All'],
  Ocena: ['Ocjena', 'Ocena', 'Rating'],
  Plača: ['Plaća', 'Plata', 'Wage'],
  Mlajši: ['Mlađi', 'Mlađi', 'Younger'],
  'Začni novo igro': ['Započni novu igru', 'Započni novu igru', 'Start new game'],
  'Izbriši in začni znova': ['Izbriši i počni ispočetka', 'Izbriši i počni ispočetka', 'Delete and start over'],
  'Igralci brez kluba, ki jih lahko podpišeš takoj, brez odškodnine.': ['Igrači bez kluba koje možeš potpisati odmah, bez odštete.', 'Igrači bez kluba koje možeš potpisati odmah, bez obeštećenja.', 'Players without a club you can sign right away, no fee.'],
  'Trenutna kariera bo izbrisana. Res želiš začeti znova?': ['Trenutna karijera bit će izbrisana. Želiš li stvarno početi ispočetka?', 'Trenutna karijera će biti obrisana. Da li stvarno želiš da počneš ispočetka?', 'Your current career will be deleted. Start over?'],
  // klub
  'Uprava in navijači': ['Uprava i navijači', 'Uprava i navijači', 'Board and fans'],
  'Zaupanje uprave': ['Povjerenje uprave', 'Poverenje uprave', 'Board confidence'],
  'Podpora navijačev': ['Podrška navijača', 'Podrška navijača', 'Fan support'],
  'Cilj sezone': ['Cilj sezone', 'Cilj sezone', 'Season goal'],
  'Trenutno mesto': ['Trenutno mjesto', 'Trenutno mesto', 'Current position'],
  Infrastruktura: ['Infrastruktura', 'Infrastruktura', 'Facilities'],
  Dvorana: ['Dvorana', 'Hala', 'Arena'],
  Manager: ['Menadžer', 'Menadžer', 'Manager'],
  Finance: ['Financije', 'Finansije', 'Finances'],
  Zgodovina: ['Povijest', 'Istorija', 'History'],
  'Najvišja stopnja': ['Najviša razina', 'Najviši nivo', 'Max level'],
  // finance
  'Stanje na računu': ['Stanje računa', 'Stanje računa', 'Bank balance'],
  'Plače / proračun': ['Plaće / proračun', 'Plate / budžet', 'Wages / budget'],
  Pregled: ['Pregled', 'Pregled', 'Overview'],
  Vstopnice: ['Ulaznice', 'Ulaznice', 'Tickets'],
  'Sezona skupaj': ['Ukupno sezona', 'Ukupno sezona', 'Season total'],
  PRIHODKI: ['PRIHODI', 'PRIHODI', 'INCOME'],
  ODHODKI: ['RASHODI', 'RASHODI', 'EXPENSES'],
  'Glavni sponzor': ['Glavni sponzor', 'Glavni sponzor', 'Main sponsor'],
  'Po mesecih': ['Po mjesecima', 'Po mesecima', 'By month'],
  'Redna tekma': ['Redovna utakmica', 'Redovna utakmica', 'Regular game'],
  Derbi: ['Derbi', 'Derbi', 'Derby'],
  // mladinci
  'Mladinska šola': ['Omladinska škola', 'Omladinska škola', 'Youth academy'],
  'Pokliči v člansko ekipo': ['Pozovi u seniore', 'Pozovi u seniore', 'Promote to first team'],
  Potencial: ['Potencijal', 'Potencijal', 'Potential'],
  Točke: ['Bodovi', 'Bodovi', 'Points'],
  Lige: ['Lige', 'Lige', 'Leagues'],
  // igralec
  'Ponudi pogodbo': ['Ponudi ugovor', 'Ponudi ugovor', 'Offer contract'],
  'Pošlji ponudbo': ['Pošalji ponudu', 'Pošalji ponudu', 'Send offer'],
  'Pošlji ponudbo klubu': ['Pošalji ponudu klubu', 'Pošalji ponudu klubu', 'Send offer to club'],
  'Pogodba z igralcem': ['Ugovor s igračem', 'Ugovor sa igračem', 'Player contract'],
  'Ponudi pogodbo igralcu': ['Ponudi ugovor igraču', 'Ponudi ugovor igraču', 'Offer contract to player'],
  'Prekliči prestop': ['Otkaži transfer', 'Otkaži transfer', 'Cancel transfer'],
  'Odpusti igralca': ['Otpusti igrača', 'Otpusti igrača', 'Release player'],
  Odpusti: ['Otpusti', 'Otpusti', 'Release'],
  'Pošlji v mladinsko ekipo': ['Pošalji u juniore', 'Pošalji u juniore', 'Send to youth team'],
  Tehnični: ['Tehnički', 'Tehnički', 'Technical'],
  Mentalni: ['Mentalni', 'Mentalni', 'Mental'],
  Fizični: ['Fizički', 'Fizički', 'Physical'],
  Golman: ['Vratar', 'Golman', 'Goalie'],
  Stanje: ['Stanje', 'Stanje', 'Status'],
  Osebnost: ['Osobnost', 'Ličnost', 'Personality'],
  Kariera: ['Karijera', 'Karijera', 'Career'],
  Tekme: ['Utakmice', 'Utakmice', 'Games'],
  Goli: ['Golovi', 'Golovi', 'Goals'],
  Podaje: ['Asistencije', 'Asistencije', 'Assists'],
  // nova igra
  'Ustvari managerja': ['Kreiraj menadžera', 'Kreiraj menadžera', 'Create manager'],
  'Izberi ekipo': ['Odaberi momčad', 'Izaberi tim', 'Choose team'],
  Ime: ['Ime', 'Ime', 'First name'],
  Priimek: ['Prezime', 'Prezime', 'Last name'],
  Državljanstvo: ['Državljanstvo', 'Državljanstvo', 'Nationality'],
  Starost: ['Dob', 'Starost', 'Age'],
  'Hokejska preteklost': ['Hokejaška prošlost', 'Hokejaška prošlost', 'Hockey background'],
  'Tvoj stil igre': ['Tvoj stil igre', 'Tvoj stil igre', 'Your playing style'],
  'Naprej: izberi ekipo': ['Dalje: odaberi momčad', 'Dalje: izaberi tim', 'Next: choose team'],
  'Začni kariero': ['Započni karijeru', 'Započni karijeru', 'Start career'],
  Proračun: ['Proračun', 'Budžet', 'Budget'],
  'Cilj uprave': ['Cilj uprave', 'Cilj uprave', 'Board goal'],
};

const IDX: Record<Lang, number> = { sl: -1, hr: 0, sr: 1, en: 2 };

// Dodatni slovarji (generirani iz source.json): ključ = slovensko besedilo
import HR from './hr.json';
import SR from './sr.json';
import EN from './en.json';
const EXT: Record<Exclude<Lang, 'sl'>, Record<string, string>> = { hr: HR as Record<string, string>, sr: SR as Record<string, string>, en: EN as Record<string, string> };

function lookup(lang: Exclude<Lang, 'sl'>, s: string): string | undefined {
  const d = D[s];
  if (d) return d[IDX[lang]];
  return EXT[lang][s];
}

// ---------- srbska cirilica ----------
const LAT2CYR: Record<string, string> = {
  a: 'а', b: 'б', c: 'ц', č: 'ч', ć: 'ћ', d: 'д', đ: 'ђ', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и', j: 'ј', k: 'к', l: 'л',
  m: 'м', n: 'н', o: 'о', p: 'п', r: 'р', s: 'с', š: 'ш', t: 'т', u: 'у', v: 'в', z: 'з', ž: 'ж',
};
const DIGRAPH: Record<string, string> = { lj: 'љ', nj: 'њ', dž: 'џ' };
const KEEP_LATIN = new Set(['IHL', 'OVR', 'PP', 'SH', 'EN', 'GAA', 'POT', 'OK', 'MVP', 'SV', 'HK', 'KHL', 'IH', 'HDD', 'PRO', 'KS', 'PR', 'PEN', 'TV', 'PWA', 'EUR']);
function cyrWord(w: string): string {
  // kratice (OVR, PP, IHL), besede s q/w/x/y ostanejo v latinici
  if (w.length > 1 && w === w.toUpperCase() && KEEP_LATIN.has(w)) return w;
  if (/[qwxy]/i.test(w)) return w;
  let out = '';
  for (let i = 0; i < w.length; i++) {
    const two = w.slice(i, i + 2);
    const low2 = two.toLowerCase();
    if (DIGRAPH[low2]) {
      const c = DIGRAPH[low2];
      out += two[0] === two[0].toUpperCase() ? c.toUpperCase() : c;
      i++;
      continue;
    }
    const ch = w[i];
    const low = ch.toLowerCase();
    const c = LAT2CYR[low];
    out += c ? (ch !== low ? c.toUpperCase() : c) : ch;
  }
  return out;
}
export function toCyrillic(s: string): string {
  // ne spreminjaj {placeholderjev}
  return s.replace(/\{[^}]*\}|[A-Za-zČčŠšŽžĆćĐđ]+/g, (m) => (m[0] === '{' ? m : cyrWord(m)));
}

// ---------- predloge (besedila motorja z {0}, {1} ...) ----------
type Tpl = { key: string; re: RegExp; n: number; lit: number; order: string[] };
let TPL: Tpl[] | null = null;
function esc(x: string) { return x.replace(/[.*+?^$()|[\]\\]/g, '\\$&'); }
function templates(): Tpl[] {
  if (TPL) return TPL;
  const keys = new Set<string>([...Object.keys(D), ...Object.keys(EN as Record<string, string>)]);
  TPL = [];
  for (const k of keys) {
    if (!/\{\w+\}/.test(k)) continue;
    const parts = k.split(/\{(\w+)\}/);
    let src = '^';
    const order: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) src += esc(parts[i]);
      else {
        // sosednje predloge brez ločila: prva = številka ali ime (do vejice/oklepaja), srednje do oklepaja
        const nextAdj = i + 2 < parts.length && parts[i + 1] === '';
        const prevAdj = i >= 2 && parts[i - 1] === '';
        src += nextAdj ? (prevAdj ? '([^(]*)' : '(\\d+|[^,(]*)') : '([\\s\\S]*?)';
        order.push(parts[i]);
      }
    }
    src += '$';
    const lit = parts.filter((_, i) => i % 2 === 0).join('').length;
    if (lit < 2) continue;
    TPL.push({ key: k, re: new RegExp(src), n: order.length, lit, order });
  }
  TPL.sort((a, b) => b.lit - a.lit);
  return TPL;
}

const CACHE: Record<string, Map<string, string>> = { hr: new Map(), sr: new Map(), en: new Map() };

// Prevede v ciljni jezik; za sr vrne latinico (cirilica se doda na koncu)
let HIT = false;
function tr(lang: Exclude<Lang, 'sl'>, s: string, depth = 0): string {
  if (!s) return s;
  const hit = lookup(lang, s);
  if (hit !== undefined) { HIT = true; return hit; }
  // obdrži presledke/ločila na robovih
  const m0 = /^(\s*)([\s\S]*?)([\s.:!?,]*)$/.exec(s);
  if (m0 && (m0[1] || m0[3]) && m0[2]) {
    const inner = lookup(lang, m0[2]);
    if (inner !== undefined) { HIT = true; return m0[1] + inner + m0[3]; }
  }
  if (depth > 3 || s.length > 600) return s;
  for (const t of templates()) {
    const m = t.re.exec(s);
    if (!m) continue;
    const target = lookup(lang, t.key);
    if (target === undefined) continue;
    HIT = true;
    const vals: Record<string, string> = {};
    t.order.forEach((name, i) => { vals[name] = m[i + 1]; });
    return target.replace(/\{(\w+)\}/g, (_, d) => {
      const v = vals[d] ?? '';
      // ujete dele prevedi rekurzivno (npr. ' po podaljšku'), imena ostanejo
      const saved = HIT;
      HIT = false;
      const inner = tr(lang, v, depth + 1);
      const ok = HIT;
      HIT = saved;
      return ok ? inner : MARK + v + MARK;
    });
  }
  return s;
}
// oznaka za dele, ki se ne transliterirajo (imena, številke)
const MARK = '\u0001';

function finalize(lang: Lang, out: string): string {
  if (lang !== 'sr') return out.split(MARK).join('');
  // izven oznak -> cirilica; neprevedeni ujeti deli (imena) ostanejo v latinici
  return out.split(MARK).map((p, i) => (i % 2 === 0 ? toCyrillic(p) : p)).join('');
}

export function translate(lang: Lang, s: string, vars?: Record<string, string | number>) {
  if (s == null) return s;
  let out = s;
  if (lang !== 'sl') {
    const c = CACHE[lang];
    const cached = c.get(s);
    if (cached !== undefined) out = cached;
    else {
      HIT = false;
      const r = tr(lang, s);
      out = HIT ? finalize(lang, r) : s;
      if (c.size > 5000) c.clear();
      c.set(s, out);
    }
  }
  if (vars) out = out.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
  return out;
}

export function useT() {
  const lang = useGame((s) => s.lang ?? 'sl');
  return (s: string | number | null | undefined, vars?: Record<string, string | number>): string =>
    s == null ? '' : typeof s === 'number' ? String(s) : translate(lang, s, vars);
}

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'sl', label: 'Slovenščina' },
  { id: 'hr', label: 'Hrvatski' },
  { id: 'sr', label: 'Српски' },
  { id: 'en', label: 'English' },
];
