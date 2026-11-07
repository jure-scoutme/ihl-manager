'use client';
import Link from 'next/link';
import { useState } from 'react';
import { BackLink, Crest, POS_LABEL, Portrait, Shell, ovrColor } from '@/components/ui';
import { useGame } from '@/store/game';
import { useT } from '@/i18n';
import { infraOf } from '@/engine/club';
import { fmtDate } from '@/engine/season';
import { promote, youthStandings, youthTeam, type YouthLeague } from '@/engine/youth';

type Tab = YouthLeague | 'lestvica';

export default function Mladinci() {
  const game = useGame((s) => s.game)!;
  const t = useT();
  const update = useGame((s) => s.update);
  const [tab, setTab] = useState<Tab>('U20');
  const [lg, setLg] = useState<YouthLeague>('U20');
  const [sort, setSort] = useState<'potencial' | 'ocena' | 'tocke'>('potencial');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!game) return <Shell>{null}</Shell>;
  const club = game.clubs.find((c) => c.id === game.userClubId)!;
  const clubOf = (id: string) => game.clubs.find((c) => c.id === id)!;
  const yl = infraOf(game, club.id).youth;
  const seniors = Object.values(game.players).filter((p) => p.clubId === club.id).length;

  const list = tab === 'lestvica' ? [] : youthTeam(game, club.id, tab).sort((a, b) => (sort === 'potencial' ? b.potential - a.potential : sort === 'ocena' ? b.ovr - a.ovr : b.stats.g + b.stats.a - (a.stats.g + a.stats.a)));
  const st = youthStandings(game, lg);
  const nextYouth = (game.youthFixtures ?? []).filter((f) => f.hg === undefined && f.date >= game.date && (f.home === club.id || f.away === club.id)).sort((a, b) => a.date.localeCompare(b.date))[0];
  const lastYouth = (game.youthFixtures ?? []).filter((f) => f.hg !== undefined && (f.home === club.id || f.away === club.id)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const potLabel = (pot: number) => (pot >= 76 ? 'izjemen' : pot >= 69 ? 'visok' : pot >= 62 ? 'srednji' : 'nizek');

  return (
    <Shell>
      <div className="page">
        <BackLink href="/kader" label="Kader" />
        <div className="row">
          <div>
            <h1 className="h title">{t('Mladinska šola')}</h1>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Akademija stopnja {yl}/5 · članski kader {seniors}/30</div>
          </div>
        </div>
        {msg && <div className="card row" style={{ fontSize: 13, color: msg.ok ? 'var(--good)' : 'var(--gold)' }}><span>{msg.text}</span><button className="chip" onClick={() => setMsg(null)}>{t('OK')}</button></div>}

        <div className="seg">
          {([['U20', 'U20'], ['U18', 'U18'], ['lestvica', 'Lige']] as const).map(([k, l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t(l)}</button>
          ))}
        </div>

        {tab !== 'lestvica' && (
          <>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: 12 }}>{t('Razvrsti:')}</span>
              {([['potencial', 'Potencial'], ['ocena', 'Ocena'], ['tocke', 'Točke']] as const).map(([k, l]) => (
                <button key={k} className={`chip ${sort === k ? 'on' : ''}`} style={{ height: 30 }} onClick={() => setSort(k)}>{t(l)}</button>
              ))}
            </div>
            <div className="card" style={{ padding: '4px 14px' }}>
              {list.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Ni igralcev.</p>}
              {list.map((p) => {
                const isG = p.pos === 'G';
                const sv = p.stats.sa ? ((p.stats.sa - p.stats.ga) / p.stats.sa * 100).toFixed(1) : '—';
                return (
                  <div key={p.id} className="list-row" style={{ flexWrap: 'wrap' }}>
                    <Link href={`/igralec?id=${p.id}&from=mladinci`} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                      <Portrait player={p} size={42} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.first} {p.last}</span>
                        <span className="muted" style={{ display: 'flex', gap: 6, fontSize: 12, marginTop: 2, alignItems: 'center' }}>
                          <span className="pill" style={{ height: 18, fontSize: 10 }}>{POS_LABEL[p.pos]}</span>
                          {game.seasonYear - p.birthYear} let · {p.stats.gp} T · {isG ? `${sv} %` : `${p.stats.g}+${p.stats.a}`}
                        </span>
                        <span style={{ display: 'block', fontSize: 11, marginTop: 2, color: p.potential >= 76 ? 'var(--gold)' : p.potential >= 69 ? 'var(--good)' : 'var(--muted)' }}>Potencial: {potLabel(p.potential)}</span>
                      </span>
                      <span className="badge" style={{ background: `color-mix(in srgb, ${ovrColor(p.ovr)} 16%, transparent)`, color: ovrColor(p.ovr) }}>{p.ovr}</span>
                    </Link>
                    <button className="btn sec" style={{ width: '100%', height: 38, fontSize: 13, marginTop: 8 }} onClick={() => update((g) => setMsg(promote(g, p.id)))}>{t('Pokliči v člansko ekipo')}</button>
                  </div>
                );
              })}
            </div>
            <p className="muted" style={{ fontSize: 12, margin: 0, lineHeight: 1.5 }}>Mladinci igrajo svojo ligo vsako nedeljo. Pri 18 letih preidejo iz U18 v U20, pri 21 pa morajo v člansko ekipo, sicer odidejo. Boljša akademija prinese več in boljših talentov.</p>
          </>
        )}

        {tab === 'lestvica' && (
          <>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['U20', 'U18'] as const).map((l) => <button key={l} className={`chip ${lg === l ? 'on' : ''}`} onClick={() => setLg(l)}>Liga {l}</button>)}
            </div>
            <div className="card" style={{ padding: '4px 10px' }}>
              <table className="t">
                <thead><tr><th>#</th><th>{t('Klub')}</th><th className="num">T</th><th className="num">Z</th><th className="num">{t('Goli')}</th><th className="num">Tč</th></tr></thead>
                <tbody>
                  {st.map((s, i) => (
                    <tr key={s.clubId} style={{ background: s.clubId === club.id ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : undefined }}>
                      <td className="muted">{i + 1}</td>
                      <td style={{ fontWeight: 600 }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Crest club={clubOf(s.clubId)} size={22} />{clubOf(s.clubId).short}</span></td>
                      <td className="num">{s.gp}</td><td className="num">{s.w}</td>
                      <td className="num muted">{s.gf}:{s.ga}</td>
                      <td className="num" style={{ fontWeight: 800 }}>{s.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <section className="card" style={{ fontSize: 13 }}>
              <div className="lbl" style={{ marginBottom: 6 }}>Tekme tvojih mladincev</div>
              {lastYouth.map((f) => (
                <div key={f.id} className="row" style={{ padding: '5px 0' }}>
                  <span className="muted" style={{ width: 40 }}>{f.league}</span>
                  <span style={{ flex: 1 }}>{clubOf(f.home).short} – {clubOf(f.away).short}</span>
                  <b>{f.hg}:{f.ag}{f.ot ? ' p' : ''}</b>
                </div>
              ))}
              {nextYouth && <div className="muted" style={{ marginTop: 6 }}>Naslednja tekma: {fmtDate(nextYouth.date)}</div>}
              {!lastYouth.length && !nextYouth && <span className="muted">Mladinska sezona še ni začela.</span>}
            </section>
          </>
        )}
      </div>
    </Shell>
  );
}
