'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Bar, Crest, Icon, SectionTitle, Shell, eur, heroBg } from '@/components/ui';
import { Decisions } from '@/components/Decisions';
import { hasBlocking } from '@/engine/events';
import { useGame } from '@/store/game';
import { clubPlayers, fmtDate, nextUserFixture, quickSim, seasonLabel, standings, startNewSeason, userFixtureToday, type DevChange } from '@/engine/season';

const NEWS_ICON: Record<string, string> = { tekma: 'play', garderoba: 'users', uprava: 'building', liga: 'trophy', prestopi: 'swap', mediji: 'news', klub: 'building' };
const NEWS_COLOR: Record<string, string> = { tekma: 'var(--accent)', garderoba: 'var(--gold)', uprava: '#c08cff', liga: 'var(--good)', prestopi: 'var(--accent2)', mediji: 'var(--orange)', klub: 'var(--muted)' };
const NEWS_LABEL: Record<string, string> = { tekma: 'Tekma', garderoba: 'Slačilnica', uprava: 'Uprava', liga: 'Liga', prestopi: 'Prestopi', mediji: 'Mediji', klub: 'Klub' };

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
  const fin = game.finance?.[club.id];
  const blocked = hasBlocking(game);
  const last5 = game.fixtures
    .filter((f) => f.played && (f.home === club.id || f.away === club.id))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .reverse()
    .map((f) => {
      const us = f.home === club.id;
      const my = us ? f.result!.hg : f.result!.ag;
      const op = us ? f.result!.ag : f.result!.hg;
      return { won: my > op, txt: `${my}:${op}`, id: f.id };
    });
  const stageLabel = (s: string) => (s === 'redni' ? 'Redni del' : s === 'cetrtfinale' ? 'Četrtfinale' : s === 'polfinale' ? 'Polfinale' : 'Finale');
  const unread = game.news.filter((n) => !n.read).length;

  return (
    <Shell>
      <header style={{ padding: '16px 16px 4px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Crest club={club} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{fmtDate(game.date)}</div>
          <div className="h" style={{ fontSize: 20, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{club.name}</div>
        </div>
        <Link href="/koledar" className="icon-btn" aria-label="Koledar"><Icon name="calendar" /></Link>
      </header>

      <div className="page">
        <Decisions />

        {game.phase === 'konec' && (
          <section className="hero" style={{ background: heroBg(clubOf(game.champion!).color) }}>
            <div className="lbl" style={{ color: 'rgba(255,255,255,.75)' }}>Konec sezone {seasonLabel(game.seasonYear)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '12px 0' }}>
              <Crest club={clubOf(game.champion!)} size={56} />
              <div><div style={{ fontSize: 13, opacity: 0.8 }}>Prvak IHL</div><div className="h" style={{ fontSize: 28 }}>{clubOf(game.champion!).short}</div></div>
            </div>
            <p style={{ fontSize: 13, margin: '0 0 14px', opacity: 0.85 }}>Redni del ste končali na {myPos}. mestu. Cilj uprave: {club.boardGoal}.</p>
            <button className="btn white block" onClick={() => update((g) => setSummary(startNewSeason(g)))}>Začni sezono {seasonLabel(game.seasonYear + 1)}</button>
          </section>
        )}

        {summary && (
          <section className="card">
            <div className="row"><span className="lbl">Razvoj igralcev čez poletje</span><button className="chip" onClick={() => setSummary(null)}>Zapri</button></div>
            {summary.changes.sort((a, b) => b.after - b.before - (a.after - a.before)).slice(0, 10).map((c) => (
              <div key={c.playerId} className="list-row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                <span>{c.name} · {c.age}<br /><span className="muted" style={{ fontSize: 11 }}>{c.reason}</span></span>
                <span><span className="muted">{c.before} → {c.after} </span><b style={{ color: c.after > c.before ? 'var(--good)' : 'var(--bad)' }}>{c.after > c.before ? '+' : ''}{c.after - c.before}</b></span>
              </div>
            ))}
            {summary.retired.length > 0 && <p style={{ fontSize: 13 }}><span className="lbl">Upokojitve: </span>{summary.retired.join(', ')}</p>}
            {summary.youth.length > 0 && <p style={{ fontSize: 13 }}><span className="lbl">Novi mladinci: </span>{summary.youth.join(', ')}</p>}
          </section>
        )}

        {next && (
          <section className="hero" style={{ background: heroBg(clubOf(next.home).color, clubOf(next.away).color) }}>
            <div className="row">
              <span className="pill" style={{ background: 'rgba(255,255,255,.18)' }}>{today ? 'DANES' : stageLabel(next.stage).toUpperCase()}</span>
              <span style={{ fontSize: 12, opacity: 0.85, fontWeight: 600 }}>{today ? stageLabel(next.stage) : fmtDate(next.date)}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', margin: '18px 0 14px', gap: 8 }}>
              {[next.home, 'vs', next.away].map((id) =>
                id === 'vs' ? (
                  <div key="vs" className="score" style={{ fontSize: 22, opacity: 0.7 }}>VS</div>
                ) : (
                  <Link key={id} href={id === club.id ? '/kader' : `/ekipa?id=${id}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <Crest club={clubOf(id)} size={60} />
                    <div className="h" style={{ fontSize: 16, textAlign: 'center' }}>{clubOf(id).short}</div>
                    <div style={{ fontSize: 11, opacity: 0.75 }}>{st.findIndex((s) => s.clubId === id) + 1}. mesto · {st.find((s) => s.clubId === id)!.pts} tč</div>
                  </Link>
                ),
              )}
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, textAlign: 'center' }}>{clubOf(next.home).arena.name}, {clubOf(next.home).arena.city} · {clubOf(next.home).arena.capacity} mest</div>
            {today && (
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="btn white" style={{ flex: 1 }} onClick={() => router.push('/tekma')}>▶ Igraj v živo</button>
                <button className="btn glass" style={{ flex: 1 }} onClick={() => update((g) => { const f = g.fixtures.find((x) => x.id === today.id)!; quickSim(g, f); })}>Hitra simulacija</button>
              </div>
            )}
          </section>
        )}

        <div className="tiles">
          <Link href="/liga" className="tile"><span className="k">Mesto</span><span className="v">{myPos}.</span><span className="k">{st[myPos - 1]?.pts ?? 0} točk</span></Link>
          <Link href="/kader" className="tile"><span className="k">Morala</span><span className="v" style={{ color: morale >= 70 ? 'var(--good)' : morale < 50 ? 'var(--bad)' : undefined }}>{morale}%</span><span className="k">{injured ? `${injured} poškodovanih` : 'vsi zdravi'}</span></Link>
          <Link href="/finance" className="tile"><span className="k">Račun</span><span className="v" style={{ fontSize: 22, paddingTop: 4, color: (fin?.balance ?? 0) < 0 ? 'var(--bad)' : undefined }}>{fin ? `${Math.round(fin.balance / 1000)}k €` : '—'}</span><span className="k">{fin ? eur(fin.balance) : ''}</span></Link>
        </div>

        <section className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            <span className="lbl">Forma</span>
            <div style={{ display: 'flex', gap: 5 }}>
              {last5.length === 0 && <span className="muted" style={{ fontSize: 12 }}>še ni tekem</span>}
              {last5.map((r) => (
                <Link key={r.id} href={`/porocilo?id=${r.id}`} className="pill" style={{ background: r.won ? 'rgba(61,220,151,.16)' : 'rgba(255,122,107,.16)', color: r.won ? 'var(--good)' : 'var(--bad)', height: 26 }}>{r.txt}</Link>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', fontSize: 12 }}>
            {[
              ['Svežina', energy, energy < 70 ? 'var(--gold)' : undefined],
              ['Morala', morale, undefined],
              ['Navijači', Math.round(game.fans ?? 50), 'var(--good)'],
              ['Uprava', Math.round(game.board ?? 55), (game.board ?? 55) < 30 ? 'var(--bad)' : 'var(--gold)'],
            ].map(([l, v, c]) => (
              <div key={l as string}>
                <div className="row" style={{ marginBottom: 5 }}><span className="muted" style={{ fontWeight: 600 }}>{l}</span><span style={{ fontWeight: 700 }}>{v}%</span></div>
                <Bar value={v as number} color={c as string | undefined} />
              </div>
            ))}
          </div>
        </section>

        <SectionTitle title={`Pošta${unread ? ` · ${unread}` : ''}`} />
        <section className="card" style={{ padding: '6px 16px' }}>
          {game.news.slice(0, 6).map((n) => (
            <div key={n.id} style={{ borderTop: '1px solid var(--line)' }}>
              <button onClick={() => { setOpenNews(openNews === n.id ? null : n.id); if (!n.read) update((g) => { const x = g.news.find((y) => y.id === n.id); if (x) x.read = true; }); }} style={{ display: 'flex', gap: 12, padding: '12px 0', background: 'none', border: 0, color: 'var(--text)', width: '100%', textAlign: 'left', cursor: 'pointer', alignItems: 'flex-start' }}>
                <span style={{ width: 36, height: 36, borderRadius: 12, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: NEWS_COLOR[n.kind], background: `color-mix(in srgb, ${NEWS_COLOR[n.kind]} 16%, transparent)` }} aria-hidden="true"><Icon name={NEWS_ICON[n.kind]} size={18} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: n.read ? 500 : 700 }}>{n.title}</span>
                    {!n.read && <span className="dot" style={{ background: 'var(--accent)', marginTop: 6, flex: 'none' }} />}
                  </span>
                  <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>{NEWS_LABEL[n.kind]} · {fmtDate(n.date)}</span>
                  {openNews === n.id && <span style={{ display: 'block', fontSize: 13, marginTop: 8, lineHeight: 1.55, color: '#d6deec' }}>{n.body}</span>}
                </span>
              </button>
              {openNews === n.id && n.fixtureId && <Link href={`/porocilo?id=${n.fixtureId}`} style={{ display: 'block', margin: '-4px 0 12px 48px', fontSize: 13, fontWeight: 600, color: 'var(--accent2)' }}>Poročilo s tekme →</Link>}
            </div>
          ))}
        </section>

        <SectionTitle title="Lestvica" href="/liga" />
        <section className="card" style={{ padding: '4px 10px' }}>
          <table className="t">
            <tbody>
              {st.map((s, i) => (
                <tr key={s.clubId} style={{ background: s.clubId === club.id ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : undefined }}>
                  <td style={{ width: 24, borderTop: i ? undefined : 0 }} className="muted">{i + 1}</td>
                  <td style={{ fontWeight: 600, borderTop: i ? undefined : 0 }}><Link href={s.clubId === club.id ? '/kader' : `/ekipa?id=${s.clubId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Crest club={clubOf(s.clubId)} size={24} />{clubOf(s.clubId).short}</Link></td>
                  <td className="num muted" style={{ borderTop: i ? undefined : 0 }}>{s.gp}</td>
                  <td className="num muted" style={{ borderTop: i ? undefined : 0 }}>{s.gf}:{s.ga}</td>
                  <td className="num" style={{ fontWeight: 800, borderTop: i ? undefined : 0 }}>{s.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {!today && game.phase !== 'konec' && <div style={{ height: 64 }} />}
      {!today && game.phase !== 'konec' && (
        <div className="cta">
          <button className="btn block" onClick={() => continueGame()} disabled={blocked} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{blocked ? 'Najprej sprejmi odločitev' : 'Nadaljuj'}</span>
            <span style={{ fontSize: 12, opacity: 0.85, fontWeight: 600 }}>{next ? `tekma ${fmtDate(next.date).replace(/ \d{4}$/, '')}` : ''} ›</span>
          </button>
        </div>
      )}
    </Shell>
  );
}
