// Novice: skupni zapis in bogatejša vsebina (poročila, pregled kroga, napoved tekme, igralec tedna).
// Telo je sestavljeno iz odstavkov (ločenih z dvema novima vrsticama), vsak odstavek je ena predloga za prevod.
import type { Fixture, GameState, NewsItem, Player } from './types';

let seq = 0;
export interface NewsOpts {
  important?: boolean;
  action?: { label: string; href: string };
  from?: string;
  fixtureId?: string;
}

export function pushNews(s: GameState, kind: NewsItem['kind'], title: string, body: string | string[], o: NewsOpts = {}) {
  const text = (Array.isArray(body) ? body.filter(Boolean) : [body]).join('\n\n');
  s.news.unshift({ id: `n${Date.now().toString(36)}${(seq++).toString(36)}`, date: s.date, title, body: text, kind, read: false, ...o });
  if (s.news.length > 120) s.news.length = 120;
}

const fmt = (n: number) => Math.round(n).toLocaleString('sl-SI');
const nm = (s: GameState, id: string) => {
  const p = s.players[id];
  return p ? `${p.first} ${p.last}` : '—';
};
const short = (s: GameState, id: string) => s.clubs.find((c) => c.id === id)?.short ?? id;
const full = (s: GameState, id: string) => s.clubs.find((c) => c.id === id)?.name ?? id;

interface Row { clubId: string; gp: number; pts: number; gf: number; ga: number }
function table(s: GameState): Row[] {
  const m: Record<string, Row> = {};
  for (const c of s.clubs) m[c.id] = { clubId: c.id, gp: 0, pts: 0, gf: 0, ga: 0 };
  for (const f of s.fixtures) {
    if (f.stage !== 'redni' || !f.result) continue;
    const r = f.result;
    const h = m[f.home], a = m[f.away];
    if (!h || !a) continue;
    h.gp++; a.gp++;
    h.gf += r.hg; h.ga += r.ag; a.gf += r.ag; a.ga += r.hg;
    const hw = r.hg > r.ag;
    const ex = r.ot || r.so;
    h.pts += hw ? (ex ? 2 : 3) : ex ? 1 : 0;
    a.pts += !hw ? (ex ? 2 : 3) : ex ? 1 : 0;
  }
  return Object.values(m).sort((x, y) => y.pts - x.pts || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf);
}

function form(s: GameState, clubId: string, n = 5): string {
  return s.fixtures
    .filter((f) => f.result && f.stage !== 'prijateljska' && (f.home === clubId || f.away === clubId))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-n)
    .map((f) => {
      const home = f.home === clubId;
      const won = home ? f.result!.hg > f.result!.ag : f.result!.ag > f.result!.hg;
      return won ? 'Z' : f.result!.ot || f.result!.so ? 'PP' : 'P';
    })
    .join('-');
}

function topScorer(s: GameState, clubId: string): Player | undefined {
  return Object.values(s.players)
    .filter((p) => p.clubId === clubId && p.pos !== 'G')
    .sort((a, b) => b.stats.g + b.stats.a - (a.stats.g + a.stats.a) || b.stats.g - a.stats.g)[0];
}

const scoreTag = (f: Fixture) => (f.result!.so ? ' (KS)' : f.result!.ot ? ' (POD)' : '');

