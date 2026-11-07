import { resolveDecision } from '../src/engine/events';
let decisionsSeen = 0;
import { createGame, advanceDay, quickSim, standings, userFixtureToday, startNewSeason } from '../src/engine/season';

const state = createGame({ first: 'Test', last: 'Manager', nat: 'SLO', age: 40, background: 'igralec', style: 'uravnotezen', reputation: 50 }, 'tri', 12345);

function playSeason() {
  let guard = 0;
  while (state.phase !== 'konec' && guard++ < 400) {
    const uf = userFixtureToday(state);
    if (uf) quickSim(state, uf);
    while ((state.decisions ?? []).some((d) => d.blocking)) { const d = state.decisions!.find((x) => x.blocking)!; resolveDecision(state, d.id, 0); decisionsSeen++; }
    advanceDay(state);
  }
}
const t0 = Date.now();
playSeason();
const ms = Date.now() - t0;

const games = state.fixtures.filter((f) => f.played && f.result);
const n = games.length;
const sum = (fn: (r: NonNullable<(typeof games)[0]['result']>) => number) => games.reduce((s, f) => s + fn(f.result!), 0);
console.log(`Tekem: ${n}, čas ${ms} ms`);
console.log('Goli na tekmo (obe ekipi):', (sum((r) => r.hg + r.ag) / n).toFixed(2));
console.log('Streli na gol na ekipo:', (sum((r) => r.hShots + r.aShots) / n / 2).toFixed(1));
console.log('Domače zmage %:', ((games.filter((f) => f.result!.hg > f.result!.ag).length / n) * 100).toFixed(1));
console.log('Podaljški/kazenski %:', ((games.filter((f) => f.result!.ot || f.result!.so).length / n) * 100).toFixed(1));
const ppGoals = games.reduce((s, f) => s + f.result!.goals.filter((g) => g.strength === 'PP').length, 0);
console.log('PP goli delež %:', ((ppGoals / sum((r) => r.hg + r.ag)) * 100).toFixed(1));
const pim = Object.values(state.players).reduce((s, p) => s + p.stats.pim, 0);
console.log('Kazenske min na ekipo na tekmo:', (pim / n / 2).toFixed(1));
const goalies = Object.values(state.players).filter((p) => p.pos === 'G' && p.stats.sa > 100);
const sv = goalies.reduce((s, p) => s + (p.stats.sa - p.stats.ga), 0) / goalies.reduce((s, p) => s + p.stats.sa, 0);
console.log('Povprečni % obramb:', (sv * 100).toFixed(1));
console.log('\nLestvica:');
for (const s of standings(state)) console.log(s.clubId, s.gp, s.pts, `${s.gf}:${s.ga}`);
console.log('Prvak:', state.champion);
const top = Object.values(state.players).sort((a, b) => b.stats.g + b.stats.a - (a.stats.g + a.stats.a)).slice(0, 8);
console.log('\nNajboljši strelci:');
for (const p of top) console.log(`${p.first} ${p.last} (${p.clubId}, ${p.pos}, ${p.ovr}) ${p.stats.gp} GP ${p.stats.g}+${p.stats.a}=${p.stats.g + p.stats.a} PIM ${p.stats.pim} +/- ${p.stats.pm}`);
const res = startNewSeason(state);
console.log('\nNova sezona: spremembe', res.changes.length, 'upokojeni', res.retired.length, 'mladinci', res.youth.length);
playSeason();
console.log('Prvak 2. sezone:', state.champion, 'igralcev:', Object.keys(state.players).length);
console.log('JSON velikost KB:', (JSON.stringify(state).length / 1024).toFixed(0));
console.log('\nFinance po 2 sezonah:');
for (const c of state.clubs) { const f = state.finance[c.id]; console.log(c.id, 'stanje', f.balance, 'plače/mes', Object.values(state.players).filter(p=>p.clubId===c.id).reduce((s,p)=>s+p.wage,0), 'proračun', f.wageBudget, 'kader', Object.values(state.players).filter(p=>p.clubId===c.id).length); }
const att = state.fixtures.filter(f=>f.result).map(f=>[f.home, f.result!.attendance] as const);
const byClub: Record<string, number[]> = {}; att.forEach(([h,a])=>(byClub[h]=byClub[h]??[]).push(a));
console.log('Povp. obisk:', Object.entries(byClub).map(([k,v])=>`${k} ${Math.round(v.reduce((a,b)=>a+b,0)/v.length)}`).join(', '));
console.log('Prostih igralcev:', Object.values(state.players).filter(p=>p.clubId===null).length);
console.log('Odločitev v slačilnici:', decisionsSeen, 'zgodovina sezon:', state.seasonRecords?.length, 'legende:', state.legends?.length, 'navijači', state.fans, 'uprava', state.board);
console.log('Novice mediji:', state.news.filter(n=>n.kind==='mediji').length, state.news.filter(n=>n.kind==='mediji').slice(0,4).map(n=>n.title));
