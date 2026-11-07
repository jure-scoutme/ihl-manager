'use client';
import { useState } from 'react';
import { useGame } from '@/store/game';
import { useT } from '@/i18n';

const STEPS: { icon: string; title: string; text: string }[] = [
  { icon: '👋', title: 'Dobrodošel, trener!', text: 'Vodiš klub v ligi IHL. Igra teče po dnevih: tekme, treningi, prestopi in odločitve uprave. Ta kratek uvod ti pokaže osnove.' },
  { icon: '▶️', title: 'Nadaljuj', text: 'Z gumbom Nadaljuj na dnu zaslona greš naprej po koledarju. Igra se ustavi, ko je na sporedu tvoja tekma ali ko te čaka pomembna novica ali odločitev.' },
  { icon: '🏒', title: 'Tekma', text: 'Na dan tekme jo lahko igraš v živo (menjaš taktiko, vzameš time-out, umakneš golmana) ali jo hitro odsimuliraš. Po tekmi si oglej poročilo.' },
  { icon: '📋', title: 'Kader, postave in trening', text: 'V zavihku Kader sestaviš napade in pare, izbereš kapetana, določiš tedenski trening in podaljšuješ pogodbe. Uigrani napadi igrajo bolje.' },
  { icon: '🔁', title: 'Prestopi', text: 'Proste igralce podpišeš kadarkoli. Igralce drugih klubov in iz tujine kupuješ v prestopnem roku (poleti in decembra–januarja). Tudi svoje igralce lahko ponudiš klubom.' },
  { icon: '🏟️', title: 'Klub', text: 'V zavihku Klub so finance, vstopnice, strokovni štab, infrastruktura, zgodovina in nastavitve. Pazi na zaupanje uprave, sicer lahko izgubiš službo. Srečno!' },
];

export function Tutorial() {
  const game = useGame((s) => s.game);
  const update = useGame((s) => s.update);
  const t = useT();
  const [i, setI] = useState(0);
  if (!game || game.tutorialDone) return null;
  const s = STEPS[i];
  const done = () => update((g) => { g.tutorialDone = true; });
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,10,20,.72)', zIndex: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 440, margin: 0, padding: 20, animation: 'rise .3s ease both' }}>
        <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
          {STEPS.map((_, k) => <div key={k} style={{ flex: 1, height: 4, borderRadius: 2, background: k <= i ? 'var(--accent)' : 'rgba(255,255,255,.12)' }} />)}
        </div>
        <div style={{ fontSize: 36 }}>{s.icon}</div>
        <div className="h" style={{ fontSize: 22, margin: '6px 0 6px' }}>{t(s.title)}</div>
        <p style={{ fontSize: 14, lineHeight: 1.55, margin: '0 0 16px', color: '#d6deec' }}>{t(s.text)}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost" style={{ flex: 1 }} onClick={done}>{t('Preskoči')}</button>
          {i > 0 && <button className="btn sec" style={{ flex: 1 }} onClick={() => setI(i - 1)}>{t('Nazaj')}</button>}
          <button className="btn" style={{ flex: 1.4 }} onClick={() => (i + 1 < STEPS.length ? setI(i + 1) : done())}>{i + 1 < STEPS.length ? t('Naprej') : t('Začni')}</button>
        </div>
      </div>
    </div>
  );
}
