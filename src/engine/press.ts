import { Rng } from './rng';
import type { DecisionOption, Fixture, GameState } from './types';

// Novinarske konference: vsako vprašanje ima več različic, odgovori pa več ubeseditev.
// Igra izbere vprašanje glede na okoliščine in se izogne nedavno uporabljenim.

type Ctx = Record<string, string | number>;

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

// Vsako vprašanje ima svoje odgovore (ubeseditev + učinek), da se vsebinsko ujemajo.
type A = [string, string[]]; // [učinek, različice odgovora]
interface QDef {
  id: string;
  when: (c: PressCtx) => boolean;
  weight?: number;
  texts: string[]; // različice ISTEGA vprašanja
  answers: A[];
}

const PRE: QDef[] = [
  { id: 'po-serija', when: (c) => c.playoff, weight: 5,
    texts: ['Končnica proti {opp}. Ste pripravljeni na serijo?', 'Kako se pripravljate na serijo z {opp}?'],
    answers: [['pre_confident', ['Pripravljeni smo, to serijo bomo dobili.', 'Čakali smo na ta trenutek, gremo do konca.']], ['pre_respect', ['{opp} je močan, a vemo, kje so ranljivi.', 'Serija bo dolga, ključna bo potrpežljivost.']], ['pre_neutral', ['Gledamo samo prvo tekmo, nič več.', 'Tekmo po tekmo, tako kot vso sezono.']]] },
  { id: 'po-izkusnje', when: (c) => c.playoff, weight: 2,
    texts: ['Je vaša ekipa dovolj izkušena za končnico?', 'V končnici odloča izkušnja. Je imate dovolj?'],
    answers: [['pre_confident', ['Imamo dovolj izkušenih igralcev, ki vedo, kako se zmaguje.', 'Izkušnje imamo, predvsem pa lakoto.']], ['pre_respect', ['Nasprotnik ima več izkušenj, mi pa več energije.', 'Učimo se sproti in hitro napredujemo.']], ['pre_neutral', ['Izkušnje so pomembne, a odloča led.', 'O tem bomo govorili po seriji.']]] },
  { id: 'derbi-pricak', when: (c) => c.derby && !c.playoff, weight: 3,
    texts: ['Danes je derbi proti {opp}. Kakšna so pričakovanja?', 'Kaj pričakujete od derbija z {opp}?'],
    answers: [['pre_confident', ['Derbi bo naš, o tem ni dvoma.', 'Pričakujem zmago in polno dvorano navijačev.']], ['pre_respect', ['Derbiji imajo svoja pravila, forma tu ne šteje.', '{opp} bo dal vse, pripravljeni moramo biti na boj.']], ['pre_neutral', ['Tri točke so tri točke, tudi na derbiju.', 'Za nas je to tekma kot vsaka druga.']]] },
  { id: 'derbi-pritisk', when: (c) => c.derby && !c.playoff, weight: 2,
    texts: ['Derbi z {opp} je za navijače najpomembnejša tekma sezone. Čutite pritisk?', 'Pred derbijem je mesto razdeljeno. Imate sporočilo za navijače?'],
    answers: [['pre_confident', ['Navijačem obljubljam zmago.', 'Pritisk nas žene, navijači bodo ponosni.']], ['pre_respect', ['Pritisk je, a ekipa ga zna nositi.', 'Navijače prosim za glasno podporo, potrebovali jo bomo.']], ['pre_neutral', ['Pritisk je vedno, na derbiju ga ni nič več.', 'Sporočilo bomo dali na ledu, ne z besedami.']]] },
  { id: 'porazi-polozaj', when: (c) => c.streak <= -3, weight: 4,
    texts: ['Izgubili ste {lstreak} tekme zapored. Je vaš položaj ogrožen?', 'Govori se o vaši zamenjavi po {lstreak} porazih. Vas skrbi?'],
    answers: [['pre_confident', ['Ne, verjamem v ekipo, obrat prihaja.', 'Moj položaj ni tema, tema je zmaga danes.']], ['pre_demand', ['Igralci morajo prevzeti odgovornost, jaz tudi.', 'Takšni rezultati niso sprejemljivi za nikogar.']], ['pre_neutral', ['O tem odloča uprava, ne jaz.', 'Ne komentiram govoric.']]] },
  { id: 'porazi-niz', when: (c) => c.streak <= -3, weight: 3,
    texts: ['Kako boste prekinili negativni niz?', 'Kaj se dogaja z ekipo po {lstreak} zaporednih porazih?'],
    answers: [['pre_confident', ['Danes ga prekinemo, ekipa je pripravljena.', 'Fantje so na treningu pokazali, da so lačni zmage.']], ['pre_demand', ['Z več truda in manj izgovorov.', 'Pričakujem reakcijo od vseh, brez izjeme.']], ['pre_neutral', ['Delamo naprej, kot vedno.', 'Rezultati bodo prišli, če ostanemo mirni.']]] },
  { id: 'zmage-favorit', when: (c) => c.streak >= 3, weight: 3,
    texts: ['Niz {streak} zmag. Ste zdaj favoriti za naslov?', 'Po {streak} zmagah zapored vas vsi vidijo kot favorite. Se strinjate?'],
    answers: [['pre_confident', ['Seveda, ciljamo na naslov.', 'Če tako nadaljujemo, nas je težko ustaviti.']], ['pre_respect', ['Favoritov ni, sezona je dolga.', 'Lepo, a vsak nasprotnik nas bo zdaj želel premagati.']], ['pre_neutral', ['Na lestvico ne gledamo.', 'Naslovi se delijo spomladi, ne zdaj.']]] },
  { id: 'zmage-fokus', when: (c) => c.streak >= 3, weight: 2,
    texts: ['Kako ohraniti fokus po takšnem nizu zmag?', 'Vas je strah, da se niz zmag konča prav danes?'],
    answers: [['pre_confident', ['Ne, ekipa je lačna še več zmag.', 'Niz bomo podaljšali.']], ['pre_respect', ['Vsak niz se enkrat konča, a danes ne bo lahko premagati nas.', 'Ostati moramo ponižni in delavni.']], ['pre_neutral', ['O nizu ne razmišljamo.', 'Fokus je na naslednjem menjavi, ne na nizu.']]] },
  { id: 'visje', when: (c) => c.oppPos < c.myPos && !c.playoff, weight: 2,
    texts: ['{opp} je na lestvici višje. Kako se boste postavili nasproti njim?', 'Proti {opp} niste favoriti. Kaj je vaš načrt?'],
    answers: [['pre_confident', ['Pokazali bomo, da sodimo na vrh.', 'Lestvica ne igra, mi bomo zmagali.']], ['pre_pressure', ['Pritisk je na njih, ne na nas.', 'Oni so favoriti, mi nimamo kaj izgubiti.']], ['pre_neutral', ['Igrali bomo svojo igro.', 'Načrt je jasen, a ga ne bom razkril.']]] },
  { id: 'nizje', when: (c) => c.oppPos > c.myPos + 2 && !c.playoff, weight: 2,
    texts: ['Proti {opp} ste veliki favoriti. Je to nevarno?', 'Vsi pričakujejo lahko zmago proti {opp}. Se strinjate?'],
    answers: [['pre_confident', ['Smo boljša ekipa in to bomo pokazali.', 'Pričakujem prepričljivo zmago.']], ['pre_respect', ['Lahkih tekem ni, {opp} lahko preseneti.', 'Prav take tekme so najbolj nevarne.']], ['pre_neutral', ['Favoritstvo ne pomeni nič.', 'Vsaka tekma se začne pri 0:0.']]] },
  { id: 'mladi-priloznost', when: (c) => c.oppPos > c.myPos + 2 && !c.playoff, weight: 1,
    texts: ['Boste proti {opp} dali priložnost mlajšim igralcem?'],
    answers: [['pre_confident', ['Mladi so pripravljeni in bodo dobili priložnost.']], ['pre_respect', ['Najprej moramo zmagati, šele nato eksperimentiramo.']], ['pre_neutral', ['Postavo boste videli pred tekmo.']]] },
  { id: 'poskodba', when: (c) => !!c.injuredStar, weight: 2,
    texts: ['Kako boste nadomestili poškodovanega {injured}?', 'Brez {injured} boste težko. Kdo bo prevzel njegovo vlogo?'],
    answers: [['pre_confident', ['Imamo širok kader, drugi bodo stopili naprej.', 'To je priložnost za nekoga drugega, verjamem vanje.']], ['pre_respect', ['{injured} nam bo zelo manjkal, to je jasno.', 'Brez njega bomo morali igrati bolj kolektivno.']], ['pre_neutral', ['Poškodbe so del hokeja.', 'Ne bom iskal izgovorov.']]] },
  { id: 'zvezda-nasp', when: (c) => !!c.oppStar, weight: 2,
    texts: ['{oppstar} je eden najboljših strelcev lige. Imate načrt zanj?', 'Kako boste ustavili {oppstar}?'],
    answers: [['pre_confident', ['Imamo načrt, danes ne bo zadel.', 'Naši branilci ga bodo zaustavili.']], ['pre_respect', ['Je odličen igralec, popolnoma ga ne moreš ustaviti.', 'Moramo mu vzeti prostor in čas.']], ['pre_neutral', ['Ne igramo proti enemu igralcu, ampak proti ekipi.', 'O posameznikih ne govorim.']]] },
  { id: 'mladi-tujina', when: (c) => !!c.youngStar, weight: 2,
    texts: ['{young} je razkritje sezone. Ga bodo kmalu odpeljali v tujino?', 'Za {young} se zanimajo tuji klubi. Ga boste lahko obdržali?'],
    answers: [['pre_confident', ['Pri nas ima vse pogoje za razvoj, ostal bo.', 'Ne prodajamo, {young} je naša prihodnost.']], ['pre_respect', ['Če pride prava ponudba, mu ne bomo stali na poti.', 'Ponosni smo, da je naš igralec zanimiv za tujino.']], ['pre_neutral', ['O tem zdaj ne razmišljamo.', 'Pogodba velja, vse ostalo so govorice.']]] },
  { id: 'mladi-vloga', when: (c) => !!c.youngStar, weight: 1,
    texts: ['Koliko prostora boste dali mlademu {young}?', 'Je {young} že pripravljen na večjo vlogo?'],
    answers: [['pre_confident', ['Zaslužil si je mesto v prvih napadih.', 'Pripravljen je, dobil bo več minut.']], ['pre_respect', ['Postopoma, ne želimo ga preobremeniti.', 'Je mlad, potrebuje čas in potrpljenje.']], ['pre_neutral', ['Minutaža je odvisna od treninga, kot pri vseh.', 'Ne bi izpostavljal posameznikov.']]] },
  { id: 'navijaci-slabo', when: (c) => c.fans < 40, weight: 2,
    texts: ['Obisk pada, navijači so razočarani. Kaj jim sporočate?', 'Navijači žvižgajo. Razumete njihovo nezadovoljstvo?'],
    answers: [['pre_confident', ['Vrnili jih bomo z zmagami, obljubim.', 'Prosim za potrpljenje, boljši časi prihajajo.']], ['pre_demand', ['Razumem jih, tudi jaz pričakujem več od ekipe.', 'Imajo prav, ekipa mora pokazati več.']], ['pre_neutral', ['Navijači imajo pravico do svojega mnenja.', 'Spoštujemo jih, odgovor bomo dali na ledu.']]] },
  { id: 'navijaci-dobro', when: (c) => c.fans > 80 && c.home, weight: 1,
    texts: ['{arena} bo danes spet polna. Koliko vam pomenijo navijači?', 'Doma ste zelo močni. Je vzdušje vaša prednost?'],
    answers: [['pre_confident', ['Z našimi navijači smo doma nepremagljivi.', 'Navijači so naš šesti igralec.']], ['pre_respect', ['Zelo veliko, hvala jim za podporo.', 'Vzdušje pomaga, a igrati moramo sami.']], ['pre_neutral', ['Vedno igramo za navijače.', 'Doma ali v gosteh, igramo enako.']]] },
  { id: 'uprava', when: (c) => c.board < 35, weight: 3,
    texts: ['Govori se, da uprava izgublja potrpljenje. Vas skrbi?', 'Je to tekma, ki odloča o vaši prihodnosti?'],
    answers: [['pre_confident', ['Ne skrbi me, rezultati bodo prišli.', 'Imam zaupanje uprave in ekipe.']], ['pre_demand', ['Vsi smo pod pritiskom, igralci tudi.', 'Vsaka tekma je pomembna, ta še posebej.']], ['pre_neutral', ['To vprašajte upravo.', 'O tem ne razmišljam.']]] },
  { id: 'zacetek', when: (c) => c.round <= 3 && !c.playoff, weight: 2,
    texts: ['Sezona se šele začenja. Kakšni so cilji?', 'Kakšne cilje ste si zastavili za to sezono?'],
    answers: [['pre_confident', ['Cilj je naslov, nič manj.', 'Želimo biti v vrhu od prvega do zadnjega kroga.']], ['pre_respect', ['Najprej končnica, potem vse naprej.', 'Liga je izenačena, cilj je napredek.']], ['pre_neutral', ['Cilje bomo uresničevali, ne razglašali.', 'Najprej ta tekma, potem naprej.']]] },
  { id: 'gost', when: (c) => !c.home && !c.playoff, weight: 1,
    texts: ['Gostovanje pri {opp} ni nikoli lahko. Kaj pričakujete?'],
    answers: [['pre_confident', ['Domov gremo s tremi točkami.']], ['pre_respect', ['Pri njih je vedno težko, potrebna bo zrela igra.']], ['pre_neutral', ['Led je povsod enak.']]] },
  { id: 'forma', when: () => true, weight: 1,
    texts: ['V kakšni formi je ekipa pred tekmo z {opp}?', 'Kako so igralci pripravljeni na današnjo tekmo?'],
    answers: [['pre_confident', ['V odlični, fantje so pripravljeni na zmago.', 'Še nikoli nismo bili tako dobro pripravljeni.']], ['pre_respect', ['Dobro, a {opp} bo zahteven nasprotnik.', 'Pripravljeni smo, vemo pa, da nas čaka trd boj.']], ['pre_neutral', ['Normalno, kot pred vsako tekmo.', 'Formo boste videli na ledu.']]] },
  { id: 'nasprotnik', when: () => true, weight: 1,
    texts: ['Kako ocenjujete današnjega nasprotnika {opp}?', 'Kje vidite največjo prednost proti {opp}?'],
    answers: [['pre_confident', ['Smo boljša ekipa, to bomo dokazali.', 'Naša hitrost bo odločila.']], ['pre_respect', ['{opp} je dobro organizirana ekipa, spoštujemo jih.', 'Analizirali smo jih, imajo kakovost, a tudi slabosti.']], ['pre_neutral', ['Osredotočeni smo nase, ne nanje.', 'Prednosti ne bom razkrival.']]] },
  { id: 'postava', when: () => true, weight: 1,
    texts: ['Bo prišlo do sprememb v postavi?', 'Je kdo od igralcev pod vprašajem za današnjo tekmo?'],
    answers: [['pre_confident', ['Igra najmočnejša postava, pripravljeni smo.', 'Vsi so zdravi in lačni igre.']], ['pre_respect', ['Nekaj manjših sprememb, prilagodili smo se nasprotniku.', 'Odločitev bomo sprejeli po ogrevanju.']], ['pre_neutral', ['Postavo boste videli pred tekmo.', 'O tem ne govorim pred tekmo.']]] },
];

