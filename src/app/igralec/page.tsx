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
import { shownSeason } from '@/engine/history';
import { assignScout, attrRange, knowledge, scouting, shownOvr, shownPotential } from '@/engine/scouting';
import { TALKS, captainsOf, talk, talkCooldown } from '@/engine/people';
import { buyFromAbroad, importFee, importWage } from '@/engine/sales';
import { acceptOffer, counterOffer, listForSale, listing, rejectOffer, withdrawSale } from '@/engine/sales';
import { expiring, loanOut, loanTargets, offerRenewal, recallLoan, renewalAsk, transferWindow } from '@/engine/contracts';

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
  const [askFee, setAskFee] = useState<number | null>(null);
  const [counter, setCounter] = useState<Record<string, number>>({});
  if (!game) return null;
  const p = game.players[id] ?? game.youth?.[id];
  const isYouth = !!game.youth?.[id];
  const back = from === 'prestopi' ? { href: '/prestopi', label: 'Prosti igralci' } : from === 'liga' ? { href: '/liga', label: 'Liga' } : from === 'mladinci' ? { href: '/mladinci', label: 'Mladinska šola' } : from === 'ekipa' ? { href: `/ekipa?id=${params.get('club')}`, label: 'Ekipa' } : { href: '/kader', label: 'Kader' };
  if (!p) return <div className="page"><BackLink href={back.href} label={back.label} /><p>{t('Igralec ne obstaja več.')}</p></div>;
  const isMine = p.clubId === game.userClubId && !isYouth;
  const isFree = p.clubId === null && !p.abroad;
  const offerWage = wage ?? p.wage;
  const fin = game.finance?.[game.userClubId];
  const room = fin ? fin.wageBudget - clubWages(game, game.userClubId) : 0;
  const myLoan = p.loan?.from === game.userClubId;
  const isOther = !!p.clubId && p.clubId !== game.userClubId && !isYouth && !p.loan;
  const agreed = game.agreedFees?.[p.id];
  const value = isOther ? transferValue(game, p) : 0;
  const offerFee = fee ?? value;
  const tWage = wage ?? (isOther ? transferWageDemand(game, p) : p.wage);
  const club = game.clubs.find((c) => c.id === p.clubId);
  const shown = shownOvr(game, p);
  const know = knowledge(game, p);
  const scoutTask = scouting(game, p.id);
  const ask = isMine ? renewalAsk(game, p) : null;
  const rWage = wage ?? ask?.wage ?? p.wage;
  const win = transferWindow(game);
  const expSoon = isMine && expiring(game).some((x) => x.id === p.id);
  const groups = p.pos === 'G' ? [GOALIE_GROUP, { label: 'Mentalni', keys: ['decisions', 'positioning', 'leadership'] as (keyof typeof p.attrs)[] }] : ATTR_GROUPS;
  const lastSeason = shownSeason(game, p);
  const s = lastSeason?.stats ?? p.stats;
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
            <div className="score" style={{ fontSize: 36, lineHeight: 1, color: ovrColor(shown.value) }}>{shown.exact ? '' : '~'}{shown.value}</div>
            <div style={{ fontSize: 10, opacity: 0.8, fontWeight: 700 }}>POT {shownPotential(game, p)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 12, flexWrap: 'wrap' }}>
          {club && <span className="pill" style={{ background: 'rgba(255,255,255,.16)', height: 26 }}><Crest club={club} size={18} /> {club.name}</span>}
          {!club && !p.abroad && <span className="pill" style={{ background: 'rgba(255,255,255,.16)', height: 26 }}>{t('Prost igralec')}</span>}
          {p.abroad && <span className="pill" style={{ background: 'rgba(255,255,255,.16)', height: 26 }}>✈️ {p.abroad.club} · {p.abroad.league}</span>}
          <span className="pill" style={{ background: 'rgba(255,255,255,.16)', height: 26 }}>#{p.number}</span>
          {p.clubId && captainsOf(game, p.clubId).c === p.id && <span className="pill" style={{ background: 'rgba(255,255,255,.28)', height: 26, fontWeight: 800 }}>C · {t('kapetan')}</span>}
          {p.clubId && captainsOf(game, p.clubId).a.includes(p.id) && <span className="pill" style={{ background: 'rgba(255,255,255,.2)', height: 26, fontWeight: 800 }}>A</span>}
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

      {p.abroad && !p.clubId && fin && (() => {
        const fee0 = importFee(game, p);
        const w = wage ?? importWage(game, p);
        return (
          <section className="card" style={{ borderColor: 'var(--accent)' }}>
            <div className="row"><span className="lbl">{t('Nakup iz tujine')}</span><span className="muted" style={{ fontSize: 12 }}>{t('odškodnina')} <b style={{ color: 'var(--text)' }}>{eur(fee0)}</b></span></div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn sec" style={{ width: 52 }} onClick={() => setWage(Math.max(100, w - 50))} aria-label="Manj">−</button>
              <span style={{ textAlign: 'center' }}><span className="h" style={{ fontSize: 28 }}>{eur(w)}</span><br /><span className="muted" style={{ fontSize: 11 }}>{t('na mesec · zahteva')} {eur(importWage(game, p))}</span></span>
              <button className="btn sec" style={{ width: 52 }} onClick={() => setWage(w + 50)} aria-label="Več">+</button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              {[1, 2, 3].map((y) => <button key={y} className={`chip ${years === y ? 'on' : ''}`} style={{ flex: 1 }} onClick={() => setYears(y)}>{y} {t(y === 1 ? 'leto' : y === 2 ? 'leti' : 'leta')}</button>)}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t('Na računu:')} <b style={{ color: fin.balance < fee0 ? 'var(--bad)' : 'var(--text)' }}>{eur(fin.balance)}</b> · {t('Prostor v proračunu za plače:')} <b>{eur(room)}</b></div>
            <button className="btn block" style={{ marginTop: 10 }} onClick={() => update((g) => { const r = buyFromAbroad(g, p.id, w, years); setMsg({ ok: r.ok, text: r.text }); setWage(null); })}>{t('Kupi igralca')}</button>
          </section>
        );
      })()}

      {isMine && (() => {
        const l = listing(game, p.id);
        const val = transferValue(game, p);
        const askV = askFee ?? Math.round(val / 500) * 500;
        return (
          <section className="card" style={{ borderColor: l?.offers.length ? 'var(--gold)' : undefined }}>
            <div className="row"><span className="lbl">{t('Prodaja')}</span><span className="muted" style={{ fontSize: 12 }}>{t('vrednost ~')}{eur(val)}</span></div>
            {!l ? (
              <>
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn sec" style={{ width: 52 }} onClick={() => setAskFee(Math.max(0, askV - 1000))} aria-label="Manj">−</button>
                  <span style={{ textAlign: 'center' }}><span className="h" style={{ fontSize: 26 }}>{askV ? eur(askV) : t('najboljša ponudba')}</span><br /><span className="muted" style={{ fontSize: 11 }}>{t('želena odškodnina')}</span></span>
                  <button className="btn sec" style={{ width: 52 }} onClick={() => setAskFee(askV + 1000)} aria-label="Več">+</button>
                </div>
                <button className="btn sec block" style={{ marginTop: 10 }} onClick={() => update((g) => setMsg(listForSale(g, p.id, askV || null)))}>{t('Ponudi igralca klubom')}</button>
                <p className="muted" style={{ fontSize: 11, margin: '8px 0 0' }}>{t('Ponudbe lahko pošljejo IHL klubi, ki si ga lahko privoščijo, in klubi iz tujine (Alps HL, ICEHL, DEL2, Extraliga …).')}</p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, margin: '8px 0' }}>{l.offers.length ? t('Ponudbe:') : t('Igralec je na trgu do {d}. Čakamo na ponudbe.', { d: fmtDate(l.until).replace(/ \d{4}$/, '') })}</p>
                {l.offers.map((o) => (
                  <div key={o.id} style={{ border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: 10, marginBottom: 8 }}>
                    <div className="row" style={{ fontSize: 13 }}><b>{o.buyer}</b><b style={{ color: 'var(--good)' }}>{eur(o.fee)}</b></div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{o.league ? `${o.league}` : 'IHL'}{o.sellOn ? ` · ${t('{n} % od nadaljnje prodaje', { n: o.sellOn })}` : ''} · {t('velja do {d}', { d: fmtDate(o.expires).replace(/ \d{4}$/, '') })}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button className="btn" style={{ flex: 1, height: 36, fontSize: 13 }} onClick={() => update((g) => setMsg(acceptOffer(g, p.id, o.id)))}>{t('Sprejmi')}</button>
                      <button className="btn sec" style={{ flex: 1, height: 36, fontSize: 12 }} onClick={() => update((g) => setMsg(counterOffer(g, p.id, o.id, counter[o.id] ?? Math.round((o.fee * 1.2) / 500) * 500)))}>{t('Protiponudba')} {eur(counter[o.id] ?? Math.round((o.fee * 1.2) / 500) * 500)}</button>
                      <button className="btn ghost" style={{ width: 44, height: 36 }} onClick={() => update((g) => rejectOffer(g, p.id, o.id))}>✕</button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      {[1.1, 1.2, 1.35].map((m) => <button key={m} className={`chip ${(counter[o.id] ?? Math.round((o.fee * 1.2) / 500) * 500) === Math.round((o.fee * m) / 500) * 500 ? 'on' : ''}`} style={{ flex: 1, height: 28, fontSize: 11 }} onClick={() => setCounter({ ...counter, [o.id]: Math.round((o.fee * m) / 500) * 500 })}>+{Math.round((m - 1) * 100)} %</button>)}
                    </div>
                  </div>
                ))}
                <button className="btn ghost block" style={{ height: 40 }} onClick={() => update((g) => withdrawSale(g, p.id))}>{t('Umakni s trga')}</button>
              </>
            )}
          </section>
        );
      })()}

      {myLoan && (
        <section className="card row" style={{ fontSize: 13, borderColor: 'var(--accent)' }}>
          <span><span className="lbl" style={{ display: 'block' }}>{t('Na posoji')}</span>{t('V klubu {c} do konca sezone.', { c: club?.short ?? '' })}</span>
          <button className="btn sec" style={{ height: 38, padding: '0 14px', fontSize: 13 }} onClick={() => update((g) => setMsg(recallLoan(g, p.id)))}>{t('Vrni s posoje')}</button>
        </section>
      )}

      {isMine && game.seasonYear - p.birthYear <= 23 && (
        <section className="card">
          <div className="lbl" style={{ marginBottom: 6 }}>{t('Posoja')}</div>
          {(() => { const opts = loanTargets(game, p); return opts.length ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <select id="loanclub" defaultValue={opts[0].id} style={{ flex: 1, height: 40, borderRadius: 10, background: 'var(--surface2)', color: 'var(--text)', border: '1px solid rgba(255,255,255,.1)', padding: '0 10px' }}>
                {opts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button className="btn sec" style={{ height: 40, padding: '0 14px', fontSize: 13 }} onClick={() => { const v = (document.getElementById('loanclub') as HTMLSelectElement).value; update((g) => setMsg(loanOut(g, p.id, v))); }}>{t('Pošlji na posojo')}</button>
            </div>
          ) : <p className="muted" style={{ fontSize: 12, margin: 0 }}>{t('Trenutno ga noben klub ne želi na posojo.')}</p>; })()}
          <p className="muted" style={{ fontSize: 11, margin: '8px 0 0' }}>{t('Na posoji igra več in hitreje napreduje. Vrne se 1. julija. Plačo plača drugi klub.')}</p>
        </section>
      )}

      {isMine && (
        <section className="card">
          <div className="row"><span className="lbl">{t('Pogovor z igralcem')}</span>{talkCooldown(game, p) && <span className="muted" style={{ fontSize: 11 }}>{t('naslednji pogovor čez nekaj dni')}</span>}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            {TALKS.map((x) => <button key={x.id} className="btn sec" disabled={!!talkCooldown(game, p)} style={{ height: 40, fontSize: 13 }} onClick={() => update((g) => setMsg(talk(g, p.id, x.id)))}>{t(x.label)}</button>)}
          </div>
          <p className="muted" style={{ fontSize: 11, margin: '8px 0 0' }}>{t('Odziv je odvisen od osebnosti in forme igralca.')}</p>
        </section>
      )}

      {!isMine && know < 100 && (
        <section className="card row" style={{ fontSize: 13 }}>
          <span>
            <span className="lbl" style={{ display: 'block' }}>{t('Skavtiranje')} · {know} %</span>
            <span className="muted" style={{ fontSize: 12 }}>{scoutTask ? t('Skavt spremlja igralca, poročilo do {d}.', { d: fmtDate(scoutTask.until).replace(/ \d{4}$/, '') }) : t('Atributi in potencial so ocena. Skavt jih razkrije.')}</span>
          </span>
          {!scoutTask && <button className="btn sec" style={{ height: 38, padding: '0 14px', fontSize: 13 }} onClick={() => update((g) => { const r = assignScout(g, p.id); setMsg({ ok: r.ok, text: r.text }); })}>{t('Pošlji skavta')}</button>}
        </section>
      )}

      {msg && <div className="card" style={{ fontSize: 13, color: msg.ok ? 'var(--good)' : 'var(--gold)' }}>{t(msg.text)}</div>}

      {lastSeason && !lastSeason.current && <div className="lbl" style={{ margin: '0 4px -6px' }}>{t('Statistika')} {lastSeason.label} · {game.clubs.find((c) => c.id === lastSeason.clubId)?.short ?? lastSeason.clubId}</div>}
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
              const [lo, hi] = attrRange(game, p, k);
              const v = Math.round((lo + hi) / 2);
              return (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 40px', gap: 10, alignItems: 'center', height: 22, fontSize: 13 }}>
                  <span>{t(ATTR_LABELS[k])}</span>
                  <div className="bar" style={{ position: 'relative' }}>
                    {lo === hi ? <div style={{ width: `${(v / 20) * 100}%`, background: attrColor(v) }} /> : <div style={{ position: 'absolute', left: `${(lo / 20) * 100}%`, width: `${((hi - lo) / 20) * 100}%`, top: 0, bottom: 0, background: attrColor(v), opacity: 0.55, borderRadius: 4 }} />}
                  </div>
                  <span style={{ fontWeight: 700, textAlign: 'right' }}>{lo === hi ? v : `${lo}–${hi}`}</span>
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
                <tr key={h.season + h.clubId}>
                  <td>{h.season}</td>
                  <td>{game.clubs.find((c) => c.id === h.clubId)?.short ?? h.clubId}</td>
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
