'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BackLink, POS_FULL, Shell, attrColor, ovrColor } from '@/components/ui';
import { useGame } from '@/store/game';
import { ATTR_GROUPS, ATTR_LABELS, GOALIE_GROUP, ageOf } from '@/engine/players';
import { seasonLabel } from '@/engine/season';

function Profil() {
  const game = useGame((s) => s.game)!;
  const id = useSearchParams().get('id') ?? '';
  if (!game) return null;
  const p = game.players[id];
  if (!p) return <div className="page"><BackLink href="/kader" label="Kader" /><p>Igralec ne obstaja več.</p></div>;
  const club = game.clubs.find((c) => c.id === p.clubId);
  const groups = p.pos === 'G' ? [GOALIE_GROUP, { label: 'Mentalni', keys: ['decisions', 'positioning', 'leadership'] as (keyof typeof p.attrs)[] }] : ATTR_GROUPS;
  const s = p.stats;
  const isG = p.pos === 'G';
  const statCells: [string, string | number][] = isG
    ? [['Tekme', s.gp], ['Zmage', s.w], ['% obramb', s.sa ? ((s.sa - s.ga) / s.sa * 100).toFixed(1) : '—'], ['GAA', s.gp ? (s.ga / s.gp).toFixed(2) : '—'], ['Ničle', s.so]]
    : [['Tekme', s.gp], ['Goli', s.g], ['Podaje', s.a], ['+/-', s.pm > 0 ? `+${s.pm}` : s.pm], ['KM', s.pim]];

  return (
    <div className="page">
      <BackLink href="/kader" label="Kader" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="h" style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, color: 'var(--accent)' }}>{p.number}</div>
        <div style={{ flex: 1 }}>
          <div className="h" style={{ fontSize: 28, lineHeight: 1 }}>{p.first} {p.last}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{POS_FULL[p.pos]} · {ageOf(p, game.seasonYear)} let · {p.nat} · strel {p.shoots}</div>
          <div className="muted" style={{ fontSize: 12 }}>{club?.short ?? 'Prost'} · pogodba do {p.contractUntil} · {p.wage} €/mes{p.isAI ? ' · AI' : ''}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="h" style={{ fontSize: 38, lineHeight: 1, color: ovrColor(p.ovr) }}>{p.ovr}</div>
          <div className="muted" style={{ fontSize: 11 }}>POT {p.potential}</div>
        </div>
      </div>

      {p.injuryDays > 0 && <div className="card" style={{ color: 'var(--bad)', fontSize: 13 }}>Poškodovan še {p.injuryDays} dni.</div>}

      <section className="card" style={{ display: 'flex', padding: '10px 6px' }}>
        {statCells.map(([l, v]) => (
          <div key={l} style={{ flex: 1, textAlign: 'center' }}>
            <div className="h" style={{ fontSize: 22 }}>{v}</div>
            <div className="lbl" style={{ fontSize: 10 }}>{l}</div>
          </div>
        ))}
      </section>

      <section className="card">
        {groups.map((g, gi) => (
          <div key={g.label} style={{ marginTop: gi ? 10 : 0 }}>
            <div className="lbl" style={{ marginBottom: 6 }}>{g.label}</div>
            {g.keys.map((k) => {
              const v = p.attrs[k];
              return (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 24px', gap: 10, alignItems: 'center', height: 22, fontSize: 13 }}>
                  <span>{ATTR_LABELS[k]}</span>
                  <div className="bar"><div style={{ width: `${(v / 20) * 100}%`, background: attrColor(v) }} /></div>
                  <span style={{ fontWeight: 700, textAlign: 'right' }}>{v}</span>
                </div>
              );
            })}
          </div>
        ))}
      </section>

      <section className="card" style={{ fontSize: 13 }}>
        <div className="lbl" style={{ marginBottom: 6 }}>Stanje</div>
        <div className="row"><span className="muted">Morala</span><span>{p.morale} %</span></div>
        <div className="row"><span className="muted">Svežina</span><span>{Math.round(p.energy)} %</span></div>
        <div className="row"><span className="muted">Forma</span><span>{p.form > 0 ? '+' : ''}{p.form}</span></div>
      </section>

      {p.history.length > 0 && (
        <section className="card" style={{ padding: '10px 6px' }}>
          <div className="lbl" style={{ padding: '0 6px 4px' }}>Kariera</div>
          <table className="t">
            <thead><tr><th>Sezona</th><th>Klub</th><th className="num">T</th>{isG ? <><th className="num">%</th><th className="num">GAA</th></> : <><th className="num">G</th><th className="num">P</th><th className="num">Tč</th></>}</tr></thead>
            <tbody>
              {[...p.history].reverse().map((h) => (
                <tr key={h.season}>
                  <td>{h.season}</td>
                  <td>{game.clubs.find((c) => c.id === h.clubId)?.short}</td>
                  <td className="num">{h.stats.gp}</td>
                  {isG ? (
                    <><td className="num">{h.stats.sa ? (((h.stats.sa - h.stats.ga) / h.stats.sa) * 100).toFixed(1) : '—'}</td><td className="num">{h.stats.gp ? (h.stats.ga / h.stats.gp).toFixed(2) : '—'}</td></>
                  ) : (
                    <><td className="num">{h.stats.g}</td><td className="num">{h.stats.a}</td><td className="num">{h.stats.g + h.stats.a}</td></>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <p className="muted" style={{ fontSize: 11, margin: 0 }}>Sezona {seasonLabel(game.seasonYear)}</p>
    </div>
  );
}

export default function IgralecPage() {
  return (
    <Shell>
      <Suspense fallback={null}>
        <Profil />
      </Suspense>
    </Shell>
  );
}
