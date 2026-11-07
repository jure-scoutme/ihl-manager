'use client';
import Link from 'next/link';
import { useState } from 'react';
import { POS_LABEL, Shell, formColor, ovrColor } from '@/components/ui';
import { useGame } from '@/store/game';
import { ageOf } from '@/engine/players';
import { clubPlayers } from '@/engine/season';

type Tab = 'F' | 'D' | 'G';

export default function Kader() {
  const game = useGame((s) => s.game)!;
  const [tab, setTab] = useState<Tab>('F');
  if (!game) return <Shell>{null}</Shell>;
  const roster = clubPlayers(game, game.userClubId);
  const list = roster
    .filter((p) => (tab === 'F' ? ['C', 'LW', 'RW'].includes(p.pos) : p.pos === tab))
    .sort((a, b) => b.ovr - a.ovr);
  const avg = Math.round(roster.reduce((s, p) => s + p.ovr, 0) / roster.length);
  const wages = roster.reduce((s, p) => s + p.wage, 0);

  return (
    <Shell>
      <header style={{ padding: '18px 16px 0' }} className="row">
        <div>
          <h1 className="h title">Kader</h1>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{roster.length} igralcev · povp. ocena {avg} · plače {wages.toLocaleString('sl-SI')} €/mes</div>
        </div>
        <Link href="/postave" className="btn sec" style={{ display: 'flex', alignItems: 'center' }}>Postave</Link>
      </header>
      <div className="page">
        <div className="seg">
          {([['F', 'Napadalci'], ['D', 'Branilci'], ['G', 'Golmani']] as const).map(([k, l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        <div className="card" style={{ padding: '0 6px' }}>
          <table className="t">
            <thead>
              <tr><th>#</th><th>Igralec</th><th>Poz</th><th className="num">Let</th><th className="num">{tab === 'G' ? '%' : 'T'}</th><th className="num">Ocena</th><th></th></tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const sv = p.stats.sa ? ((p.stats.sa - p.stats.ga) / p.stats.sa).toFixed(3).slice(1) : '—';
                return (
                  <tr key={p.id}>
                    <td className="muted">{p.number}</td>
                    <td>
                      <Link href={`/igralec?id=${p.id}`} style={{ fontWeight: 600 }}>{p.first[0]}. {p.last}</Link>
                      {p.injuryDays > 0 && <span style={{ color: 'var(--bad)', fontSize: 11 }}> poškodba</span>}
                      {p.potential - p.ovr >= 6 && <span style={{ color: 'var(--good)', fontSize: 11 }}> ▲</span>}
                    </td>
                    <td>{POS_LABEL[p.pos]}</td>
                    <td className="num">{ageOf(p, game.seasonYear)}</td>
                    <td className="num muted">{tab === 'G' ? sv : p.stats.g + p.stats.a}</td>
                    <td className="num ovr" style={{ color: ovrColor(p.ovr) }}>{p.ovr}</td>
                    <td style={{ width: 20 }}><span className="dot" style={{ background: p.injuryDays > 0 ? '#4a5a78' : formColor(p.form) }} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="muted" style={{ fontSize: 11, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <span><span className="dot" style={{ background: 'var(--good)' }} /> dobra forma</span>
          <span><span className="dot" style={{ background: 'var(--gold)' }} /> povprečna</span>
          <span><span className="dot" style={{ background: 'var(--orange)' }} /> slaba</span>
          <span><span style={{ color: 'var(--good)' }}>▲</span> velik potencial</span>
          <span>T = točke</span>
        </div>
      </div>
    </Shell>
  );
}
