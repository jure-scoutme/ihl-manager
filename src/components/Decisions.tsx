'use client';
import { useState } from 'react';
import { useGame } from '@/store/game';
import { useT } from '@/i18n';

export function Decisions() {
  const game = useGame((s) => s.game)!;
  const resolve = useGame((s) => s.resolve);
  const t = useT();
  const [result, setResult] = useState<string | null>(null);
  const list = game?.decisions ?? [];
  if (!list.length && !result) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {result && (
        <div className="card row" style={{ fontSize: 13, borderColor: 'var(--accent)' }}>
          <span>{result}</span>
          <button className="chip" onClick={() => setResult(null)}>OK</button>
        </div>
      )}
      {list.map((d) => (
        <section key={d.id} className="card" style={{ borderColor: d.blocking ? 'var(--gold)' : 'var(--line2)' }}>
          <div className="row">
            <span className="lbl" style={{ color: d.blocking ? 'var(--gold)' : undefined }}>{t(d.kind === 'konferenca' ? 'Mediji' : d.kind === 'garderoba' ? 'Slačilnica' : 'Uprava')}{d.blocking ? ` · ${t('zahteva odločitev')}` : ''}</span>
          </div>
          <div className="h" style={{ fontSize: 20, margin: '6px 0 4px' }}>{d.title}</div>
          <p style={{ fontSize: 13, lineHeight: 1.5, margin: '0 0 10px' }}>{d.body}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {d.options.map((o, i) => (
              <button key={i} className="btn sec" style={{ textAlign: 'left', height: 'auto', minHeight: 44, padding: '10px 14px', lineHeight: 1.35 }} onClick={() => setResult(resolve(d.id, i) || 'Odločitev sprejeta.')}>
                {o.label}
              </button>
            ))}
            {d.kind === 'konferenca' && (
              <button className="btn ghost" style={{ height: 40, fontSize: 13 }} onClick={() => { useGame.getState().update((g) => { g.decisions = (g.decisions ?? []).filter((x) => x.id !== d.id); }); setResult('Na konferenco si poslal pomočnika.'); }}>
                {t('Pošlji pomočnika')}
              </button>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
