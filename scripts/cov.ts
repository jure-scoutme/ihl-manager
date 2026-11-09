import { resolveDecision } from '../src/engine/events';
import { createGame, advanceDay, quickSim, userFixtureToday } from '../src/engine/season';
import { translate } from '../src/i18n/index';
const state: any = createGame({ first: 'Test', last: 'Manager', nat: 'SLO', age: 40, background: 'igralec', style: 'uravnotezen', reputation: 50 } as any, 'tri', 777);
const texts = new Set<string>();
let guard = 0;
while (state.phase !== 'konec' && guard++ < 400) {
  const uf = userFixtureToday(state);
  if (uf) quickSim(state, uf);
  for (const d of state.decisions ?? []) { texts.add(d.title); texts.add(d.body); for (const o of d.options) texts.add(o.label); }
  while ((state.decisions ?? []).some((d: any) => d.blocking)) { const d = state.decisions.find((x: any) => x.blocking); texts.add(resolveDecision(state, d.id, guard % 2)); }
  advanceDay(state);
}
for (const n of state.news ?? []) { texts.add(n.title); for (const p of String(n.body).split(/\n\n+/)) texts.add(p); }
for (const l of ['en', 'sr'] as const) {
  let miss = 0; const ex: string[] = [];
  for (const t of texts) { if (!t) continue; const r = translate(l, t); if (r === t) { miss++; if (ex.length < 25) ex.push(t.slice(0, 110)); } }
  console.log(l, 'total', texts.size, 'untranslated', miss); console.log(ex.join('\n'));
}
const arr = [...texts].filter(Boolean);
for (let i = 0; i < 6; i++) { const t = arr[i * 7 % arr.length]; console.log('---\n' + t + '\n' + translate('sr', t) + '\n' + translate('en', t)); }
