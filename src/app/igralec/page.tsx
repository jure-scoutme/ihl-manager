'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BackLink, Crest, INTEREST_STYLE, POS_FULL, Portrait, Shell, attrColor, eur, ovrColor } from '@/components/ui';
import { clubWages, interestIn, offerContract, releasePlayer } from '@/engine/finance';
import { useGame } from '@/store/game';
import { ATTR_GROUPS, ATTR_LABELS, GOALIE_GROUP, ageOf } from '@/engine/players';
import { seasonLabel } from '@/engine/season';

function Profil() {
  const game = useGame((s) => s.game)!;
  const update = useGame((s) => s.update);
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const from = params.get('from');
  const [wage, setWage] = useState<number | null>(null);
  const [years, setYears] = useState(2);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);
  if (!game) return null;
  const p = game.players[id];
  const back = from === 'prestopi' ? { href: '/prestopi', label: 'Prosti igralci' } : from === 'liga' ? { href: '/liga', label: 'Liga' } : { href: '/kader', label: 'Kader' };
  if (!p) return <div className="page"><BackLink href={back.href} label={back.label} /><p>Igralec ne obstaja več.</p></div>;
  const isMine = p.clubId === game.userClubId;
  const isFree = p.clubId === null;
  const offerWage = wage ?? p.wage;
  const fin = game.finance?.[game.userClubId];
  const room = fin ? fin.wageBudget - clubWages(game, game.userClubId) : 0;
  const club = game.clubs.find((c) => c.id === p.clubId);
  const groups = p.pos === 'G' ? [GOALIE_GROUP, { label: 'Mentalni', keys: ['decisions', 'positioning', 'leadership'] as (keyof typeof p.attrs)[] }] : ATTR_GROUPS;
  const s = p.stats;
  const isG = p.pos === 'G';
  const statCells: [string, string | number][] = isG
    ? [['Tekme', s.gp], ['Zmage', s.w], ['% obramb', s.sa ? ((s.sa - s.ga) / s.sa * 100).toFixed(1) : '—'], ['GAA', s.gp ? (s.ga / s.gp).toFixed(2) : '—'], ['Ničle', s.so]]
    : [['Tekme', s.gp], ['Goli', s.g], ['Podaje', s.a], ['+/-', s.pm > 0 ? `+${s.pm}` : s.pm], ['KM', s.pim]];

  return (
    <div className="page">
      <BackLink href={back.href} label={back.label} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Portrait player={p} />
        <div style={{ flex: 1 }}>
          <div className="h" style={{ fontSize: 28, lineHeight: 1 }}>{p.first} {p.last}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{POS_FULL[p.pos]} · {ageOf(p, game.seasonYear)} let · {p.nat} · strel {p.shoots}</div>
          <div className="muted" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>{club && <Crest club={club} size={18} />}{club?.short ?? 'Prost igralec'} · #{p.number} · {isFree ? `zahteva ${p.wage} €/mes` : `pogodba do ${p.contractUntil} · ${p.wage} €/mes`}{p.isAI ? ' · AI' : ''}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="h" style={{ fontSize: 38, lineHeight: 1, color: ovrColor(p.ovr) }}>{p.ovr}</div>
          <div className="muted" style={{ fontSize: 11 }}>POT {p.potential}</div>
        </div>
      </div>

      {p.injuryDays > 0 && <div className="card" style={{ color: 'var(--bad)', fontSize: 13 }}>Poškodovan še {p.injuryDays} dni.</div>}

      {isFree && fin && (
        <section className="card" style={{ borderColor: 'var(--accent)' }}>
          <div className="row"><span className="lbl">Ponudi pogodbo</span>{(() => { const st = INTEREST_STYLE[interestIn(game, p, game.userClubId)]; return <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 9, background: st.bg, color: st.fg }}>{st.label}</span>; })()}</div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn sec" style={{ width: 52 }} onClick={() => setWage(Math.max(100, offerWage - 50))} aria-label="Manj">−</button>
            <span style={{ textAlign: 'center' }}><span className="h" style={{ fontSize: 28 }}>{eur(offerWage)}</span><br /><span className="muted" style={{ fontSize: 11 }}>na mesec · zahteva {eur(p.wage)}</span></span>
            <button className="btn sec" style={{ width: 52 }} onClick={() => setWage(offerWage + 50)} aria-label="Več">+</button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {[1, 2, 3].map((y) => <button key={y} className={`chip ${years === y ? 'on' : ''}`} style={{ flex: 1 }} onClick={() => setYears(y)}>{y} {y === 1 ? 'leto' : y === 2 ? 'leti' : 'leta'}</button>)}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Prostor v proračunu za plače: <b style={{ color: room - offerWage < 0 ? 'var(--bad)' : 'var(--text)' }}>{eur(room)}</b></div>
          <button className="btn block" style={{ marginTop: 10 }} onClick={() => update((g) => { const r = offerContract(g, p.id, offerWage, years); setMsg({ ok: r.accepted, text: r.text }); setWage(null); })}>Pošlji ponudbo</button>
        </section>
      )}

      {isMine && (
        <section className="card">
          {!confirmRelease ? (
            <button className="btn ghost block" onClick={() => setConfirmRelease(true)}>Odpusti igralca</button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 13, margin: 0, color: 'var(--gold)' }}>Odpravnina: {eur(p.wage * 2)}. Igralec postane prost in ga lahko podpiše drug klub.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn sec" style={{ flex: 1 }} onClick={() => setConfirmRelease(false)}>Prekliči</button>
                <button className="btn" style={{ flex: 1 }} onClick={() => update((g) => { const r = releasePlayer(g, p.id); setMsg({ ok: r.ok, text: r.text }); setConfirmRelease(false); })}>Odpusti</button>
              </div>
            </div>
          )}
        </section>
      )}

      {msg && <div className="card" style={{ fontSize: 13, color: msg.ok ? 'var(--good)' : 'var(--gold)' }}>{msg.text}</div>}

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
