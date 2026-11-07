'use client';
import Link from 'next/link';
import { Tutorial } from '@/components/Tutorial';
import { ACHIEVEMENTS } from '@/engine/achievements';
import { expiring, transferWindow } from '@/engine/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Bar, Crest, Icon, SectionTitle, Shell, eur, heroBg } from '@/components/ui';
import { Decisions } from '@/components/Decisions';
import { ContinueOverlay } from '@/components/ContinueOverlay';
import { hasBlocking } from '@/engine/events';
import { useGame } from '@/store/game';
import { useT } from '@/i18n';
import { clubPlayers, fmtDate, nextUserFixture, quickSim, seasonLabel, standings, startNewSeason, userFixtureToday, type DevChange } from '@/engine/season';

const NEWS_ICON: Record<string, string> = { tekma: 'play', garderoba: 'users', uprava: 'building', liga: 'trophy', prestopi: 'swap', mediji: 'news', klub: 'building' };
const NEWS_COLOR: Record<string, string> = { tekma: 'var(--accent)', garderoba: 'var(--gold)', uprava: '#c08cff', liga: 'var(--good)', prestopi: 'var(--accent2)', mediji: 'var(--orange)', klub: 'var(--muted)' };
const NEWS_LABEL: Record<string, string> = { tekma: 'Tekma', garderoba: 'Slačilnica', uprava: 'Uprava', liga: 'Liga', prestopi: 'Prestopi', mediji: 'Mediji', klub: 'Klub' };

