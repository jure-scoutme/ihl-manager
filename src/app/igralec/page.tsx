'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BackLink, Crest, INTEREST_STYLE, POS_FULL, Portrait, Shell, attrColor, eur, heroBg, ovrColor } from '@/components/ui';
import { clubWages, interestIn, offerContract, releasePlayer } from '@/engine/finance';
import { PERSONALITY_INFO } from '@/engine/club';
import { demote, promote } from '@/engine/youth';
import { cancelTransfer, offerToClub, offerTransferContract, transferValue, transferWageDemand } from '@/engine/transfers';
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
  const [fee, setFee] = useState<number | null>(null);
  if (!game) return null;
  const p = game.players[id] ?? game.youth?.[id];
  const isYouth = !!game.youth?.[id];
  const back = from === 'prestopi' ? { href: '/prestopi', label: 'Prosti igralci' } : from === 'liga' ? { href: '/liga', label: 'Liga' } : from === 'mladinci' ? { href: '/mladinci', label: 'Mladinska šola' } : from === 'ekipa' ? { href: `/ekipa?id=${params.get('club')}`, label: 'Ekipa' } : { href: '/kader', label: 'Kader' };
  if (!p) return <div className="page"><BackLink href={back.href} label={back.label} /><p>Igralec ne obstaja več.</p></div>;
  const isMine = p.clubId === game.userClubId && !isYouth;
  const isFree = p.clubId === null;
  const offerWage = wage ?? p.wage;
  const fin = game.finance?.[game.userClubId];
  const room = fin ? fin.wageBudget - clubWages(game, game.userClubId) : 0;
  const isOther = !!p.clubId && p.clubId !== game.userClubId && !isYouth;
  const agreed = game.agreedFees?.[p.id];
  const value = isOther ? transferValue(game, p) : 0;
  const offerFee = fee ?? value;
  const tWage = wage ?? (isOther ? transferWageDemand(game, p) : p.wage);
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
      <section className="hero" style={{ background: heroBg(club?.color ?? '#4f8cff') }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Portrait player={p} size={72} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, opacity: 0.8, fontWeight: 600 }}>{p.first}</div>
            <div className="h" style={{ fontSize: 26, lineHeight: 1.05 }}>{p.last}</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{POS_FULL[p.pos]} · {ageOf(p, game.seasonYear)} let · {p.nat}</div>
          </div>
          <div style={{ textAlign: 'center', background: 'rgba(0,0,0,.25)', borderRadius: 16, padding: '8px 10px' }}>
            <div className="score" style={{ fontSize: 36, lineHeight: 1, color: ovrColor(p.ovr) }}>{p.ovr}</div>
            <div style={{ fontSize: 10, opacity: 0.8, fontWeight: 700 }}>POT {p.potential}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 12, flexWrap: 'wrap' }}>
          {club && <span className="pill" style={{ background: 'rgba(255,255,255,.16)', height: 26 }}><Crest club={club} size={18} /> {club.short}</span>}
          {!club && <span className="pill" style={{ background: 'rgba(255,255,255,.16)', height: 26 }}>Prost igralec</span>}
          <span className="pill" style={{ background: 'rgba(255,255,255,.16)', height: 26 }}>#{p.number}</span>
          <span className="pill" style={{ background: 'rgba(255,255,255,.16)', height: 26 }}>Strel {p.shoots}</span>
          <span className="pill" style={{ background: 'rgba(255,255,255,.16)', height: 26 }}>{isFree ? `zahteva ${p.wage} €/mes` : `${p.wage} €/mes · do ${p.contractUntil}`}</span>
          {p.isAI && <span className="pill" style={{ background: 'rgba(255,255,255,.16)', height: 26 }}>AI</span>}
        </div>
      </section>

      {p.injuryDays > 0 && <div className="card" style={{ color: 'var(--bad)', fontSize: 13 }}>Poškodovan še {p.injuryDays} dni.</div>}

      {isOther && fin && agreed === undefined && (
        <section className="card" style={{ borderColor: 'var(--accent)' }}>
          <div className="row"><span className="lbl">Ponudba klubu {club?.short}</span><span className="muted" style={{ fontSize: 12 }}>vrednost ~{eur(value)}</span></div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn sec" style={{ width: 52 }} onClick={() => setFee(Math.max(500, offerFee - 1000))} aria-label="Manj">−</button>
            <span style={{ textAlign: 'center' }}><span className="score" style={{ fontSize: 30 }}>{eur(offerFee)}</span><br /><span className="muted" style={{ fontSize: 11 }}>odškodnina</span></span>
            <button className="btn sec" style={{ width: 52 }} onClick={() => setFee(offerFee + 1000)} aria-label="Več">+</button>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Na računu: <b style={{ color: fin.balance < offerFee ? 'var(--bad)' : 'var(--text)' }}>{eur(fin.balance)}</b>{p.listed ? ' · igralec je na prodaj' : ''}</div>
          <button className="btn block" style={{ marginTop: 10 }} onClick={() => update((g) => { const r = offerToClub(g, p.id, offerFee); setMsg({ ok: r.status === 'sprejeto', text: r.text }); if (r.status === 'protiponudba' && r.fee) setFee(r.fee); })}>Pošlji ponudbo klubu</button>
        </section>
      )}

      {isOther && fin && agreed !== undefined && (
        <section className="card" style={{ borderColor: 'var(--good)' }}>
          <div className="row"><span className="lbl">Pogodba z igralcem</span><span style={{ fontSize: 12, color: 'var(--good)', fontWeight: 600 }}>odškodnina {eur(agreed)} dogovorjena</span></div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn sec" style={{ width: 52 }} onClick={() => setWage(Math.max(100, tWage - 50))} aria-label="Manj">−</button>
            <span style={{ textAlign: 'center' }}><span className="score" style={{ fontSize: 30 }}>{eur(tWage)}</span><br /><span className="muted" style={{ fontSize: 11 }}>na mesec · zdaj ima {eur(p.wage)}</span></span>
            <button className="btn sec" style={{ width: 52 }} onClick={() => setWage(tWage + 50)} aria-label="Več">+</button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {[1, 2, 3].map((y) => <button key={y} className={`chip ${years === y ? 'on' : ''}`} style={{ flex: 1 }} onClick={() => setYears(y)}>{y} {y === 1 ? 'leto' : y === 2 ? 'leti' : 'leta'}</button>)}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Prostor v proračunu za plače: <b style={{ color: room - tWage < 0 ? 'var(--bad)' : 'var(--text)' }}>{eur(room)}</b></div>
          <button className="btn block" style={{ marginTop: 10 }} onClick={() => update((g) => { const r = offerTransferContract(g, p.id, tWage, years); setMsg({ ok: r.accepted, text: r.text }); setWage(null); })}>Ponudi pogodbo igralcu</button>
          <button className="btn ghost block" style={{ marginTop: 8, height: 44 }} onClick={() => update((g) => { cancelTransfer(g, p.id); setMsg({ ok: false, text: 'Prestop je preklican.' }); })}>Prekliči prestop</button>
        </section>
      )}

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

      {msg && <div className="card" style={{ fontSize: 13, color: msg.ok ? 'var(--good)' : 'var(--gold)' }}>{msg.text}</div>}

      <section className="card" style={{ display: 'flex', padding: '10px 6px' }}>
        {statCells.map(([l, v]) => (
          <div key={l} style={{ flex: 1, textAlign: 'center' }}>
            <div className="score" style={{ fontSize: 26 }}>{v}</div>
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
        {p.personality && <div className="row"><span className="muted">Osebnost</span><span>{PERSONALITY_INFO[p.personality].label}</span></div>}
        {p.personality && <div className="muted" style={{ fontSize: 12, textAlign: 'right' }}>{PERSONALITY_INFO[p.personality].desc}</div>}
        {p.mentorId && game.players[p.mentorId] && <div className="row"><span className="muted">Mentor</span><span>{game.players[p.mentorId].first} {game.players[p.mentorId].last}</span></div>}
        {p.listed && <div className="row"><span className="muted">Status</span><span style={{ color: 'var(--gold)' }}>na seznamu za prodajo</span></div>}
      </section>

      {isYouth && p.clubId === game.userClubId && (
        <section className="card" style={{ borderColor: 'var(--accent)' }}>
          <div className="lbl" style={{ marginBottom: 6 }}>Mladinska šola · {p.youth}</div>
          <p className="muted" style={{ fontSize: 13, margin: '0 0 10px' }}>Potencial: {p.potential >= 76 ? 'izjemen' : p.potential >= 69 ? 'visok' : p.potential >= 62 ? 'srednji' : 'nizek'}. Statistika zgoraj je iz mladinske lige.</p>
          <button className="btn block" onClick={() => update((g) => setMsg(promote(g, p.id)))}>Pokliči v člansko ekipo</button>
        </section>
      )}

      {isMine && game.seasonYear - p.birthYear <= 20 && (
        <button className="btn ghost block" onClick={() => update((g) => { const r = demote(g, p.id); setMsg(r); })}>Pošlji v mladinsko ekipo</button>
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
