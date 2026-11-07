import { Rng } from './rng';
import type { DecisionOption, Fixture, GameState } from './types';

// Novinarske konference: vsako vprašanje ima več različic, odgovori pa več ubeseditev.
// Igra izbere vprašanje glede na okoliščine in se izogne nedavno uporabljenim.

type Ctx = Record<string, string | number>;
interface QDef {
  id: string;
  when: (c: PressCtx) => boolean;
  weight?: number;
  texts: string[];
  answers: string[]; // ključi učinkov
}

export interface PressCtx {
  opp: string;
  derby: boolean;
  playoff: boolean;
  streak: number;
  myPos: number;
  oppPos: number;
  injuredStar?: string;
  oppStar?: string;
  youngStar?: string;
  fans: number;
  board: number;
  round: number;
  home: boolean;
  arena: string;
  // po tekmi
  won?: boolean;
  my?: number;
  op?: number;
  ot?: boolean;
  so?: boolean;
  comeback?: boolean;
  star?: string;
  starGoals?: number;
  shutout?: boolean;
  pim?: number;
  shotsFor?: number;
  shotsAgainst?: number;
}

const ANSWERS: Record<string, string[]> = {
  pre_confident: ['Zmagali bomo, o tem ni dvoma.', 'Pripravljeni smo in gremo po tri točke.', 'Fantje so lačni zmage, to se bo videlo.', 'Če igramo svojo igro, nas nihče ne ustavi.'],
  pre_respect: ['Spoštujemo nasprotnika, a smo pripravljeni.', 'Čaka nas težka tekma, vemo, kaj moramo narediti.', 'Analizirali smo jih, imajo kakovost, a tudi slabosti.', 'Nihče v tej ligi ni lahek nasprotnik.'],
  pre_neutral: ['Za nas je to tekma kot vsaka druga.', 'Gledamo samo nase, ne na nasprotnika.', 'Vsaka tekma je nova priložnost, nič več.', 'Ne bi želel delati napovedi.'],
  pre_demand: ['Igralci morajo prevzeti odgovornost.', 'Pričakujem več truda od vseh, tudi od sebe.', 'Dovolj je izgovorov, zahtevam reakcijo.'],
  pre_pressure: ['Pritisk je na njih, ne na nas.', 'Oni so favoriti, mi nimamo kaj izgubiti.', 'Vsi pričakujejo njihovo zmago, to nam ustreza.'],
  post_win_team: ['Pohvala celotni ekipi.', 'To je zmaga vseh, od golmana do četrtega napada.', 'Ekipa je igrala kot celota, ponosen sem.', 'Vsi so odigrali svojo vlogo.'],
  post_win_star: ['Izpostavil bi {star}.', '{star} je bil danes odločilen.', 'Posebna pohvala za {star}.'],
  post_win_humble: ['Še vedno imamo veliko dela.', 'Zmaga je lepa, a nismo bili popolni.', 'Pozabimo to tekmo in se pripravimo na naslednjo.', 'Lepo, ampak to je šele ena tekma.'],
  post_loss_me: ['Prevzemam odgovornost.', 'Za poraz sem kriv jaz, ne igralci.', 'Nisem dobro pripravil ekipe.'],
  post_loss_players: ['Igralci niso dali vsega od sebe.', 'Nekateri so danes igrali pod svojo ravnjo.', 'Takšne predstave ne bom več toleriral.'],
  post_loss_refs: ['Sodniki so odločili tekmo.', 'Nekaj sodniških odločitev je bilo zelo vprašljivih.', 'O sojenju raje ne bi govoril, vsi so videli.'],
  post_loss_positive: ['Igrali smo dobro, rezultat ni odraz igre.', 'Imeli smo priložnosti, plošček ni hotel v gol.', 'Na tej predstavi lahko gradimo.'],
};

