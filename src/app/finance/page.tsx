'use client';
import { useState } from 'react';
import { BackLink, Shell, eur } from '@/components/ui';
import { useGame } from '@/store/game';
import { useT } from '@/i18n';
import { EXPENSE_LABELS, INCOME_LABELS, clubWages, expectedAttendance, isDerby, refPrice } from '@/engine/finance';
import { fmtDate, standings } from '@/engine/season';
import type { Fixture } from '@/engine/types';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];

export default function Finance() {
  const game = useGame((s) => s.game)!;
  const t = useT();
  const update = useGame((s) => s.update);
  const [tab, setTab] = useState<'pregled' | 'vstopnice'>('pregled');
  if (!game) return <Shell>{null}</Shell>;
  const fin = game.finance?.[game.userClubId];
  if (!fin) return <Shell><div className="page"><p>{t('Nalagam finance…')}</p></div></Shell>;
  const club = game.clubs.find((c) => c.id === game.userClubId)!;
  const wages = clubWages(game, club.id);
  const months = Object.keys(fin.ledger).filter((mo) => mo >= `${game.seasonYear}-07` && mo <= `${game.seasonYear + 1}-06`).sort().reverse();
  const curMonth = game.date.slice(0, 7);
  const cur = fin.ledger[curMonth] ?? {};
  const sum = (o: Record<string, number>, pos: boolean) => Object.values(o).filter((v) => (pos ? v > 0 : v < 0)).reduce((a, b) => a + b, 0);
  const season = months.reduce(
    (acc, m) => {
      for (const [k, v] of Object.entries(fin.ledger[m])) acc[k] = (acc[k] ?? 0) + v;
      return acc;
    },
    {} as Record<string, number>,
  );

  const st = standings(game);
  const pos = st.findIndex((s) => s.clubId === club.id) + 1;
  const nextHome = game.fixtures.filter((f) => !f.played && f.home === club.id).sort((a, b) => a.date.localeCompare(b.date))[0];
  const ref = refPrice(club);
  const setPrice = (k: keyof typeof fin.prices, v: number) => update((g) => { g.finance[g.userClubId].prices[k] = Math.max(1, Math.min(40, v)); });

  const preview = (kind: keyof typeof fin.prices) => {
    const opp = game.clubs.find((c) => c.id !== club.id && (kind === 'derby' ? isDerby(club.id, c.id) : !isDerby(club.id, c.id))) ?? game.clubs.find((c) => c.id !== club.id)!;
    const f: Fixture = { id: 'x', date: game.date, round: 0, home: club.id, away: opp.id, stage: kind === 'playoff' ? 'polfinale' : 'redni', played: false };
    const price = fin.prices[kind];
    const att = expectedAttendance(game, f, price, pos);
    return { att, rev: att * price };
  };

  const Row = ({ k, v, labels }: { k: string; v: number; labels: Record<string, string> }) => (
    <div className="row" style={{ fontSize: 13, padding: '6px 0', borderTop: '1px solid var(--line)' }}>
      <span>{labels[k] ?? k}</span>
      <span style={{ fontWeight: 600, color: v >= 0 ? 'var(--good)' : 'var(--bad)' }}>{v >= 0 ? '+' : ''}{eur(v)}</span>
    </div>
  );

  return (
    <Shell>
      <div className="page">
        <BackLink href="/domov" label="Domov" />
        <h1 className="h title">{t('Finance')}</h1>

        <section style={{ display: 'flex', gap: 8 }}>
          <div className="card" style={{ flex: 1, padding: '10px 12px' }}>
            <div className="lbl" style={{ fontSize: 10 }}>{t('Stanje na računu')}</div>
            <div className="h" style={{ fontSize: 24, color: fin.balance < 0 ? 'var(--bad)' : undefined }}>{eur(fin.balance)}</div>
          </div>
          <div className="card" style={{ flex: 1, padding: '10px 12px' }}>
            <div className="lbl" style={{ fontSize: 10 }}>{t('Plače / proračun')}</div>
            <div className="h" style={{ fontSize: 24 }}>{eur(wages)}</div>
            <div className="muted" style={{ fontSize: 11 }}>od {eur(fin.wageBudget)} {t('na mesec')}</div>
          </div>
        </section>

        <div className="seg">
          <button className={tab === 'pregled' ? 'on' : ''} onClick={() => setTab('pregled')}>{t('Pregled')}</button>
          <button className={tab === 'vstopnice' ? 'on' : ''} onClick={() => setTab('vstopnice')}>{t('Vstopnice')}</button>
        </div>

        {tab === 'pregled' && (
          <>
            <section className="card">
              <div className="row"><span className="lbl">{t('Ta mesec (')}{t(MONTHS[Number(curMonth.slice(5)) - 1])})</span><span style={{ fontWeight: 700, color: sum(cur, true) + sum(cur, false) >= 0 ? 'var(--good)' : 'var(--bad)' }}>{eur(sum(cur, true) + sum(cur, false))}</span></div>
              {Object.entries(cur).sort((a, b) => b[1] - a[1]).map(([k, v]) => <Row key={k} k={k} v={v} labels={{ ...INCOME_LABELS, ...EXPENSE_LABELS }} />)}
              {Object.keys(cur).length === 0 && <p className="muted" style={{ fontSize: 13, margin: '8px 0 0' }}>{t('Ta mesec še ni prometa. Plače in stroški se obračunajo 1. v mesecu.')}</p>}
            </section>

            <section className="card">
              <div className="lbl" style={{ marginBottom: 4 }}>{t('Sezona skupaj')}</div>
              <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{t('PRIHODKI')}</div>
              {Object.entries(season).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => <Row key={k} k={k} v={v} labels={INCOME_LABELS} />)}
              <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>{t('ODHODKI')}</div>
              {Object.entries(season).filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]).map(([k, v]) => <Row key={k} k={k} v={v} labels={EXPENSE_LABELS} />)}
            </section>

            <section className="card" style={{ fontSize: 13 }}>
              <div className="lbl" style={{ marginBottom: 6 }}>{t('Glavni sponzor')}</div>
              <div className="h" style={{ fontSize: 20 }}>{fin.sponsor.name}</div>
              <div className="row" style={{ marginTop: 6 }}><span className="muted">{t('Mesečno (sep–apr)')}</span><span>{eur(fin.sponsor.monthly)}</span></div>
              <div className="row"><span className="muted">{t('Bonus za končnico')}</span><span>{eur(fin.sponsor.playoffBonus)}</span></div>
              <div className="row"><span className="muted">{t('Bonus za naslov')}</span><span>{eur(fin.sponsor.titleBonus)}</span></div>
            </section>

            {months.length > 1 && (
              <section className="card" style={{ padding: '0 6px' }}>
                <div className="lbl" style={{ padding: '10px 6px 0' }}>{t('Po mesecih')}</div>
                <table className="t">
                  <thead><tr><th>{t('Mesec')}</th><th className="num">{t('Prihodki')}</th><th className="num">{t('Odhodki')}</th><th className="num">{t('Skupaj')}</th></tr></thead>
                  <tbody>
                    {months.map((mo) => {
                      const inc = sum(fin.ledger[mo], true);
                      const exp = sum(fin.ledger[mo], false);
                      return (
                        <tr key={mo}>
                          <td>{t(MONTHS[Number(mo.slice(5)) - 1])} {mo.slice(0, 4)}</td>
                          <td className="num" style={{ color: 'var(--good)' }}>{eur(inc)}</td>
                          <td className="num" style={{ color: 'var(--bad)' }}>{eur(exp)}</td>
                          <td className="num" style={{ fontWeight: 700 }}>{eur(inc + exp)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            )}
          </>
        )}

        {tab === 'vstopnice' && (
          <>
            <section className="card" style={{ fontSize: 13, lineHeight: 1.5 }}>
              <div className="lbl" style={{ marginBottom: 4 }}>{club.arena.name} · {club.arena.capacity} {t('mest')}</div>
              {t('Obisk je odvisen od cene, uvrstitve, nasprotnika, derbija in končnice. Previsoka cena pomeni prazno dvorano, prenizka pa izgubljen denar. Priporočena osnovna cena:')} <b>{ref} €</b>.
            </section>
            {([['regular', 'Redna tekma'], ['derby', 'Derbi'], ['playoff', 'Končnica']] as const).map(([k, l]) => {
              const pv = preview(k);
              return (
                <section key={k} className="card">
                  <div className="row">
                    <span className="lbl">{t(l)}</span>
                    <span className="muted" style={{ fontSize: 12 }}>~{pv.att} {t('gledalcev ·')} {eur(pv.rev)}</span>
                  </div>
                  <div className="row" style={{ marginTop: 10 }}>
                    <button className="btn sec" style={{ width: 52 }} onClick={() => setPrice(k, fin.prices[k] - 1)} aria-label="Znižaj ceno">−</button>
                    <span className="h" style={{ fontSize: 32 }}>{fin.prices[k]} €</span>
                    <button className="btn sec" style={{ width: 52 }} onClick={() => setPrice(k, fin.prices[k] + 1)} aria-label="Zvišaj ceno">+</button>
                  </div>
                  <div className="bar" style={{ marginTop: 10 }}><div style={{ width: `${(pv.att / club.arena.capacity) * 100}%` }} /></div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{t('Zasedenost')} {Math.round((pv.att / club.arena.capacity) * 100)} %</div>
                </section>
              );
            })}
            {nextHome && (
              <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                Naslednja domača tekma: {fmtDate(nextHome.date)} {t('proti')} {game.clubs.find((c) => c.id === nextHome.away)!.short}
.
              </p>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