// poročilo o tekmi uporabnika
export function matchReport(s: GameState, f: Fixture) {
  const r = f.result!;
  const us = f.home === s.userClubId;
  const myG = us ? r.hg : r.ag;
  const opG = us ? r.ag : r.hg;
  const oppId = us ? f.away : f.home;
  const won = myG > opG;
  const tag = r.so ? ' po kazenskih strelih' : r.ot ? ' po podaljšku' : '';
  const friendly = f.stage === 'prijateljska';
  const paras: string[] = [];
  const diff = Math.abs(myG - opG);
  if (friendly) paras.push(`Pripravljalna tekma proti ${full(s, oppId)} se je končala ${myG}:${opG}. Rezultat ni pomemben, trenerji so preizkušali nove postave.`);
  else if (won && diff >= 3) paras.push(`Prepričljiva zmaga ${short(s, s.userClubId)} proti ${full(s, oppId)} z ${myG}:${opG}. Ekipa je tekmo nadzorovala od začetka do konca.`);
  else if (won) paras.push(`${short(s, s.userClubId)} je ${us ? 'doma' : 'v gosteh'} premagal ${full(s, oppId)} z ${myG}:${opG}${tag}.`);
  else if (diff >= 3) paras.push(`Boleč poraz ${short(s, s.userClubId)} proti ${full(s, oppId)} z ${myG}:${opG}. Tekmec je bil boljši v vseh delih igre.`);
  else paras.push(`${short(s, s.userClubId)} je ${us ? 'doma' : 'v gosteh'} izgubil proti ${full(s, oppId)} z ${myG}:${opG}${tag}.`);

  const mine = r.goals.filter((g) => (g.team === 'home') === us && g.scorer);
  if (mine.length) {
    const cnt: Record<string, number> = {};
    mine.forEach((g) => (cnt[g.scorer] = (cnt[g.scorer] ?? 0) + 1));
    const list = Object.entries(cnt).map(([id, n]) => (n > 1 ? `${nm(s, id)} (${n})` : nm(s, id))).join(', ');
    paras.push(`Strelci za naše: ${list}.`);
  } else paras.push('Naši napadalci tokrat niso premagali vratarja tekmeca.');

  const box = r.box ?? [];
  const best = box
    .filter((b) => (b[1] === 0) === us)
    .sort((a, b) => b[2] * 2 + b[3] - (a[2] * 2 + a[3]))[0];
  if (best && best[2] + best[3] >= 2) paras.push(`Najbolj je izstopal ${nm(s, best[0])} (goli: ${best[2]}, podaje: ${best[3]}).`);
  const gid = us ? r.goalies?.home : r.goalies?.away;
  const shotsAgainst = us ? r.aShots : r.hShots;
  if (gid && shotsAgainst) paras.push(`Vratar ${nm(s, gid)} je ubranil ${shotsAgainst - opG} od ${shotsAgainst} strelov (${(((shotsAgainst - opG) / shotsAgainst) * 100).toFixed(1)} %).`);
  paras.push(`Streli na gol: ${us ? r.hShots : r.aShots}:${shotsAgainst}. Obisk: ${fmt(r.attendance)} gledalcev.`);

  if (f.stage === 'redni') {
    const t = table(s);
    const pos = t.findIndex((x) => x.clubId === s.userClubId) + 1;
    paras.push(`Na lestvici smo ${pos}. (točke: ${t[pos - 1].pts}, tekme: ${t[pos - 1].gp}). Forma: ${form(s, s.userClubId)}.`);
  }
  const next = s.fixtures.filter((x) => !x.played && x.date > f.date && (x.home === s.userClubId || x.away === s.userClubId)).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (next) paras.push(`Naslednja tekma: ${next.home === s.userClubId ? 'doma' : 'v gosteh'} proti ${full(s, next.home === s.userClubId ? next.away : next.home)}, ${next.date.slice(8, 10)}. ${next.date.slice(5, 7)}.`);

  const title = friendly ? `Prijateljska: ${won ? 'zmaga' : 'poraz'} proti ${short(s, oppId)} ${myG}:${opG}` : `${won ? 'Zmaga' : 'Poraz'} proti ${short(s, oppId)} ${myG}:${opG}${tag}`;
  pushNews(s, 'tekma', title, paras, { fixtureId: f.id, from: 'Pomočnik trenerja', action: { label: 'Poročilo s tekme', href: `/porocilo?id=${f.id}` } });
}

// pregled kroga: vsi rezultati dneva in vrh lestvice
export function roundRecap(s: GameState, day: string) {
  const played = s.fixtures.filter((f) => f.date === day && f.result && f.stage === 'redni');
  if (played.length < 2) return;
  const lines = played.map((f) => `${short(s, f.home)} – ${short(s, f.away)} ${f.result!.hg}:${f.result!.ag}${scoreTag(f)}`);
  const big = [...played].sort((a, b) => b.result!.hg + b.result!.ag - (a.result!.hg + a.result!.ag))[0];
  const t = table(s);
  const top = t.slice(0, 3).map((x, i) => `${i + 1}. ${short(s, x.clubId)} ${x.pts}`).join(', ');
  const pos = t.findIndex((x) => x.clubId === s.userClubId) + 1;
  const paras = [
    `Rezultati: ${lines.join(' · ')}.`,
    `Največ golov je padlo na tekmi ${short(s, big.home)} – ${short(s, big.away)} (${big.result!.hg + big.result!.ag}).`,
    `Vrh lestvice: ${top}. Tvoja ekipa je na ${pos}. mestu.`,
  ];
  const round = played[0].round;
  pushNews(s, 'liga', `IHL: pregled ${round}. kroga`, paras, { from: 'Liga IHL', action: { label: 'Lestvica', href: '/liga' } });
}

// napoved dan pred tekmo uporabnika
export function matchPreview(s: GameState, f: Fixture) {
  const us = f.home === s.userClubId;
  const opp = us ? f.away : f.home;
  const paras: string[] = [];
  if (f.stage === 'redni') {
    const t = table(s);
    const pos = t.findIndex((x) => x.clubId === opp) + 1;
    const row = t[pos - 1];
    if (row.gp) paras.push(`${full(s, opp)} je trenutno ${pos}. na lestvici (točke: ${row.pts}, gol razlika ${row.gf}:${row.ga}). Forma zadnjih tekem: ${form(s, opp) || '—'}.`);
    else paras.push(`${full(s, opp)} sezono šele začenja. O njihovi formi bo več znanega po prvih tekmah.`);
  } else paras.push(`Tekma končnice proti ${full(s, opp)}. Vsaka zmaga šteje dvojno.`);
  const ts = topScorer(s, opp);
  if (ts && ts.stats.gp) paras.push(`Največja nevarnost: ${ts.first} ${ts.last} (goli: ${ts.stats.g}, podaje: ${ts.stats.a}).`);
  const last = s.fixtures
    .filter((x) => x.result && x.stage !== 'prijateljska' && ((x.home === opp && x.away === s.userClubId) || (x.away === opp && x.home === s.userClubId)))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (last) paras.push(`Zadnja medsebojna tekma: ${short(s, last.home)} – ${short(s, last.away)} ${last.result!.hg}:${last.result!.ag}${scoreTag(last)}.`);
  const inj = Object.values(s.players).filter((p) => p.clubId === s.userClubId && p.injuryDays > 0);
  paras.push(inj.length ? `Pri nas manjkajo: ${inj.map((p) => `${p.first} ${p.last}`).join(', ')}.` : 'V naši ekipi so vsi igralci zdravi.');
  pushNews(s, 'mediji', `Napoved: ${short(s, f.home)} – ${short(s, f.away)}`, paras, { from: 'Mediji', action: { label: 'Postave', href: '/postave' } });
}