const POST: QDef[] = [
  { id: 'zm-visoka', when: (c) => !!c.won && (c.my ?? 0) - (c.op ?? 0) >= 4, weight: 4,
    texts: ['Visoka zmaga {score} proti {opp}. Ste presenečeni nad razliko?', 'Prepričljivo, {score}. Je to vaša najboljša predstava sezone?'],
    answers: [['post_win_team', ['Ne, ekipa je igrala odlično od prve do zadnje minute.', 'Vsi so bili danes na visoki ravni, to je zasluga ekipe.']], ['post_win_star', ['{star} je bil danes izjemen, odprl nam je tekmo.']], ['post_win_humble', ['Rezultat je lep, a {opp} ni pokazal najboljše igre. Ostanimo realni.', 'Najboljša še ni bila, imamo rezerve.']]] },
  { id: 'zm-podaljsek', when: (c) => !!c.won && (!!c.ot || !!c.so), weight: 4,
    texts: ['Zmaga po {otword}. Ste zadovoljni ali razočarani, da niso bile tri točke?', 'Dve točki po {otword}. Kako ste preživeli napete trenutke?'],
    answers: [['post_win_team', ['Zadovoljen, ekipa je pokazala karakter do konca.', 'Fantje so ostali mirni, ponosen sem nanje.']], ['post_win_star', ['{star} nas je rešil, takšne igralce potrebuješ v ključnih trenutkih.']], ['post_win_humble', ['Morali bi zmagati že v rednem delu, to je lekcija.', 'Dve točki so lepe, a pustili smo eno na ledu.']]] },
  { id: 'zm-preobrat', when: (c) => !!c.won && !!c.comeback, weight: 5,
    texts: ['Zaostajali ste, pa ste tekmo obrnili. Kaj ste rekli ekipi?', 'Velik preobrat proti {opp}. Je to dokaz karakterja?'],
    answers: [['post_win_team', ['Da, ta ekipa se nikoli ne preda.', 'Rekel sem jim, naj verjamejo, in so.']], ['post_win_star', ['{star} je potegnil ekipo, ko je bilo najtežje.']], ['post_win_humble', ['Lep preobrat, a ne bi smeli zaostajati.', 'Karakter je, začetek pa moramo popraviti.']]] },
  { id: 'zm-hattrick', when: (c) => !!c.won && (c.starGoals ?? 0) >= 3, weight: 5,
    texts: ['{star} je dosegel hat-trick. Koliko vam pomeni?', 'Večer za {star}: {stargoals} goli. Kako ga ocenjujete?'],
    answers: [['post_win_team', ['Odlično, a goli so plod dela celotne ekipe.', 'Vesel sem zanj, podaje soigralcev so bile vrhunske.']], ['post_win_star', ['{star} je danes pokazal, zakaj je eden najboljših v ligi.', 'Fenomenalen večer, zasluži si vse pohvale.']], ['post_win_humble', ['Super, a jutri je nov dan in nova tekma.', 'Lepo, naj tako nadaljuje tudi v obrambi.']]] },
  { id: 'zm-nicla', when: (c) => !!c.won && !!c.shutout, weight: 3,
    texts: ['Brez prejetega gola. Je to zasluga golmana ali obrambe?', 'Ničla proti {opp}. Je obramba vaša največja moč?'],
    answers: [['post_win_team', ['Obeh, cela ekipa je odlično branila.', 'To je zmaga celotne obrambe, od napadalcev do golmana.']], ['post_win_star', ['{star} je bil danes odličen, golman pa je opravil svoje.']], ['post_win_humble', ['Lepa ničla, a v napadu moramo biti učinkovitejši.', 'Obramba dobra, napad pa še ima rezerve.']]] },
  { id: 'zm-derbi', when: (c) => !!c.won && c.derby, weight: 4,
    texts: ['Derbi je vaš! Kaj sporočate navijačem?', 'Zmaga na derbiju proti {opp}. Je to najlepša zmaga sezone?'],
    answers: [['post_win_team', ['Ta zmaga je za navijače, hvala za podporo!', 'Da, to je zmaga za vse, ki imajo radi naš klub.']], ['post_win_star', ['{star} je bil junak derbija, navijači ga bodo pomnili.']], ['post_win_humble', ['Lepo, a to so samo tri točke. Gremo naprej.', 'Uživajmo nocoj, jutri pa spet delo.']]] },
  { id: 'zm-splosno', when: (c) => !!c.won, weight: 1,
    texts: ['Zmaga {score} proti {opp}. Kaj je bilo odločilno?', 'Pomembne tri točke. Ste zadovoljni z igro?'],
    answers: [['post_win_team', ['Odločila je borbenost cele ekipe.', 'Zadovoljen sem, vsi so odigrali svojo vlogo.']], ['post_win_star', ['Odločil je {star}, danes je bil razlika.']], ['post_win_humble', ['Točke so tu, igra pa še ni na ravni, ki si jo želim.', 'Zmagali smo, a imamo še veliko dela.']]] },
  { id: 'po-visok', when: (c) => !c.won && (c.op ?? 0) - (c.my ?? 0) >= 4, weight: 4,
    texts: ['Boleč poraz {score}. Kaj se je zgodilo?', 'Po porazu {score} se navijači sprašujejo o taktiki. Odgovor?'],
    answers: [['post_loss_me', ['Za tak poraz je kriv trener. Prevzemam odgovornost.', 'Taktično nisem dobro pripravil ekipe.']], ['post_loss_players', ['Ekipa danes sploh ni prišla na led. To ni sprejemljivo.', 'Nekateri igralci so igrali daleč pod svojo ravnjo.']], ['post_loss_refs', ['Rezultat je previsok, odločile so nekatere sodniške odločitve.', 'Ko te sodniki kaznujejo pri vsakem stiku, je težko.']]] },
  { id: 'po-podaljsek', when: (c) => !c.won && (!!c.ot || !!c.so), weight: 3,
    texts: ['Poraz po {otword}, a vsaj točka. Kako gledate na to?', 'Tako blizu, pa vendar poraz po {otword}. Je razočaranje veliko?'],
    answers: [['post_loss_positive', ['Točka je dragocena, igra je bila dobra.', 'Razočaranje je, a na tej igri lahko gradimo.']], ['post_loss_players', ['Zmago smo imeli v rokah, pa smo jo izpustili.', 'V ključnih trenutkih smo bili premalo zbrani.']], ['post_loss_refs', ['V podaljšku bi morali dobiti igralca več.', 'Sodniki so v odločilnem trenutku spregledali prekršek.']]] },
  { id: 'po-streli', when: (c) => !c.won && (c.shotsFor ?? 0) > (c.shotsAgainst ?? 0) + 8, weight: 4,
    texts: ['Imeli ste {shots} strelov, pa ste izgubili. Je bil golman nasprotnika nepremagljiv?', 'Prevladovali ste, a rezultat je proti vam. Kaj manjka?'],
    answers: [['post_loss_positive', ['Igrali smo dobro, plošček preprosto ni hotel v gol.', 'Njihov golman je bil izjemen, mi pa smo igrali dobro.']], ['post_loss_players', ['Manjka nam realizacija. Več strelov z boljših položajev.', 'Napadalci morajo biti bolj odločni pred golom.']], ['post_loss_me', ['Moja naloga je, da najdem rešitev za realizacijo.', 'Moramo spremeniti pristop v napadu, to je na meni.']]] },
  { id: 'po-kazni', when: (c) => !c.won && (c.pim ?? 0) >= 12, weight: 4,
    texts: ['Kar {pim} kazenskih minut. Je disciplina problem?', 'Preveč izključitev vas je stalo tekme. Se strinjate?'],
    answers: [['post_loss_players', ['Da, nekateri igralci se ne znajo kontrolirati.', 'Nedisciplina nas je stala tekme, to se mora spremeniti.']], ['post_loss_refs', ['Nekatere kazni so bile zelo strogo dosojene.', 'Kriteriji sojenja niso bili enaki za obe ekipi.']], ['post_loss_me', ['Disciplina je moja odgovornost, to bom uredil.', 'Moral bi bolje pripraviti ekipo na agresivnega nasprotnika.']]] },
  { id: 'po-derbi', when: (c) => !c.won && c.derby, weight: 4,
    texts: ['Poraz na derbiju boli. Kaj sporočate navijačem?', '{opp} je dobil derbi. Kaj je šlo narobe?'],
    answers: [['post_loss_me', ['Navijačem se opravičujem, prevzemam odgovornost.', 'Žal mi je za navijače, nisem dobro pripravil ekipe.']], ['post_loss_players', ['Na derbiju moraš dati vse, nekateri tega niso.', 'Premalo srca za tako tekmo.']], ['post_loss_positive', ['Borili smo se, zmagal pa je boljši ta večer. Vrnili se bomo.', 'Boli, a na naslednjem derbiju bomo boljši.']]] },
  { id: 'po-splosno', when: (c) => !c.won, weight: 1,
    texts: ['Poraz {score} proti {opp}. Kaj je šlo narobe?', 'Kje ste danes izgubili tekmo?'],
    answers: [['post_loss_me', ['Za poraz sem kriv jaz, ne igralci.', 'Nisem našel prave rešitve med tekmo.']], ['post_loss_players', ['Igralci niso dali vsega od sebe.', 'Preveč individualnih napak.']], ['post_loss_positive', ['Igrali smo dobro, rezultat ni odraz igre.', 'Imeli smo priložnosti, a jih nismo izkoristili.']]] },
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
  const pool = (phase === 'pre' ? PRE : POST).filter((q) => q.when(c));
  const all = pool.flatMap((q) => q.texts.map((t, i) => ({ q, t, key: `${q.id}:${i}` })));
  const fresh = all.filter((x) => !recent.includes(x.key) && !recent.slice(-8).includes(x.q.id));
  const list = fresh.length ? fresh : all;
  const pick = rng.weighted(list, list.map((x) => (x.q.weight ?? 1) / x.q.texts.length));
  state.pressRecent = [...recent, pick.key, pick.q.id].slice(-20);
  const options = pick.q.answers
    .filter(([eff]) => eff !== 'post_win_star' || !!c.star)
    .map(([eff, labels]) => ({ label: fill(rng.pick(labels), c), effect: eff }));
  return { body: fill(pick.t, c), options };
}

export function fixtureRound(f: Fixture) {
  return f.round;
}