const PRE: QDef[] = [
  { id: 'po-serija', when: (c) => c.playoff, weight: 5, texts: ['Končnica proti {opp}. Ste pripravljeni na serijo?', 'V končnici je vse drugače. Kaj bo odločilo serijo z {opp}?', 'Kako se pripravljate na serijo z {opp}?', 'Je vaša ekipa dovolj izkušena za končnico?'], answers: ['pre_confident', 'pre_respect', 'pre_neutral'] },
  { id: 'derbi', when: (c) => c.derby && !c.playoff, weight: 4, texts: ['Danes je derbi proti {opp}. Kakšna so pričakovanja?', 'Derbi z {opp} je za navijače najpomembnejša tekma sezone. Čutite pritisk?', 'Kaj pomeni zmaga na derbiju proti {opp}?', 'Pred derbijem je mesto razdeljeno. Imate sporočilo za navijače?'], answers: ['pre_confident', 'pre_respect', 'pre_neutral'] },
  { id: 'porazi', when: (c) => c.streak <= -3, weight: 5, texts: ['Izgubili ste {lstreak} tekme zapored. Je vaš položaj ogrožen?', 'Kaj se dogaja z ekipo po {lstreak} zaporednih porazih?', 'Navijači so nervozni. Kako boste prekinili negativni niz?', 'Ali razmišljate o spremembah v postavi po zadnjih porazih?'], answers: ['pre_confident', 'pre_demand', 'pre_neutral'] },
  { id: 'zmage', when: (c) => c.streak >= 3, weight: 4, texts: ['Niz {streak} zmag. Ste zdaj favoriti za naslov?', 'Ekipa je v odlični formi. Kaj je skrivnost?', 'Po {streak} zmagah zapored vas vsi gledajo. Vas je strah, da se niz konča?', 'Kako ohraniti fokus po takšnem nizu zmag?'], answers: ['pre_confident', 'pre_respect', 'pre_neutral'] },
  { id: 'visje', when: (c) => c.oppPos < c.myPos && !c.playoff, weight: 2, texts: ['{opp} je na lestvici višje. Kako se boste postavili nasproti njim?', 'Proti {opp} niste favoriti. Kaj je vaš načrt?', '{opp} je {opppos}. na lestvici. Ste lahko presenečenje večera?'], answers: ['pre_confident', 'pre_pressure', 'pre_neutral'] },
  { id: 'nizje', when: (c) => c.oppPos > c.myPos + 2 && !c.playoff, weight: 2, texts: ['Proti {opp} ste veliki favoriti. Je to nevarno?', 'Vsi pričakujejo lahko zmago proti {opp}. Se strinjate?', 'Ali boste proti {opp} dali priložnost mlajšim igralcem?'], answers: ['pre_confident', 'pre_respect', 'pre_neutral'] },
  { id: 'poskodba', when: (c) => !!c.injuredStar, weight: 2, texts: ['Kako boste nadomestili poškodovanega {injured}?', 'Brez {injured} boste težko. Kdo bo prevzel njegovo vlogo?'], answers: ['pre_confident', 'pre_respect', 'pre_neutral'] },
  { id: 'zvezda-nasp', when: (c) => !!c.oppStar, weight: 2, texts: ['{oppstar} je eden najboljših strelcev lige. Imate načrt zanj?', 'Kako boste ustavili {oppstar}?'], answers: ['pre_confident', 'pre_respect', 'pre_neutral'] },
  { id: 'mladi', when: (c) => !!c.youngStar, weight: 2, texts: ['{young} je razkritje sezone. Ga bodo kmalu odpeljali v tujino?', 'Koliko prostora boste dali mlademu {young}?'], answers: ['pre_confident', 'pre_respect', 'pre_neutral'] },
  { id: 'navijaci-slabo', when: (c) => c.fans < 40, weight: 2, texts: ['Obisk pada, navijači so razočarani. Kaj jim sporočate?', 'Navijači žvižgajo. Razumete njihovo nezadovoljstvo?'], answers: ['pre_confident', 'pre_demand', 'pre_neutral'] },
  { id: 'navijaci-dobro', when: (c) => c.fans > 80 && c.home, weight: 1, texts: ['{arena} bo danes spet polna. Koliko vam pomenijo navijači?', 'Doma ste zelo močni. Je vzdušje vaša prednost?'], answers: ['pre_confident', 'pre_respect', 'pre_neutral'] },
  { id: 'uprava', when: (c) => c.board < 35, weight: 3, texts: ['Govori se, da uprava izgublja potrpljenje. Vas skrbi?', 'Je to tekma, ki odloča o vaši prihodnosti?'], answers: ['pre_confident', 'pre_demand', 'pre_neutral'] },
  { id: 'zacetek', when: (c) => c.round <= 3 && !c.playoff, weight: 2, texts: ['Sezona se šele začenja. Kakšni so cilji?', 'Ste zadovoljni s pripravami na sezono?'], answers: ['pre_confident', 'pre_respect', 'pre_neutral'] },
  { id: 'gost', when: (c) => !c.home && !c.playoff, weight: 1, texts: ['Gostovanje pri {opp} ni nikoli lahko. Kaj pričakujete?', 'Kako je ekipa prenesla pot na tekmo z {opp}?'], answers: ['pre_confident', 'pre_respect', 'pre_neutral'] },
  { id: 'splosno', when: () => true, weight: 1, texts: ['Kako ocenjujete današnjega nasprotnika {opp}?', 'V kakšni formi je ekipa pred tekmo z {opp}?', 'Bo prišlo do sprememb v postavi?', 'Kje vidite največjo prednost proti {opp}?', 'Kaj ste na treningih ta teden najbolj poudarjali?', 'Je kdo od igralcev pod vprašajem za današnjo tekmo?'], answers: ['pre_confident', 'pre_respect', 'pre_neutral'] },
];

