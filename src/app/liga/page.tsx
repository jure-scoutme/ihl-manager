'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Crest, Shell } from '@/components/ui';
import { useGame } from '@/store/game';
import { useT } from '@/i18n';
import { fmtDate, seasonLabel, standings } from '@/engine/season';

type Tab = 'lestvica' | 'razpored' | 'statistika' | 'koncnica';

export default function Liga() {
  const game = useGame((s) => s.game)!;
  const t = useT();
  const [tab, setTab] = useState<Tab>('lestvica');
  const [mine, setMine] = useState(true);
  if (!game) return <Shell>{null}</Shell>;
  const clubOf = (id: string) => game.clubs.find((c) => c.id === id)!;
  const st = standings(game);
  const players = Object.values(game.players).filter((p) => p.clubId);
  const scorers = players.filter((p) => p.pos !== 'G').sort((a, b) => b.stats.g + b.stats.a - (a.stats.g + a.stats.a) || b.stats.g - a.stats.g).slice(0, 15);
  const goalies = players.filter((p) => p.pos === 'G' && p.stats.gp >= 3).sort((a, b) => (b.stats.sa ? (b.stats.sa - b.stats.ga) / b.stats.sa : 0) - (a.stats.sa ? (a.stats.sa - a.stats.ga) / a.stats.sa : 0)).slice(0, 8);
  const fixtures = game.fixtures.filter((f) => !mine || f.home === game.userClubId || f.away === game.userClubId).sort((a, b) => a.date.localeCompare(b.date));
  const stageName: Record<string, string> = { cetrtfinale: 'Četrtfinale', polfinale: 'Polfinale', finale: 'Finale' };

  return (
    <Shell>
      <header style={{ padding: '18px 16px 0' }}>
        <h1 className="h title">Liga IHL {seasonLabel(game.seasonYear)}</h1>
      </header>
      <div className="page">
        <div className="seg">
          {([['lestvica', 'Lestvica'], ['razpored', 'Razpored'], ['statistika', 'Statistika'], ['koncnica', 'Končnica']] as const).map(([k, l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t(l)}</button>
          ))}
        </div>

        {tab === 'lestvica' && (
          <div className="card" style={{ padding: '0 6px' }}>
            <table className="t">
              <thead><tr><th>#</th><th>{t('Klub')}</th><th className="num">T</th><th className="num">Z</th><th className="num">ZP</th><th className="num">PP</th><th className="num">P</th><th className="num">{t('Goli')}</th><th className="num">Tč</th></tr></thead>
              <tbody>
                {st.map((s, i) => (
                  <tr key={s.clubId} style={{ color: s.clubId === game.userClubId ? 'var(--accent)' : undefined, borderBottom: i === 1 || i === 5 ? '2px solid var(--line2)' : undefined }}>
                    <td className="muted">{i + 1}</td>
                    <td style={{ fontWeight: 600 }}><Link href={s.clubId === game.userClubId ? '/kader' : `/ekipa?id=${s.clubId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Crest club={clubOf(s.clubId)} size={22} />{clubOf(s.clubId).short}</Link></td>
                    <td className="num">{s.gp}</td><td className="num">{s.w}</td><td className="num">{s.otw}</td><td className="num">{s.otl}</td><td className="num">{s.l}</td>
                    <td className="num muted">{s.gf}:{s.ga}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{s.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted" style={{ fontSize: 11, padding: '8px 6px', margin: 0 }}>1.–2. neposredno v polfinale, 3.–6. četrtfinale. Zmaga 3 tč, zmaga po podaljšku 2, poraz po podaljšku 1.</p>
          </div>
        )}

        {tab === 'razpored' && (
          <>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className={`chip ${mine ? 'on' : ''}`} onClick={() => setMine(true)}>{t('Moje tekme')}</button>
              <button className={`chip ${!mine ? 'on' : ''}`} onClick={() => setMine(false)}>{t('Vse tekme')}</button>
            </div>
            <div className="card" style={{ padding: '0 6px' }}>
              <table className="t">
                <tbody>
                  {fixtures.map((f) => (
                    <tr key={f.id}>
                      <td className="muted" style={{ fontSize: 12, width: 108 }}>{fmtDate(f.date).replace(/ \d{4}$/, '')}</td>
                      <td style={{ fontWeight: f.home === game.userClubId ? 700 : 500 }}><Link href={f.home === game.userClubId ? '/kader' : `/ekipa?id=${f.home}`}>{clubOf(f.home).short}</Link></td>
                      <td className="num" style={{ fontWeight: 700, width: 54 }}>{f.result ? <Link href={`/porocilo?id=${f.id}`} style={{ color: 'var(--accent)' }}>{`${f.result.hg}:${f.result.ag}${f.result.so ? 'k' : f.result.ot ? 'p' : ''}`}</Link> : '–'}</td>
                      <td style={{ fontWeight: f.away === game.userClubId ? 700 : 500, textAlign: 'right' }}><Link href={f.away === game.userClubId ? '/kader' : `/ekipa?id=${f.away}`}>{clubOf(f.away).short}</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'statistika' && (
          <>
            <div className="card" style={{ padding: '0 6px' }}>
              <div className="lbl" style={{ padding: '10px 6px 0' }}>{t('Strelci')}</div>
              <table className="t">
                <thead><tr><th>Igralec</th><th>{t('Klub')}</th><th className="num">T</th><th className="num">G</th><th className="num">P</th><th className="num">Tč</th></tr></thead>
                <tbody>
                  {scorers.map((p) => (
                    <tr key={p.id}>
                      <td><Link href={`/igralec?id=${p.id}&from=liga`} style={{ fontWeight: 600 }}>{p.first[0]}. {p.last}</Link></td>
                      <td className="muted">{clubOf(p.clubId!).short}</td>
                      <td className="num">{p.stats.gp}</td><td className="num">{p.stats.g}</td><td className="num">{p.stats.a}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{p.stats.g + p.stats.a}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card" style={{ padding: '0 6px' }}>
              <div className="lbl" style={{ padding: '10px 6px 0' }}>{t('Golmani')}</div>
              <table className="t">
                <thead><tr><th>{t('Golman')}</th><th>{t('Klub')}</th><th className="num">T</th><th className="num">%</th><th className="num">GAA</th></tr></thead>
                <tbody>
                  {goalies.map((p) => (
                    <tr key={p.id}>
                      <td><Link href={`/igralec?id=${p.id}`} style={{ fontWeight: 600 }}>{p.first[0]}. {p.last}</Link></td>
                      <td className="muted">{clubOf(p.clubId!).short}</td>
                      <td className="num">{p.stats.gp}</td>
                      <td className="num">{(((p.stats.sa - p.stats.ga) / p.stats.sa) * 100).toFixed(1)}</td>
                      <td className="num">{(p.stats.ga / p.stats.gp).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'koncnica' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {game.series.length === 0 && <p className="muted">Končnica se začne po rednem delu. Igra 6 najboljših: 1. in 2. gresta neposredno v polfinale.</p>}
            {game.series.map((s) => (
              <div key={s.id} className="card">
                <div className="lbl">{stageName[s.stage]} · na {s.winsNeeded} zmage</div>
                <div className="row" style={{ marginTop: 8, fontSize: 15 }}>
                  <span style={{ fontWeight: s.winner === s.high ? 700 : 500 }}>{clubOf(s.high).short}</span>
                  <span className="h" style={{ fontSize: 22 }}>{s.hw} : {s.lw}</span>
                  <span style={{ fontWeight: s.winner === s.low ? 700 : 500 }}>{clubOf(s.low).short}</span>
                </div>
              </div>
            ))}
            {game.pastChampions.length > 0 && (
              <div className="card">
                <div className="lbl">Pretekli prvaki</div>
                {game.pastChampions.map((c) => <div key={c.season} className="row" style={{ fontSize: 13, marginTop: 6 }}><span>{c.season}</span><span>{clubOf(c.clubId).short}</span></div>)}
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