export default function Domov() {
  const game = useGame((s) => s.game)!;
  const t = useT();
  const update = useGame((s) => s.update);
  const router = useRouter();
  const [summary, setSummary] = useState<{ changes: DevChange[]; retired: string[]; youth: string[] } | null>(null);
  const [showFans, setShowFans] = useState(false);
  const [openNews, setOpenNews] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
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
  const stageLabel = (s: string) => (s === 'redni' ? 'Redni del' : s === 'cetrtfinale' ? 'Četrtfinale' : s === 'polfinale' ? 'Polfinale' : s === 'prijateljska' ? 'Prijateljska tekma' : 'Finale');
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
        <Tutorial />
        <Decisions />

        {game.phase === 'konec' && (
          <section className="hero" style={{ background: heroBg(clubOf(game.champion!).color) }}>
            <div className="lbl" style={{ color: 'rgba(255,255,255,.75)' }}>{t('Konec sezone')} {seasonLabel(game.seasonYear)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '12px 0' }}>
              <Crest club={clubOf(game.champion!)} size={56} />
              <div><div style={{ fontSize: 13, opacity: 0.8 }}>{t('Prvak IHL')}</div><div className="h" style={{ fontSize: 28 }}>{clubOf(game.champion!).short}</div></div>
            </div>
            <p style={{ fontSize: 13, margin: '0 0 14px', opacity: 0.85 }}>{t('Redni del ste končali na {p}. mestu. Cilj uprave: {g}.', { p: myPos, g: t(club.boardGoal) })}</p>
            {game.lastAwards && (
              <div style={{ background: 'rgba(0,0,0,.22)', borderRadius: 14, padding: '10px 12px', marginBottom: 12, fontSize: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>🏅 {t('Nagrade')} {game.lastAwards.season}</div>
                {game.lastAwards.list.map((aw) => <div key={aw.key} className="row" style={{ padding: '1px 0' }}><span style={{ opacity: 0.8 }}>{t(aw.title)}</span><span style={{ fontWeight: 600 }}>{aw.name} · {clubOf(aw.clubId).short}</span></div>)}
              </div>
            )}
            <button className="btn white block" onClick={() => update((g) => setSummary(startNewSeason(g)))}>{t('Naprej v poletje')} {game.seasonYear + 1} ›</button>
          </section>
        )}

        {summary && (
          <section className="card">
            <div className="row"><span className="lbl">{t('Razvoj igralcev čez poletje')}</span><button className="chip" onClick={() => setSummary(null)}>{t('Zapri')}</button></div>
            {summary.changes.sort((a, b) => b.after - b.before - (a.after - a.before)).slice(0, 10).map((c) => (
              <div key={c.playerId} className="list-row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                <span>{c.name} · {c.age}<br /><span className="muted" style={{ fontSize: 11 }}>{t(c.reason)}</span></span>
                <span><span className="muted">{c.before} → {c.after} </span><b style={{ color: c.after > c.before ? 'var(--good)' : 'var(--bad)' }}>{c.after > c.before ? '+' : ''}{c.after - c.before}</b></span>
              </div>
            ))}
            {summary.retired.length > 0 && <p style={{ fontSize: 13 }}><span className="lbl">{t('Upokojitve:')} </span>{summary.retired.join(', ')}</p>}
            {summary.youth.length > 0 && <p style={{ fontSize: 13 }}><span className="lbl">{t('Novi mladinci:')} </span>{summary.youth.join(', ')}</p>}
          </section>
        )}

        {game.phase === 'poletje' && (
          <section className="card">
            <div className="row"><span className="lbl">{t('Poletje')} {game.seasonYear}</span><span className="pill" style={{ height: 24, background: transferWindow(game).open ? 'rgba(61,220,151,.16)' : 'rgba(255,255,255,.08)', color: transferWindow(game).open ? 'var(--good)' : undefined }}>{t(transferWindow(game).open ? 'Prestopni rok odprt' : 'Prestopni rok zaprt')}</span></div>
            <p style={{ fontSize: 13, margin: '8px 0 10px', lineHeight: 1.5 }}>{t('Sestavi ekipo za novo sezono: podaljšaj pogodbe, poišči okrepitve in izberi sponzorja. Pogodbe potečejo 30. junija, prijateljske tekme so v avgustu.')}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link href="/kader?tab=pogodbe" className="btn sec" style={{ flex: 1, height: 40, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t('Pogodbe')} ({expiring(game).length})</Link>
              <Link href="/prestopi" className="btn sec" style={{ flex: 1, height: 40, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t('Prestopi')}</Link>
            </div>
          </section>
        )}

        {next && (
          <section className="hero" style={{ background: heroBg(clubOf(next.home).color, clubOf(next.away).color) }}>
            <div className="row">
              <span className="pill" style={{ background: 'rgba(255,255,255,.18)' }}>{today ? t('DANES') : t(stageLabel(next.stage)).toUpperCase()}</span>
              <span style={{ fontSize: 12, opacity: 0.85, fontWeight: 600 }}>{today ? t(stageLabel(next.stage)) : fmtDate(next.date)}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', margin: '18px 0 14px', gap: 8 }}>
              {[next.home, 'vs', next.away].map((id) =>
                id === 'vs' ? (
                  <div key="vs" className="score" style={{ fontSize: 22, opacity: 0.7 }}>VS</div>
                ) : (
                  <Link key={id} href={id === club.id ? '/kader' : `/ekipa?id=${id}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <Crest club={clubOf(id)} size={60} />
                    <div className="h" style={{ fontSize: 16, textAlign: 'center' }}>{clubOf(id).short}</div>
                    <div style={{ fontSize: 11, opacity: 0.75 }}>{st.findIndex((s) => s.clubId === id) + 1}. {t('mesto ·')} {st.find((s) => s.clubId === id)!.pts} {t('tč')}</div>
                  </Link>
                ),
              )}
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, textAlign: 'center' }}>{clubOf(next.home).arena.name}, {clubOf(next.home).arena.city} · {clubOf(next.home).arena.capacity} {t('mest')}</div>
            {today && (
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="btn white" style={{ flex: 1 }} onClick={() => router.push('/tekma')}>{t('▶ Igraj v živo')}</button>
                <button className="btn glass" style={{ flex: 1 }} onClick={() => update((g) => { const f = g.fixtures.find((x) => x.id === today.id)!; quickSim(g, f); })}>{t('Hitra simulacija')}</button>
              </div>
            )}
          </section>
        )}

        <div className="tiles">
          <Link href="/liga" className="tile"><span className="k">{t('Mesto')}</span><span className="v">{myPos}.</span><span className="k">{st[myPos - 1]?.pts ?? 0} {t('točk')}</span></Link>
          <Link href="/kader" className="tile"><span className="k">{t('Morala')}</span><span className="v" style={{ color: morale >= 70 ? 'var(--good)' : morale < 50 ? 'var(--bad)' : undefined }}>{morale}%</span><span className="k">{injured ? `${injured} ${t('poškodovanih')}` : t('vsi zdravi')}</span></Link>
          <Link href="/finance" className="tile"><span className="k">{t('Račun')}</span><span className="v" style={{ fontSize: 22, paddingTop: 4, color: (fin?.balance ?? 0) < 0 ? 'var(--bad)' : undefined }}>{fin ? `${Math.round(fin.balance / 1000)}k €` : '—'}</span><span className="k">{fin ? eur(fin.balance) : ''}</span></Link>
        </div>

        {game.challenge && (
          <section className="card row" style={{ padding: '12px 16px', borderColor: game.challenge.done ? 'var(--good)' : game.challenge.failed ? undefined : 'var(--gold)', opacity: game.challenge.failed ? 0.55 : 1 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>{game.challenge.done ? '✅' : game.challenge.failed ? '❌' : '🎯'}</span>
              <span>
                <span className="lbl" style={{ display: 'block' }}>{t('Izziv tedna')}</span>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{t(game.challenge.text)}</span>
                <span className="muted" style={{ display: 'block', fontSize: 11 }}>{t('Nagrada')}: {game.challenge.reward.money ? eur(game.challenge.reward.money) : game.challenge.reward.board ? t('+{n} % zaupanja uprave', { n: game.challenge.reward.board }) : t('+{n} % podpore navijačev', { n: game.challenge.reward.fans ?? 0 })} · {t('do')} {fmtDate(game.challenge.end).replace(/ \d{4}$/, '')}</span>
              </span>
            </span>
          </section>
        )}

        {(game.fanFeed ?? []).length > 0 && (
          <section className="card" style={{ padding: '12px 14px' }}>
            <div className="row" style={{ marginBottom: 6 }}><span className="lbl">💬 {t('Navijači')}</span><span className="muted" style={{ fontSize: 11 }}>{t('podpora')} {Math.round(game.fans ?? 50)} %</span></div>
            {(game.fanFeed ?? []).slice(0, showFans ? 10 : 3).map((f, i) => (
              <div key={i} style={{ padding: '6px 0', borderTop: i ? '1px solid rgba(255,255,255,.06)' : undefined }}>
                <div style={{ fontSize: 11, color: f.mood < 0 ? 'var(--bad)' : f.mood > 0 ? 'var(--good)' : 'var(--muted)', fontWeight: 700 }}>{f.handle}</div>
                <div style={{ fontSize: 13, lineHeight: 1.4 }}>{t(f.tpl, Object.fromEntries(f.args.map((a, k) => [String(k), a])))}</div>
              </div>
            ))}
            {(game.fanFeed ?? []).length > 3 && <button className="chip" style={{ marginTop: 6 }} onClick={() => setShowFans(!showFans)}>{showFans ? t('Manj') : t('Več')}</button>}
          </section>
        )}

        <Link href="/zgodovina?tab=dosezki" className="card row" style={{ textDecoration: 'none', color: 'inherit', padding: '12px 16px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🏆</span>
            <span><span className="lbl" style={{ display: 'block' }}>{t('Dosežki')}</span><span style={{ fontSize: 13, fontWeight: 600 }}>{(game.achievements ?? []).length} / {ACHIEVEMENTS.length}</span></span>
          </span>
          <span className="muted" style={{ fontSize: 12 }}>{(() => { const last = (game.achievements ?? []).slice(-1)[0]; const d = last && ACHIEVEMENTS.find((a) => a.id === last.id); return d ? `${d.icon} ${t(d.title)}` : t('Prvi dosežek te čaka'); })()} ›</span>
        </Link>

        <section className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            <span className="lbl">{t('Forma')}</span>
            <div style={{ display: 'flex', gap: 5 }}>
              {last5.length === 0 && <span className="muted" style={{ fontSize: 12 }}>{t('še ni tekem')}</span>}
              {last5.map((r) => (
                <Link key={r.id} href={`/porocilo?id=${r.id}`} className="pill" style={{ background: r.won ? 'rgba(61,220,151,.16)' : 'rgba(255,122,107,.16)', color: r.won ? 'var(--good)' : 'var(--bad)', height: 26 }}>{r.txt}</Link>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', fontSize: 12 }}>
            {[
              [t('Svežina'), energy, energy < 70 ? 'var(--gold)' : undefined],
              [t('Morala'), morale, undefined],
              [t('Navijači'), Math.round(game.fans ?? 50), 'var(--good)'],
              [t('Uprava'), Math.round(game.board ?? 55), (game.board ?? 55) < 30 ? 'var(--bad)' : 'var(--gold)'],
            ].map(([l, v, c]) => (
              <div key={l as string}>
                <div className="row" style={{ marginBottom: 5 }}><span className="muted" style={{ fontWeight: 600 }}>{t(l)}</span><span style={{ fontWeight: 700 }}>{v}%</span></div>
                <Bar value={v as number} color={c as string | undefined} />
              </div>
            ))}
          </div>
        </section>

        <SectionTitle title={`${t('Pošta')}${unread ? ` · ${unread}` : ''}`} />
        <section className="card" style={{ padding: '6px 16px' }}>
          {game.news.slice(0, 6).map((n) => (
            <div key={n.id} style={{ borderTop: '1px solid var(--line)' }}>
              <button onClick={() => { setOpenNews(openNews === n.id ? null : n.id); if (!n.read) update((g) => { const x = g.news.find((y) => y.id === n.id); if (x) x.read = true; }); }} style={{ display: 'flex', gap: 12, padding: '12px 0', background: 'none', border: 0, color: 'var(--text)', width: '100%', textAlign: 'left', cursor: 'pointer', alignItems: 'flex-start' }}>
                <span style={{ width: 36, height: 36, borderRadius: 12, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: NEWS_COLOR[n.kind], background: `color-mix(in srgb, ${NEWS_COLOR[n.kind]} 16%, transparent)` }} aria-hidden="true"><Icon name={NEWS_ICON[n.kind]} size={18} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: n.read ? 500 : 700 }}>{t(n.title)}</span>
                    {!n.read && <span className="dot" style={{ background: 'var(--accent)', marginTop: 6, flex: 'none' }} />}
                  </span>
                  <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>{t(NEWS_LABEL[n.kind])} · {fmtDate(n.date)}</span>
                  {openNews === n.id && <span style={{ display: 'block', fontSize: 13, marginTop: 8, lineHeight: 1.55, color: '#d6deec' }}>{t(n.body)}</span>}
                </span>
              </button>
              {openNews === n.id && n.fixtureId && <Link href={`/porocilo?id=${n.fixtureId}`} style={{ display: 'block', margin: '-4px 0 12px 48px', fontSize: 13, fontWeight: 600, color: 'var(--accent2)' }}>{t('Poročilo s tekme →')}</Link>}
            </div>
          ))}
        </section>

        <SectionTitle title={t('Lestvica')} href="/liga" link={t('Vse')} />
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

      {running && <ContinueOverlay onClose={() => setRunning(false)} />}
      {!today && game.phase !== 'konec' && <div style={{ height: 64 }} />}
      {!today && game.phase !== 'konec' && (
        <div className="cta">
          <button className="btn block" onClick={() => setRunning(true)} disabled={blocked} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{blocked ? t('Najprej sprejmi odločitev') : t('Nadaljuj')}</span>
            <span style={{ fontSize: 12, opacity: 0.85, fontWeight: 600 }}>{next ? `${t('tekma')} ${fmtDate(next.date).replace(/ \d{4}$/, '')}` : ''} ›</span>
          </button>
        </div>
      )}
    </Shell>
  );
}
