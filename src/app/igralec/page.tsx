'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BackLink, Crest, INTEREST_STYLE, POS_FULL, Portrait, Shell, attrColor, eur, heroBg, ovrColor } from '@/components/ui';
import { clubWages, interestIn, offerContract, releasePlayer } from '@/engine/finance';
import { PERSONALITY_INFO } from '@/engine/club';
import { demote, promote } from '@/engine/youth';
import { cancelTransfer, offerToClub, offerTransferContract, transferValue, transferWageDemand } from '@/engine/transfers';
import { useGame } from '@/store/game';
import { useT } from '@/i18n';
import { ATTR_GROUPS, ATTR_LABELS, GOALIE_GROUP, ageOf } from '@/engine/players';
import { fmtDate, seasonLabel } from '@/engine/season';
import { expiring, offerRenewal, renewalAsk, transferWindow } from '@/engine/contracts';

function Profil() {
  const game = useGame((s) => s.game)!;
  const t = useT();
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
  if (!p) return <div className="page"><BackLink href={back.href} label={back.label} /><p>{t('Igralec ne obstaja več.')}</p></div>;
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
  const ask = isMine ? renewalAsk(game, p) : null;
  const rWage = wage ?? ask?.wage ?? p.wage;
  const win = transferWindow(game);
  const expSoon = isMine && expiring(game).some((x) => x.id === p.id);
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
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{t(POS_FULL[p.pos])} · {ageOf(p, game.seasonYear)} {t('let ·')} {p.nat}</div>
            {p.homegrown && <span className="pill" style={{ background: 'rgba(255,255,255,.16)', height: 24, marginTop: 6, fontSize: 11 }}>🎓 {t('Vzgojenec kluba')} {game.clubs.find((c) => c.id === p.homegrown)?.short ?? ''}</span>}
          </div>
          <div style={{ textAlign: 'center', background: 'rgba(0,0,0,.25)', borderRadius: 16, padding: '8px 10px' }}>
            <div className="score" style={{ fontSize: 36, lineHeight: 1, color: ovrColor(p.ovr) }}>{p.ovr}</div>
            <div style={{ fontSize: 10, opacity: 0.8, fontWeight: 700 }}>POT {p.potential}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 12, flexWrap: 'wrap' }}>
          {club && <span className="pill" style={{ background: 'rgba(255,255,255,.16)', height: 26 }}><Crest club={club} size={18} /> {club.short}</span>}
          {!club && <span className="pill" style={{ background: 'rgba(255,255,255,.16)', height: 26 }}>{t('Prost igralec')}</span>}
          <span className="pill" style={{ background: 'rgba(255,255,255,.16)', height: 26 }}>#{p.number}</span>
          <span className="pill" style={{ background: 'rgba(255,255,255,.16)', height: 26 }}>{t('Strel')} {p.shoots}</span>
          <span className="pill" style={{ background: 'rgba(255,255,255,.16)', height: 26 }}>{isFree ? t('zahteva {w} €/mes', { w: p.wage }) : t('{w} €/mes · do {y}', { w: p.wage, y: p.contractUntil })}</span>
          {p.isAI && <span className="pill" style={{ background: 'rgba(255,255,255,.16)', height: 26 }}>AI</span>}
        </div>
      </section>

      {(p.awayDays ?? 0) > 0 && <div className="card" style={{ color: 'var(--accent)', fontSize: 13 }}>🌍 {t('Pri reprezentanci še {n} dni.', { n: p.awayDays ?? 0 })}</div>}
      {p.injuryDays > 0 && <div className="card" style={{ color: 'var(--bad)', fontSize: 13 }}>{t('Poškodovan še')} {p.injuryDays} {t('dni.')}</div>}

      {isOther && fin && agreed === undefined && (
        <section className="card" style={{ borderColor: 'var(--accent)' }}>
          {!win.open && <div style={{ fontSize: 12, color: 'var(--gold)', marginBottom: 8 }}>{t(win.label)}. {t('Proste igralce lahko podpišeš kadarkoli.')}</div>}
          <div className="row"><span className="lbl">{t('Ponudba klubu')} {club?.short}</span><span className="muted" style={{ fontSize: 12 }}>{t('vrednost ~')}{eur(value)}</span></div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn sec" style={{ width: 52 }} onClick={() => setFee(Math.max(500, offerFee - 1000))} aria-label="Manj">−</button>
            <span style={{ textAlign: 'center' }}><span className="score" style={{ fontSize: 30 }}>{eur(offerFee)}</span><br /><span className="muted" style={{ fontSize: 11 }}>{t('odškodnina')}</span></span>
            <button className="btn sec" style={{ width: 52 }} onClick={() => setFee(offerFee + 1000)} aria-label="Več">+</button>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t('Na računu:')} <b style={{ color: fin.balance < offerFee ? 'var(--bad)' : 'var(--text)' }}>{eur(fin.balance)}</b>{p.listed ? ' · ' + t('igralec je na prodaj') : ''}</div>
          <button className="btn block" style={{ marginTop: 10 }} onClick={() => update((g) => { const r = offerToClub(g, p.id, offerFee); setMsg({ ok: r.status === 'sprejeto', text: r.text }); if (r.status === 'protiponudba' && r.fee) setFee(r.fee); })}>{t('Pošlji ponudbo klubu')}</button>
        </section>
      )}

      {isOther && fin && agreed !== undefined && (
        <section className="card" style={{ borderColor: 'var(--good)' }}>
          <div className="row"><span className="lbl">{t('Pogodba z igralcem')}</span><span style={{ fontSize: 12, color: 'var(--good)', fontWeight: 600 }}>{t('odškodnina')} {eur(agreed)} {t('dogovorjena')}</span></div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn sec" style={{ width: 52 }} onClick={() => setWage(Math.max(100, tWage - 50))} aria-label="Manj">−</button>
            <span style={{ textAlign: 'center' }}><span className="score" style={{ fontSize: 30 }}>{eur(tWage)}</span><br /><span className="muted" style={{ fontSize: 11 }}>{t('na mesec · zdaj ima')} {eur(p.wage)}</span></span>
            <button className="btn sec" style={{ width: 52 }} onClick={() => setWage(tWage + 50)} aria-label="Več">+</button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {[1, 2, 3].map((y) => <button key={y} className={`chip ${years === y ? 'on' : ''}`} style={{ flex: 1 }} onClick={() => setYears(y)}>{y} {t(y === 1 ? 'leto' : y === 2 ? 'leti' : 'leta')}</button>)}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t('Prostor v proračunu za plače:')} <b style={{ color: room - tWage < 0 ? 'var(--bad)' : 'var(--text)' }}>{eur(room)}</b></div>
          <button className="btn block" style={{ marginTop: 10 }} onClick={() => update((g) => { const r = offerTransferContract(g, p.id, tWage, years); setMsg({ ok: r.accepted, text: r.text }); setWage(null); })}>{t('Ponudi pogodbo igralcu')}</button>
          <button className="btn ghost block" style={{ marginTop: 8, height: 44 }} onClick={() => update((g) => { cancelTransfer(g, p.id); setMsg({ ok: false, text: 'Prestop je preklican.' }); })}>{t('Prekliči prestop')}</button>
        </section>
      )}

      {isFree && fin && (
        <section className="card" style={{ borderColor: 'var(--accent)' }}>
          <div className="row"><span className="lbl">{t('Ponudi pogodbo')}</span>{(() => { const st = INTEREST_STYLE[interestIn(game, p, game.userClubId)]; return <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 9, background: st.bg, color: st.fg }}>{t(st.label)}</span>; })()}</div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn sec" style={{ width: 52 }} onClick={() => setWage(Math.max(100, offerWage - 50))} aria-label="Manj">−</button>
            <span style={{ textAlign: 'center' }}><span className="h" style={{ fontSize: 28 }}>{eur(offerWage)}</span><br /><span className="muted" style={{ fontSize: 11 }}>{t('na mesec · zahteva')} {eur(p.wage)}</span></span>
            <button className="btn sec" style={{ width: 52 }} onClick={() => setWage(offerWage + 50)} aria-label="Več">+</button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {[1, 2, 3].map((y) => <button key={y} className={`chip ${years === y ? 'on' : ''}`} style={{ flex: 1 }} onClick={() => setYears(y)}>{y} {t(y === 1 ? 'leto' : y === 2 ? 'leti' : 'leta')}</button>)}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t('Prostor v proračunu za plače:')} <b style={{ color: room - offerWage < 0 ? 'var(--bad)' : 'var(--text)' }}>{eur(room)}</b></div>
          <button className="btn block" style={{ marginTop: 10 }} onClick={() => update((g) => { const r = offerContract(g, p.id, offerWage, years); setMsg({ ok: r.accepted, text: r.text }); setWage(null); })}>{t('Pošlji ponudbo')}</button>
        </section>
      )}

      {isMine && ask && fin && (
        <section className="card" style={{ borderColor: expSoon ? 'var(--gold)' : undefined }}>
          <div className="row"><span className="lbl">{t('Pogodba')}</span><span style={{ fontSize: 12, fontWeight: 600, color: expSoon ? 'var(--gold)' : 'var(--muted)' }}>{expSoon ? t('poteče 30. junija') : t('do {y}', { y: p.contractUntil })}</span></div>
          <p style={{ fontSize: 13, margin: '8px 0', lineHeight: 1.5 }}>{t(ask.reason)} {ask.willing && <span className="muted">{t('Zahteva: {w} €/mes za {n} sez.', { w: ask.wage, n: ask.years })}</span>}</p>
          {ask.willing && (
            <>
              <div className="row">
                <button className="btn sec" style={{ width: 52 }} onClick={() => setWage(Math.max(100, rWage - 50))} aria-label="Manj">−</button>
                <span style={{ textAlign: 'center' }}><span className="h" style={{ fontSize: 28 }}>{eur(rWage)}</span><br /><span className="muted" style={{ fontSize: 11 }}>{t('na mesec · zdaj ima')} {eur(p.wage)}</span></span>
                <button className="btn sec" style={{ width: 52 }} onClick={() => setWage(rWage + 50)} aria-label="Več">+</button>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                {[1, 2, 3].map((y) => <button key={y} className={`chip ${years === y ? 'on' : ''}`} style={{ flex: 1 }} onClick={() => setYears(y)}>+{y} {t(y === 1 ? 'leto' : y === 2 ? 'leti' : 'leta')}</button>)}
              </div>
              <button className="btn block" style={{ marginTop: 10 }} onClick={() => update((g) => { const r = offerRenewal(g, p.id, rWage, years); setMsg({ ok: r.ok, text: r.text }); setWage(null); })}>{t('Ponudi podaljšanje')}</button>
            </>
          )}
        </section>
      )}

      {msg && <div className="card" style={{ fontSize: 13, color: msg.ok ? 'var(--good)' : 'var(--gold)' }}>{t(msg.text)}</div>}

      <section className="card" style={{ display: 'flex', padding: '10px 6px' }}>
        {statCells.map(([l, v]) => (
          <div key={l} style={{ flex: 1, textAlign: 'center' }}>
            <div className="score" style={{ fontSize: 26 }}>{v}</div>
            <div className="lbl" style={{ fontSize: 10 }}>{t(l)}</div>
          </div>
        ))}
      </section>

      <section className="card">
        {groups.map((g, gi) => (
          <div key={g.label} style={{ marginTop: gi ? 10 : 0 }}>
            <div className="lbl" style={{ marginBottom: 6 }}>{t(g.label)}</div>
            {g.keys.map((k) => {
              const v = p.attrs[k];
              return (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 24px', gap: 10, alignItems: 'center', height: 22, fontSize: 13 }}>
                  <span>{t(ATTR_LABELS[k])}</span>
                  <div className="bar"><div style={{ width: `${(v / 20) * 100}%`, background: attrColor(v) }} /></div>
                  <span style={{ fontWeight: 700, textAlign: 'right' }}>{v}</span>
                </div>
              );
            })}
          </div>
        ))}
      </section>

      <section className="card" style={{ fontSize: 13 }}>
        <div className="lbl" style={{ marginBottom: 6 }}>{t('Stanje')}</div>
        <div className="row"><span className="muted">{t('Morala')}</span><span>{p.morale} %</span></div>
        <div className="row"><span className="muted">{t('Svežina')}</span><span>{Math.round(p.energy)} %</span></div>
        <div className="row"><span className="muted">{t('Forma')}</span><span>{p.form > 0 ? '+' : ''}{p.form}</span></div>
        {p.personality && <div className="row"><span className="muted">{t('Osebnost')}</span><span>{t(PERSONALITY_INFO[p.personality].label)}</span></div>}
        {p.personality && <div className="muted" style={{ fontSize: 12, textAlign: 'right' }}>{t(PERSONALITY_INFO[p.personality].desc)}</div>}
        {p.mentorId && game.players[p.mentorId] && <div className="row"><span className="muted">{t('Mentor')}</span><span>{game.players[p.mentorId].first} {game.players[p.mentorId].last}</span></div>}
        {p.listed && <div className="row"><span className="muted">{t('Status')}</span><span style={{ color: 'var(--gold)' }}>{t('na seznamu za prodajo')}</span></div>}
      </section>

      {isYouth && p.clubId === game.userClubId && (
        <section className="card" style={{ borderColor: 'var(--accent)' }}>
          <div className="lbl" style={{ marginBottom: 6 }}>{t('Mladinska šola ·')} {p.youth}</div>
          <p className="muted" style={{ fontSize: 13, margin: '0 0 10px' }}>{t('Potencial:')} {t(p.potential >= 76 ? 'izjemen' : p.potential >= 69 ? 'visok' : p.potential >= 62 ? 'srednji' : 'nizek')}. {t('Statistika zgoraj je iz mladinske lige.')}</p>
          <button className="btn block" onClick={() => update((g) => setMsg(promote(g, p.id)))}>{t('Pokliči v člansko ekipo')}</button>
        </section>
      )}

      {isMine && game.seasonYear - p.birthYear <= 20 && (
        <button className="btn ghost block" onClick={() => update((g) => { const r = demote(g, p.id); setMsg(r); })}>{t('Pošlji v mladinsko ekipo')}</button>
      )}

      {isMine && (
        <section className="card">
          {!confirmRelease ? (
            <button className="btn ghost block" onClick={() => setConfirmRelease(true)}>{t('Odpusti igralca')}</button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 13, margin: 0, color: 'var(--gold)' }}>{t('Odpravnina:')} {eur(p.wage * 2)}. {t('Igralec postane prost in ga lahko podpiše drug klub.')}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn sec" style={{ flex: 1 }} onClick={() => setConfirmRelease(false)}>{t('Prekliči')}</button>
                <button className="btn" style={{ flex: 1 }} onClick={() => update((g) => { const r = releasePlayer(g, p.id); setMsg({ ok: r.ok, text: r.text }); setConfirmRelease(false); })}>{t('Odpusti')}</button>
              </div>
            </div>
          )}
        </section>
      )}

      {(p.caps ?? []).length > 0 && (
        <section className="card" style={{ padding: '10px 6px' }}>
          <div className="lbl" style={{ padding: '0 6px 4px' }}>🌍 {t('Reprezentanca')}</div>
          <table className="t">
            <tbody>
              {[...(p.caps ?? [])].reverse().map((c, i) => (
                <tr key={i}><td>{t(c.event)}<span className="muted" style={{ display: 'block', fontSize: 11 }}>{c.team} · {c.place}. {t('mesto')}</span></td><td className="num">{c.gp}</td><td className="num">{c.g}</td><td className="num">{c.a}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {(p.story ?? []).length > 0 && (
        <section className="card">
          <div className="lbl" style={{ marginBottom: 8 }}>{t('Zgodba')}</div>
          <div style={{ borderLeft: '2px solid var(--line, rgba(255,255,255,.12))', paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...(p.story ?? [])].reverse().map((x, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: -18, top: 4, width: 10, height: 10, borderRadius: 5, background: i === 0 ? 'var(--accent)' : 'var(--muted)' }} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t(x.text)}</div>
                <div className="muted" style={{ fontSize: 11 }}>{fmtDate(x.date)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {p.history.length > 0 && (
        <section className="card" style={{ padding: '10px 6px' }}>
          <div className="lbl" style={{ padding: '0 6px 4px' }}>{t('Kariera')}</div>
          <table className="t">
            <thead><tr><th>{t('Sezona')}</th><th>{t('Klub')}</th><th className="num">T</th>{isG ? <><th className="num">%</th><th className="num">GAA</th></> : <><th className="num">G</th><th className="num">P</th><th className="num">Tč</th></>}</tr></thead>
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
      <p className="muted" style={{ fontSize: 11, margin: 0 }}>{t('Sezona')} {seasonLabel(game.seasonYear)}</p>
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
