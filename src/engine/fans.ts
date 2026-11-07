// Odzivi navijačev: kratki komentarji po tekmah in prestopih.
import { Rng } from './rng';
import type { GameState } from './types';

export type FanEvent =
  | 'zmaga' | 'visoka_zmaga' | 'derbi_zmaga' | 'poraz' | 'visok_poraz' | 'derbi_poraz' | 'podaljsek_zmaga'
  | 'niz_zmag' | 'niz_porazov' | 'podpis' | 'prodaja_domaci' | 'prodaja' | 'debi' | 'nov_trener' | 'nicla';

const T: Record<FanEvent, string[]> = {
  zmaga: ['Lepa zmaga, tako naprej! 💪', 'Pomembne tri točke. Gremo!', 'Danes se je videlo, da ekipa diha skupaj.', '{0}:{1}! Dobra predstava fantov.'],
  visoka_zmaga: ['{0}:{1}! To je bil hokej! 🔥', 'Pometli smo jih z ledu. Sanjska tekma!', 'Takšno igro hočemo videti vsak teden!'],
  derbi_zmaga: ['DERBI JE NAŠ! 🔥🔥', 'Mesto je naše! Hvala, fantje!', 'Zmaga v derbiju je več kot tri točke. Ponosni smo!'],
  poraz: ['Škoda, danes ni šlo.', 'Glave gor, naslednja tekma bo boljša.', 'Preveč napak v obrambi. Treba bo popraviti.', 'Brez energije danes. Kaj se dogaja?'],
  visok_poraz: ['{0}:{1}?! Sramota. 😡', 'To ni bil hokej. Trener, kaj je to bilo?', 'Nekaj se mora spremeniti, takoj.'],
  derbi_poraz: ['Izgubiti derbi boli. Zelo.', 'Kako lahko tako izgubimo derbi?! 😤', 'Teden bo dolg. Derbi gre na tisto stran.'],
  podaljsek_zmaga: ['Srce v grlu, a zmaga je naša! 😅', 'Takšne tekme se zmagujejo s karakterjem.'],
  niz_zmag: ['{0} zmag zapored! Ta ekipa je v ognju! 🔥', 'Kdo nas bo letos ustavil?', 'Najboljša forma, odkar spremljam klub.'],
  niz_porazov: ['{0} porazov zapored. Kriza je tu.', 'Uprava, kdaj bo kaj ukrepala?', 'Podpiramo vas, a tako ne gre več.'],
  podpis: ['Dobrodošel, {0}! 👋', 'Končno okrepitev! {0} bo pomagal.', '{0}? Upam, da bo upravičil zaupanje.', 'Dober podpis. {0} pozna ligo.'],
  prodaja_domaci: ['Prodati našega fanta {0}? Ne razumem uprave. 💔', 'Hvala za vse, {0}. Vedno boš naš.', 'Spet odhaja eden naših. Žalostno.'],
  prodaja: ['Srečno, {0}. Pravi poslovni potez.', '{0} odhaja. Upam, da je denar vreden.'],
  debi: ['Debi domačega fanta {0}! Ponosni smo! 🎓', 'Prihodnost kluba je na ledu. Bravo, {0}!'],
  nov_trener: ['Novi trener, nov začetek. Dobrodošel!', 'Upajmo, da prinese več zmag.'],
  nicla: ['Ničla! Naš golman je zid. 🧱', 'Nihče ne zabije našemu golmanu!'],
};

const SUFFIX = ['_ultra', '_navijac', '_forever', '1987', '_na_ledu', '_fan', '_tribuna', '_hokej'];

function handle(clubShort: string, rng: Rng) {
  const base = clubShort.toLowerCase().replace(/[^a-zčšžćđ]+/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  return `@${base}${rng.pick(SUFFIX)}`;
}

export function fanPosts(s: GameState, ev: FanEvent, args: (string | number)[] = [], n = 1) {
  const club = s.clubs.find((c) => c.id === s.userClubId)!;
  const rng = new Rng(s.seed + Number(s.date.replace(/-/g, '')) + ev.length * 31 + (s.fanFeed?.length ?? 0));
  const pool = [...T[ev]];
  s.fanFeed = s.fanFeed ?? [];
  const mood = ['poraz', 'visok_poraz', 'derbi_poraz', 'niz_porazov', 'prodaja_domaci'].includes(ev) ? -1 : ['prodaja', 'nov_trener'].includes(ev) ? 0 : 1;
  for (let i = 0; i < n && pool.length; i++) {
    const tpl = pool.splice(rng.int(0, pool.length - 1), 1)[0];
    const text = tpl.replace(/\{(\d)\}/g, (_, d) => String(args[Number(d)] ?? ''));
    s.fanFeed.unshift({ date: s.date, handle: handle(club.short, rng), tpl, args: args.map(String), text, mood });
  }
  if (s.fanFeed.length > 40) s.fanFeed.length = 40;
}

// po tekmi uporabnika
export function fansAfterMatch(s: GameState, ctx: { won: boolean; my: number; op: number; derby: boolean; ot: boolean }) {
  const { won, my, op, derby, ot } = ctx;
  const st = s.streak ?? 0;
  if (derby) fanPosts(s, won ? 'derbi_zmaga' : 'derbi_poraz', [my, op], 2);
  else if (won && my - op >= 4) fanPosts(s, 'visoka_zmaga', [my, op], 2);
  else if (!won && op - my >= 4) fanPosts(s, 'visok_poraz', [my, op], 2);
  else if (won && ot) fanPosts(s, 'podaljsek_zmaga', [my, op], 1);
  else fanPosts(s, won ? 'zmaga' : 'poraz', [my, op], 1);
  if (won && op === 0) fanPosts(s, 'nicla', [], 1);
  if (st === 4 || st === 7 || st === 10) fanPosts(s, 'niz_zmag', [st], 1);
  if (st === -3 || st === -5) fanPosts(s, 'niz_porazov', [-st], 1);
}