const POST: QDef[] = [
  { id: 'zm-visoka', when: (c) => !!c.won && (c.my ?? 0) - (c.op ?? 0) >= 4, weight: 4, texts: ['Visoka zmaga {score} proti {opp}. Ste presenečeni nad razliko?', 'Prepričljivo, {score}. Je to vaša najboljša predstava sezone?', 'Proti {opp} je vse steklo. Kaj je delovalo?'], answers: ['post_win_team', 'post_win_star', 'post_win_humble'] },
  { id: 'zm-podaljsek', when: (c) => !!c.won && (!!c.ot || !!c.so), weight: 4, texts: ['Zmaga po {otword}. Kako ste preživeli napete trenutke?', 'Dve točki po {otword}. Ste zadovoljni ali razočarani, da ni bilo tri?'], answers: ['post_win_team', 'post_win_star', 'post_win_humble'] },
  { id: 'zm-preobrat', when: (c) => !!c.won && !!c.comeback, weight: 5, texts: ['Zaostajali ste, pa ste tekmo obrnili. Kaj ste rekli ekipi?', 'Velik preobrat proti {opp}. Je to dokaz karakterja?'], answers: ['post_win_team', 'post_win_star', 'post_win_humble'] },
  { id: 'zm-hattrick', when: (c) => !!c.won && (c.starGoals ?? 0) >= 3, weight: 5, texts: ['{star} je dosegel hat-trick. Koliko vam pomeni?', 'Večer {star}: {stargoals} goli. Kako ga ocenjujete?'], answers: ['post_win_team', 'post_win_star', 'post_win_humble'] },
  { id: 'zm-nicla', when: (c) => !!c.won && !!c.shutout, weight: 3, texts: ['Brez prejetega gola. Je to zasluga golmana ali obrambe?', 'Ničla proti {opp}. Je obramba vaša največja moč?'], answers: ['post_win_team', 'post_win_star', 'post_win_humble'] },
  { id: 'zm-derbi', when: (c) => !!c.won && c.derby, weight: 4, texts: ['Derbi je vaš! Kaj sporočate navijačem?', 'Zmaga na derbiju proti {opp}. Je to najlepša zmaga sezone?'], answers: ['post_win_team', 'post_win_star', 'post_win_humble'] },
  { id: 'zm-tesna', when: (c) => !!c.won, weight: 1, texts: ['Zmaga {score} proti {opp}. Kaj je bilo odločilno?', 'Pomembne tri točke. Ste zadovoljni z igro?', 'Kako ocenjujete predstavo ekipe proti {opp}?', 'Kaj vam je bilo danes najbolj všeč?'], answers: ['post_win_team', 'post_win_star', 'post_win_humble'] },
  { id: 'po-visok', when: (c) => !c.won && (c.op ?? 0) - (c.my ?? 0) >= 4, weight: 4, texts: ['Boleč poraz {score}. Kaj se je zgodilo?', 'To je bil hladen tuš. Je ekipa sploh prišla na led?', 'Po porazu {score} se navijači sprašujejo o vaši taktiki. Odgovor?'], answers: ['post_loss_me', 'post_loss_players', 'post_loss_refs'] },
  { id: 'po-podaljsek', when: (c) => !c.won && (!!c.ot || !!c.so), weight: 3, texts: ['Poraz po {otword}, a vsaj točka. Kako gledate na to?', 'Tako blizu, pa vendar poraz po {otword}. Je razočaranje veliko?'], answers: ['post_loss_positive', 'post_loss_players', 'post_loss_refs'] },
  { id: 'po-streli', when: (c) => !c.won && (c.shotsFor ?? 0) > (c.shotsAgainst ?? 0) + 8, weight: 4, texts: ['Imeli ste {shots} strelov, pa ste izgubili. Je bil golman nasprotnika nepremagljiv?', 'Prevladovali ste, a rezultat je proti vam. Kaj manjka?'], answers: ['post_loss_positive', 'post_loss_players', 'post_loss_refs'] },
  { id: 'po-kazni', when: (c) => !c.won && (c.pim ?? 0) >= 12, weight: 4, texts: ['Kar {pim} kazenskih minut. Je disciplina problem?', 'Preveč izključitev vas je stalo tekme. Se strinjate?'], answers: ['post_loss_me', 'post_loss_players', 'post_loss_refs'] },
  { id: 'po-derbi', when: (c) => !c.won && c.derby, weight: 4, texts: ['Poraz na derbiju boli. Kaj sporočate navijačem?', '{opp} je dobil derbi. Kaj je šlo narobe?'], answers: ['post_loss_me', 'post_loss_players', 'post_loss_refs'] },
  { id: 'po-splosno', when: (c) => !c.won, weight: 1, texts: ['Poraz {score} proti {opp}. Kaj je šlo narobe?', 'Kje ste danes izgubili tekmo?', 'Kakšen je vaš komentar po porazu?', 'Je bil to slab dan ali opozorilo?'], answers: ['post_loss_me', 'post_loss_players', 'post_loss_positive'] },
];

