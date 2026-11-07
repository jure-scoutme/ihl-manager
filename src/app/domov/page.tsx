'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Bar, Crest, Icon, Shell, eur } from '@/components/ui';
import { useGame } from '@/store/game';
import { clubPlayers, fmtDate, nextUserFixture, quickSim, seasonLabel, standings, startNewSeason, userFixtureToday, type DevChange } from '@/engine/season';

export default function Domov() {
  const game = useGame((s) => s.game)!;
  const update = useGame((s) => s.update);
  const continueGame = useGame((s) => s.continueGame);
  const router = useRouter();
  const [summary, setSummary] = useState<{ changes: DevChange[]; retired: string[]; youth: string[] } | null>(null);
  const [openNews, setOpenNews] = useState<string | null>(null);
  if (!game) return <Shell>{null}</Shell>;

  const club = game.clubs.find((c) => c.id === game.userClubId)!;
  const clubOf = (id: string) => game.clubs.find((c) => c.id === id)!;
  const today = userFixtureToday(game);
  const next = today ?? nextUserFixture(game);
  const st = standings(game);
  const myPos = st.findIndex((s) => s.clubId === club.id) + 1;
  const roster = clubPlayers(game, club.id);
  const avg = (fn: (p: (typeof roster)[0]) => number) => Math.round(roster.reduce((s, p) => s + fn(p), 0) / Math.max(1, roster.length));
  const morale = avg((p) => p.morale);
  const energy = avg((p) => p.energy);
  const injured = roster.filter((p) => p.injuryDays > 0).length;
  const last5 = game.fixtures
    .filter((f) => f.played && (f.home === club.id || f.away === club.id))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .reverse()
    .map((f) => {
      const us = f.home === club.id;
      const my = us ? f.result!.hg : f.result!.ag;
      const op = us ? f.result!.ag : f.result!.hg;
      return my > op ? (f.result!.ot || f.result!.so ? 'ZP' : 'Z') : f.result!.ot || f.result!.so ? 'PP' : 'P';
    });

  const onContinue = () => {
    const r = continueGame();
    if (r.stoppedFor === 'tekma') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const stageLabel = (s: string) => (s === 'redni' ? 'Redni del' : s === 'cetrtfinale' ? 'Četrtfinale' : s === 'polfinale' ? 'Polfinale' : 'Finale');
  const unread = game.news.filter((n) => !n.read).length;

  return (
    <Shell>
      <header style={{ padding: '18px 16px 4px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Crest club={club} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="h" style={{ fontSize: 20 }}>{club.name}</div>
          <div className="muted" style={{ fontSize: 12 }}>{fmtDate(game.date)} · IHL {seasonLabel(game.seasonYear)}</div>
        </div>
        <Link href="/koledar" className="btn sec" style={{ width: 44, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Koledar"><Icon name="calendar" /></Link>
        <button className="btn" onClick={onContinue} disabled={!!today || game.phase === 'konec'}>Nadaljuj</button>
      </header>

      <div className="page">
        {game.phase === 'konec' && (
          <section className="card" style={{ borderColor: 'var(--accent)' }}>
            <div className="lbl">Konec sezone {seasonLabel(game.seasonYear)}</div>
            <div className="h" style={{ fontSize: 26, margin: '6px 0', color: 'var(--accent)' }}>Prvak: {clubOf(game.champion!).short}</div>
            <p className="muted" style={{ fontSize: 13, margin: '0 0 12px' }}>Redni del ste končali na {myPos}. mestu. Cilj uprave je bil: {club.boardGoal}.</p>
            <button className="btn block" onClick={() => update((g) => setSummary(startNewSeason(g)))}>Začni sezono {seasonLabel(game.seasonYear + 1)}</button>
          </section>
        )}

        {summary && (
          <section className="card">
            <div className="row"><span className="lbl">Razvoj igralcev čez poletje</span><button className="chip" onClick={() => setSummary(null)}>Zapri</button></div>
            {summary.changes.sort((a, b) => b.after - b.before - (a.after - a.before)).slice(0, 10).map((c) => (
              <div key={c.playerId} className="list-item" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                <span>{c.name} · {c.age}<br /><span className="muted" style={{ fontSize: 11 }}>{c.reason}</span></span>
                <span><span className="muted">{c.before} → {c.after} </span><b style={{ color: c.after > c.before ? 'var(--good)' : 'var(--bad)' }}>{c.after > c.before ? '+' : ''}{c.after - c.before}</b></span>
              </div>
            ))}
            {summary.retired.length > 0 && <p style={{ fontSize: 13 }}><span className="lbl">Upokojitve: </span>{summary.retired.join(', ')}</p>}
            {summary.youth.length > 0 && <p style={{ fontSize: 13 }}><span className="lbl">Novi mladinci (AI): </span>{summary.youth.join(', ')}</p>}
          </section>
        )}

        {next && (
          <section className="card" style={{ padding: 16 }}>
            <div className="row"><span className="lbl">{today ? 'Danes' : 'Naslednja tekma'} · {stageLabel(next.stage)}</span><span className="muted" style={{ fontSize: 12 }}>{fmtDate(next.date)}</span></div>
            <div className="row" style={{ margin: '14px 0 10px' }}>
              {[next.home, next.away].map((id, i) => (
                <div key={id} style={{ textAlign: 'center', flex: 1 }}>
                  <div className="h" style={{ fontSize: 24, color: id === club.id ? 'var(--accent)' : undefined }}>{clubOf(id).short}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{st.findIndex((s) => s.clubId === id) + 1}. mesto · {st.find((s) => s.clubId === id)!.pts} tč</div>
                  {i === 0 && <div style={{ display: 'none' }} />}
                </div>
              ))}
            </div>
            <div className="muted" style={{ fontSize: 12, textAlign: 'center' }}>{clubOf(next.home).arena.name}, {clubOf(next.home).arena.city} · {clubOf(next.home).arena.capacity} mest</div>
            {today && (
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => router.push('/tekma')}>Igraj v živo</button>
                <button className="btn sec" style={{ flex: 1 }} onClick={() => update((g) => { const f = g.fixtures.find((x) => x.id === today.id)!; quickSim(g, f); })}>Hitra simulacija</button>
              </div>
            )}
          </section>
        )}

        <section className="card">
          <div className="lbl" style={{ marginBottom: 10 }}>Stanje ekipe</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13 }}>
            <div><div className="row" style={{ marginBottom: 4 }}><span>Morala</span><span>{morale} %</span></div><Bar value={morale} /></div>
            <div><div className="row" style={{ marginBottom: 4 }}><span>Svežina</span><span>{energy} %</span></div><Bar value={energy} color={energy < 70 ? 'var(--gold)' : undefined} /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <span className="muted" style={{ fontSize: 12 }}>Forma (zadnjih 5){injured ? ` · poškodovani: ${injured}` : ''}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {last5.length === 0 && <span className="muted" style={{ fontSize: 12 }}>—</span>}
              {last5.map((r, i) => (
                <span key={i} style={{ minWidth: 22, height: 22, padding: '0 4px', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: r[0] === 'Z' ? '#1f4d3a' : '#4d2a1f', color: r[0] === 'Z' ? '#8fe3b5' : '#f5a98f' }}>{r}</span>
              ))}
            </div>
          </div>
        </section>

        {game.finance?.[club.id] && (() => {
          const fin = game.finance[club.id];
          const cur = fin.ledger[game.date.slice(0, 7)] ?? {};
          const net = Object.values(cur).reduce((a, b) => a + b, 0);
          return (
            <Link href="/finance" className="card" style={{ display: 'block' }}>
              <div className="row"><span className="lbl">Finance</span><span style={{ fontSize: 12, color: 'var(--accent)' }}>Vstopnice in finance →</span></div>
              <div className="row" style={{ marginTop: 8 }}>
                <span><span className="muted" style={{ fontSize: 11 }}>Stanje</span><br /><span className="h" style={{ fontSize: 22, color: fin.balance < 0 ? 'var(--bad)' : undefined }}>{eur(fin.balance)}</span></span>
                <span style={{ textAlign: 'right' }}><span className="muted" style={{ fontSize: 11 }}>Ta mesec</span><br /><span className="h" style={{ fontSize: 22, color: net >= 0 ? 'var(--good)' : 'var(--bad)' }}>{net >= 0 ? '+' : ''}{eur(net)}</span></span>
              </div>
            </Link>
          );
        })()}

        <section className="card" style={{ padding: '6px 14px' }}>
          <div className="row" style={{ padding: '8px 0' }}><span className="lbl">Pošta</span><span style={{ fontSize: 12, color: 'var(--accent)' }}>{unread ? `${unread} novih` : ''}</span></div>
          {game.news.slice(0, 6).map((n) => (
            <div key={n.id}>
            <button onClick={() => { setOpenNews(openNews === n.id ? null : n.id); if (!n.read) update((g) => { const x = g.news.find((y) => y.id === n.id); if (x) x.read = true; }); }} style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: '1px solid var(--line)', background: 'none', border: 0, borderTopStyle: 'solid', color: 'var(--text)', width: '100%', textAlign: 'left', cursor: 'pointer' }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: n.read ? '#4a5a78' : n.kind === 'garderoba' ? 'var(--gold)' : 'var(--accent)', marginTop: 5, flex: 'none' }} />
              <span>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{n.title}</span>
                <span className="muted" style={{ display: 'block', fontSize: 12 }}>{n.kind} · {fmtDate(n.date)}</span>
                {openNews === n.id && <span style={{ display: 'block', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>{n.body}</span>}
              </span>
            </button>
            {openNews === n.id && n.fixtureId && <Link href={`/porocilo?id=${n.fixtureId}`} style={{ display: 'block', margin: '-4px 0 10px 18px', fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>Poročilo s tekme →</Link>}
            </div>
          ))}
        </section>

        <section className="card">
          <div className="row" style={{ marginBottom: 6 }}><span className="lbl">Lestvica</span><Link href="/liga" style={{ fontSize: 12, color: 'var(--accent)' }}>Vse</Link></div>
          <table className="t">
            <tbody>
              {st.map((s, i) => (
                <tr key={s.clubId} style={{ color: s.clubId === club.id ? 'var(--accent)' : undefined }}>
                  <td style={{ width: 24 }} className="muted">{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{clubOf(s.clubId).short}</td>
                  <td className="num muted">{s.gp}</td>
                  <td className="num muted">{s.gf}:{s.ga}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{s.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </Shell>
  );
}