// ponedeljek: igralec tedna v ligi (največ točk v zadnjih 7 dneh)
export function playerOfWeek(s: GameState) {
  const from = new Date(s.date + 'T12:00:00Z');
  from.setUTCDate(from.getUTCDate() - 7);
  const since = from.toISOString().slice(0, 10);
  const pts: Record<string, [number, number, number]> = {};
  for (const f of s.fixtures) {
    if (!f.result || f.date < since || f.date >= s.date || f.stage === 'prijateljska') continue;
    for (const g of f.result.goals) {
      if (g.scorer) (pts[g.scorer] ??= [0, 0, 0])[0]++;
      for (const a of g.assists) (pts[a] ??= [0, 0, 0])[1]++;
    }
    for (const id of new Set([...f.result.goals.flatMap((g) => [g.scorer, ...g.assists])])) if (id) (pts[id] ??= [0, 0, 0])[2]++;
  }
  const best = Object.entries(pts).sort((a, b) => b[1][0] + b[1][1] - (a[1][0] + a[1][1]) || b[1][0] - a[1][0])[0];
  if (!best || best[1][0] + best[1][1] < 3) return;
  const p = s.players[best[0]];
  if (!p?.clubId) return;
  const [g, a] = best[1];
  const ours = p.clubId === s.userClubId;
  pushNews(s, 'mediji', `Igralec tedna: ${p.first} ${p.last}`, [
    `Izbor tedna v ligi IHL je ${p.first} ${p.last} (${full(s, p.clubId)}). V zadnjih sedmih dneh je bil najbolj učinkovit igralec lige (goli: ${g}, podaje: ${a}).`,
    `Statistika sezone: tekme ${p.stats.gp}, goli ${p.stats.g}, podaje ${p.stats.a}.`,
    ours ? 'Navijači so navdušeni, igralec pa pravi, da je zasluga cele ekipe.' : '',
  ], { from: 'Mediji', action: { label: 'Profil igralca', href: `/igralec?id=${p.id}` } });
}

// ponudba za igralca uporabnika (pomembno, ustavi nadaljevanje)
export function offerNews(s: GameState, p: Player, buyer: string, league: string | undefined, fee: number, value: number, sellOn?: number, days = 5) {
  const who = league ? `${buyer} (${league})` : buyer;
  const st = p.stats.gp ? p.stats : p.history[p.history.length - 1]?.stats;
  const ratio = fee / Math.max(1, value);
  const advice =
    ratio >= 1.2 ? 'Športni direktor: ponudba je precej nad vrednostjo igralca. Priporočam, da jo sprejmeš.'
    : ratio >= 0.9 ? 'Športni direktor: ponudba je poštena. Če igralca ne potrebuješ nujno, jo lahko sprejmeš ali poskusiš s protiponudbo.'
    : 'Športni direktor: ponudba je pod vrednostjo igralca. Predlagam protiponudbo ali zavrnitev.';
  pushNews(s, 'prestopi', `Ponudba za igralca ${p.first} ${p.last}`, [
    sellOn ? `${who} ponuja ${fmt(fee)} € za igralca ${p.first} ${p.last} in ${sellOn} % od nadaljnje prodaje.` : `${who} ponuja ${fmt(fee)} € za igralca ${p.first} ${p.last}.`,
    st && st.gp ? (p.pos === 'G' ? `${p.stats.gp ? 'Ta sezona' : 'Lanska sezona'}: tekme v vratih ${st.gp}.` : `${p.stats.gp ? 'Ta sezona' : 'Lanska sezona'}: tekme ${st.gp}, goli ${st.g}, podaje ${st.a}.`) : '',
    `Ocenjena vrednost: ${fmt(value)} €. Pogodba velja do ${p.contractUntil}, plača ${fmt(p.wage)} €/mes.`,
    advice,
    `Ponudba velja ${days} dni. Odločiš se na strani igralca.`,
  ], { important: true, from: 'Športni direktor', action: { label: 'Odpri ponudbo', href: `/igralec?id=${p.id}` } });
}