function fill(t: string, c: PressCtx): string {
  const map: Ctx = {
    opp: c.opp,
    streak: c.streak,
    lstreak: -c.streak,
    opppos: c.oppPos,
    injured: c.injuredStar ?? '',
    oppstar: c.oppStar ?? '',
    young: c.youngStar ?? '',
    arena: c.arena,
    score: `${c.my ?? 0}:${c.op ?? 0}`,
    otword: c.so ? 'kazenskih strelih' : 'podaljšku',
    star: c.star ?? '',
    stargoals: c.starGoals ?? 0,
    pim: c.pim ?? 0,
    shots: c.shotsFor ?? 0,
  };
  return t.replace(/\{(\w+)\}/g, (_, k) => String(map[k] ?? '')).replace(/\.\./g, '.').replace(/\.\?/g, '?');
}

export function buildPress(state: GameState, phase: 'pre' | 'post', c: PressCtx): { body: string; options: DecisionOption[] } {
  const rng = new Rng(state.seed++);
  const recent = state.pressRecent ?? [];
  const pool = (phase === 'pre' ? PRE : POST).filter((q) => q.when(c) && (q.answers.indexOf('post_win_star') < 0 || !!c.star));
  // izogni se zadnjim uporabljenim vprašanjem (po id + različici)
  const candidates = pool.flatMap((q) => q.texts.map((t, i) => ({ q, t, key: `${q.id}:${i}` }))).filter((x) => !recent.includes(x.key));
  const list = candidates.length ? candidates : pool.flatMap((q) => q.texts.map((t, i) => ({ q, t, key: `${q.id}:${i}` })));
  const pick = rng.weighted(list, list.map((x) => (x.q.weight ?? 1) / x.q.texts.length));
  state.pressRecent = [...recent, pick.key].slice(-14);
  const options = pick.q.answers
    .filter((a) => a !== 'post_win_star' || c.star)
    .map((a) => ({ label: fill(rng.pick(ANSWERS[a]), c), effect: a }));
  return { body: fill(pick.t, c), options };
}

export function fixtureRound(f: Fixture) {
  return f.round;
}
