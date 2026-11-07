'use client';
import Link from 'next/link';
import { useState } from 'react';
import { BackLink, Crest, Shell } from '@/components/ui';
import { useGame } from '@/store/game';
import { fmtDate } from '@/engine/season';

const MONTHS = ['Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij', 'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'];
const WD = ['pon', 'tor', 'sre', 'čet', 'pet', 'sob', 'ned'];

export default function Koledar() {
  const game = useGame((s) => s.game)!;
  const simulateUntil = useGame((s) => s.simulateUntil);
  const [month, setMonth] = useState(() => (game ? game.date.slice(0, 7) : '2026-09'));
  const [sel, setSel] = useState<string | null>(null);
  const [autoUser, setAutoUser] = useState(true);
  const [msg, setMsg] = useState('');
  if (!game) return <Shell>{null}</Shell>;
  const clubOf = (id: string) => game.clubs.find((c) => c.id === id)!;
  const me = game.userClubId;

  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const firstDow = (new Date(first + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysIn }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  while (cells.length % 7) cells.push(null);
  const shift = (d: number) => {
    const dt = new Date(Date.UTC(y, m - 1 + d, 1));
    setMonth(dt.toISOString().slice(0, 7));
    setSel(null);
  };

  const byDate: Record<string, typeof game.fixtures> = {};
  for (const f of game.fixtures) (byDate[f.date] = byDate[f.date] ?? []).push(f);
  const selFixtures = sel ? byDate[sel] ?? [] : [];
  const stage: Record<string, string> = { cetrtfinale: 'ČF', polfinale: 'PF', finale: 'F' };

  const doSim = () => {
    if (!sel) return;
    const r = simulateUntil(sel, autoUser);
    if (r.reached) setMsg(`Simulirano do ${fmtDate(sel)}.`);
    else if (r.stoppedFor === 'tekma') setMsg('Ustavljeno: danes igra tvoja ekipa.');
    else if (r.stoppedFor === 'konec') setMsg('Sezona je končana.');
  };

  return (
    <Shell>
      <div className="page">
        <BackLink href="/domov" label="Domov" />
        <div className="row">
          <h1 className="h title">Koledar</h1>
          <span className="muted" style={{ fontSize: 12 }}>Danes: {fmtDate(game.date)}</span>
        </div>
        <div className="row">
          <button className="chip" onClick={() => shift(-1)} aria-label="Prejšnji mesec">‹</button>
          <span className="h" style={{ fontSize: 20 }}>{MONTHS[m - 1]} {y}</span>
          <button className="chip" onClick={() => shift(1)} aria-label="Naslednji mesec">›</button>
        </div>
        <div className="card" style={{ padding: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {WD.map((d) => <div key={d} className="lbl" style={{ textAlign: 'center', fontSize: 10, padding: '4px 0' }}>{d}</div>)}
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const fx = byDate[d] ?? [];
              const mine = fx.find((f) => f.home === me || f.away === me);
              const isToday = d === game.date;
              const past = d < game.date;
              let label = '';
              let color = 'var(--muted)';
              if (mine) {
                const opp = clubOf(mine.home === me ? mine.away : mine.home);
                label = `${mine.home === me ? '' : '@'}${opp.id.toUpperCase()}`;
                color = 'var(--text)';
                if (mine.result) {
                  const us = mine.home === me;
                  const won = us ? mine.result.hg > mine.result.ag : mine.result.ag > mine.result.hg;
                  color = won ? 'var(--good)' : 'var(--bad)';
                  label = `${us ? mine.result.hg : mine.result.ag}:${us ? mine.result.ag : mine.result.hg}`;
                }
              }
              return (
                <button
                  key={d}
                  onClick={() => { setSel(d); setMsg(''); }}
                  style={{
                    minHeight: 54, borderRadius: 8, padding: '4px 2px', cursor: 'pointer', textAlign: 'center',
                    background: mine ? (mine.home === me ? '#15283d' : '#1a2236') : 'transparent',
                    border: `1px solid ${sel === d ? 'var(--accent)' : isToday ? 'var(--gold)' : 'var(--line)'}`,
                    color: past ? 'var(--muted)' : 'var(--text)', fontFamily: 'Inter, sans-serif',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 600, color: isToday ? 'var(--gold)' : undefined }}>{Number(d.slice(8))}</div>
                  {mine && <div style={{ fontSize: 10, fontWeight: 700, color, marginTop: 2 }}>{label}</div>}
                  {mine && stage[mine.stage] && <div style={{ fontSize: 9, color: 'var(--gold)' }}>{stage[mine.stage]}</div>}
                  {!mine && fx.length > 0 && <div style={{ width: 4, height: 4, borderRadius: 2, background: 'var(--muted)', margin: '6px auto 0' }} />}
                </button>
              );
            })}
          </div>
        </div>
        <div className="muted" style={{ fontSize: 11, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span><span className="dot" style={{ background: '#15283d', border: '1px solid var(--line2)' }} /> doma</span>
          <span>@ v gosteh</span>
          <span><span className="dot" style={{ background: 'var(--muted)', width: 5, height: 5 }} /> druge tekme</span>
          <span style={{ color: 'var(--gold)' }}>□ danes</span>
        </div>

        {sel && (
          <section className="card">
            <div className="lbl" style={{ marginBottom: 8 }}>{fmtDate(sel)}</div>
            {selFixtures.length === 0 && <p className="muted" style={{ fontSize: 13, margin: '0 0 8px' }}>Ta dan ni tekem.</p>}
            {selFixtures.map((f) => (
              <div key={f.id} className="row" style={{ padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 13 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, fontWeight: f.home === me ? 700 : 500 }}><Crest club={clubOf(f.home)} size={24} />{clubOf(f.home).short}</span>
                {f.result ? (
                  <Link href={`/porocilo?id=${f.id}`} className="h" style={{ fontSize: 18, color: 'var(--accent)' }}>{f.result.hg}:{f.result.ag}{f.result.so ? 'k' : f.result.ot ? 'p' : ''}</Link>
                ) : (
                  <span className="muted">–</span>
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end', fontWeight: f.away === me ? 700 : 500 }}>{clubOf(f.away).short}<Crest club={clubOf(f.away)} size={24} /></span>
              </div>
            ))}
            {sel > game.date && game.phase !== 'konec' && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={autoUser} onChange={(e) => setAutoUser(e.target.checked)} style={{ width: 18, height: 18 }} />
                  Moje tekme odigraj s hitro simulacijo
                </label>
                <button className="btn block" onClick={doSim}>Simuliraj do {fmtDate(sel)}</button>
                <span className="muted" style={{ fontSize: 11 }}>Igra se ustavi zjutraj na izbrani dan, tako da tekme tega dne še lahko odigraš.</span>
              </div>
            )}
            {msg && <p style={{ fontSize: 13, color: 'var(--accent)', margin: '10px 0 0' }}>{msg}</p>}
          </section>
        )}
      </div>
    </Shell>
  );
}
