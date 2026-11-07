'use client';
import Link from 'next/link';
import { useState } from 'react';
import { BackLink, Crest, Shell } from '@/components/ui';
import { useGame } from '@/store/game';
import { useT } from '@/i18n';
import { careerTotals } from '@/engine/club';
import { ACHIEVEMENTS } from '@/engine/achievements';
import { fmtDate } from '@/engine/season';

type Tab = 'sezone' | 'klubi' | 'legende' | 'dosezki';

export default function Zgodovina() {
  const game = useGame((s) => s.game)!;
  const t = useT();
  const [tab, setTab] = useState<Tab>(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'dosezki' ? 'dosezki' : 'sezone'));
  if (!game) return <Shell>{null}</Shell>;
  const clubOf = (id: string) => game.clubs.find((c) => c.id === id);
  const seasons = [...(game.seasonRecords ?? [])].reverse();
  const clubs = Object.entries(game.clubRecords ?? {}).sort((a, b) => b[1].titles - a[1].titles || b[1].pts - a[1].pts);
  // legende: upokojeni + aktivni igralci po točkah v karieri
  const active = Object.values(game.players)
    .filter((p) => p.clubId && p.pos !== 'G')
    .map((p) => ({ id: p.id, name: `${p.first} ${p.last}`, clubId: p.clubId!, ...careerTotals(p), active: true }));
  const retired = (game.legends ?? []).filter((l) => l.pos !== 'G').map((l) => ({ id: '', name: l.name, clubId: l.clubId, gp: l.gp, g: l.g, a: l.a, active: false }));
  const leaders = [...active, ...retired].sort((a, b) => b.g + b.a - (a.g + a.a)).slice(0, 25);
  const myBig = game.clubRecords?.[game.userClubId]?.biggestWin;

  return (
    <Shell>
      <div className="page">
        <BackLink href="/klub" label="Klub" />
        <h1 className="h title">{t('Zgodovina')}</h1>
        <div className="seg">
          {([['sezone', 'Sezone'], ['klubi', 'Večna lestvica'], ['legende', 'Legende'], ['dosezki', 'Dosežki']] as const).map(([k, l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t(l)}</button>
          ))}
        </div>

        {tab === 'sezone' && (
          <>
            {seasons.length === 0 && <p className="muted" style={{ fontSize: 13 }}>{t('Zgodovina se začne beležiti po koncu prve sezone.')}</p>}
            {seasons.map((s) => {
              const ch = clubOf(s.champion);
              return (
                <section key={s.season} className="card" style={{ fontSize: 13 }}>
                  <div className="row"><span className="lbl">{t('Sezona')} {s.season}</span><span className="muted" style={{ fontSize: 12 }}>{t('tvoj klub:')} {s.userFinish}. {t('mesto')}</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0' }}>
                    {ch && <Crest club={ch} size={36} />}
                    <div>
                      <div className="h" style={{ fontSize: 20, color: s.champion === game.userClubId ? 'var(--accent)' : undefined }}>{t('Prvak:')} {ch?.short}</div>
                      {s.runnerUp && <div className="muted" style={{ fontSize: 12 }}>{t('Finale')} {s.final} {t('proti')} {clubOf(s.runnerUp)?.short} {t('· redni del:')} {clubOf(s.regularWinner)?.short}</div>}
                    </div>
                  </div>
                  {s.topScorer && <div className="row"><span className="muted">{t('Najboljši po točkah')}</span><span>{s.topScorer.name} ({clubOf(s.topScorer.clubId)?.short}) {s.topScorer.g}+{s.topScorer.a}={s.topScorer.pts}</span></div>}
                  {s.topGoals && <div className="row"><span className="muted">{t('Največ golov')}</span><span>{s.topGoals.name} · {s.topGoals.g}</span></div>}
                  {s.bestGoalie && <div className="row"><span className="muted">{t('Najboljši golman')}</span><span>{s.bestGoalie.name} · {s.bestGoalie.svp} %</span></div>}
                </section>
              );
            })}
          </>
        )}

        {tab === 'klubi' && (
          <>
            <div className="card" style={{ padding: '0 6px' }}>
              <table className="t">
                <thead><tr><th>{t('Klub')}</th><th className="num">{t('Naslovi')}</th><th className="num">{t('Sez.')}</th><th className="num">{t('Zmage')}</th><th className="num">{t('Goli')}</th><th className="num">Tč</th></tr></thead>
                <tbody>
                  {clubs.map(([id, r]) => (
                    <tr key={id} style={{ color: id === game.userClubId ? 'var(--accent)' : undefined }}>
                      <td style={{ fontWeight: 600 }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{clubOf(id) && <Crest club={clubOf(id)!} size={22} />}{clubOf(id)?.short}</span></td>
                      <td className="num" style={{ fontWeight: 700 }}>{r.titles}</td>
                      <td className="num">{r.seasons}</td>
                      <td className="num">{r.w}</td>
                      <td className="num muted">{r.gf}:{r.ga}</td>
                      <td className="num">{r.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {myBig && <div className="card" style={{ fontSize: 13 }}><div className="lbl" style={{ marginBottom: 4 }}>{t('Najvišja zmaga tvojega kluba')}</div>{myBig.score} {t('proti')} {clubOf(myBig.vs)?.short} ({myBig.season})</div>}
            {game.pastChampions.length > 0 && (
              <div className="card" style={{ fontSize: 13 }}>
                <div className="lbl" style={{ marginBottom: 4 }}>{t('Prvaki IHL')}</div>
                {[...game.pastChampions].reverse().map((c) => <div key={c.season} className="row" style={{ padding: '4px 0' }}><span>{c.season}</span><span style={{ fontWeight: 600 }}>{clubOf(c.clubId)?.short}</span></div>)}
              </div>
            )}
          </>
        )}

        {tab === 'legende' && (
          <div className="card" style={{ padding: '0 6px' }}>
            <div className="lbl" style={{ padding: '10px 6px 0' }}>{t('Največ točk v karieri (v igri)')}</div>
            <table className="t">
              <thead><tr><th>#</th><th>{t('Igralec')}</th><th>{t('Klub')}</th><th className="num">T</th><th className="num">G</th><th className="num">P</th><th className="num">Tč</th></tr></thead>
              <tbody>
                {leaders.map((l, i) => (
                  <tr key={`${l.name}-${i}`}>
                    <td className="muted">{i + 1}</td>
                    <td>{l.active ? <Link href={`/igralec?id=${l.id}&from=liga`} style={{ fontWeight: 600 }}>{l.name}</Link> : <span style={{ fontWeight: 600 }}>{l.name} <span className="muted" style={{ fontSize: 11 }}>{t('upokojen')}</span></span>}</td>
                    <td className="muted">{clubOf(l.clubId)?.short}</td>
                    <td className="num">{l.gp}</td><td className="num">{l.g}</td><td className="num">{l.a}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{l.g + l.a}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'dosezki' && (
          <>
            <div className="card row" style={{ fontSize: 13 }}>
              <span className="muted">{t('Odklenjeno')}</span>
              <span className="score" style={{ fontSize: 22 }}>{(game.achievements ?? []).length} / {ACHIEVEMENTS.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {ACHIEVEMENTS.map((a) => {
                const got = (game.achievements ?? []).find((x) => x.id === a.id);
                return (
                  <div key={a.id} className="card" style={{ padding: 12, margin: 0, opacity: got ? 1 : 0.45, borderColor: got ? 'var(--gold)' : undefined }}>
                    <div style={{ fontSize: 26, filter: got ? 'none' : 'grayscale(1)' }}>{got ? a.icon : '🔒'}</div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginTop: 6 }}>{t(a.title)}</div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 3, lineHeight: 1.4 }}>{t(a.desc)}</div>
                    {got && <div style={{ fontSize: 10, marginTop: 6, color: 'var(--gold)' }}>{fmtDate(got.date)}</div>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
