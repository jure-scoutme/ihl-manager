'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BackLink, Crest, POS_LABEL, Portrait, Shell, eur, heroBg, ovrColor } from '@/components/ui';
import { useGame } from '@/store/game';
import { shownOvr } from '@/engine/scouting';
import { ROLES, ROLE_LABEL, staffOf } from '@/engine/staff';
import { useT } from '@/i18n';
import { ageOf } from '@/engine/players';
import { fmtDate, standings } from '@/engine/season';
import { transferValue } from '@/engine/transfers';

type Tab = 'F' | 'D' | 'G';

function Ekipa() {
  const game = useGame((s) => s.game)!;
  const t = useT();
  const id = useSearchParams().get('id') ?? '';
  const [tab, setTab] = useState<Tab>('F');
  if (!game) return null;
  const club = game.clubs.find((c) => c.id === id);
  if (!club) return <div className="page"><BackLink href="/liga" label="Liga" /><p>{t('Klub ne obstaja.')}</p></div>;
  if (club.id === game.userClubId) {
    return <div className="page"><BackLink href="/liga" label="Liga" /><p>{t('To je tvoj klub.')} <Link href="/kader" style={{ color: 'var(--accent2)' }}>{t('Odpri kader')}</Link></p></div>;
  }
  const st = standings(game);
  const pos = st.findIndex((s) => s.clubId === club.id) + 1;
  const row = st.find((s) => s.clubId === club.id)!;
  const roster = Object.values(game.players).filter((p) => p.clubId === club.id);
  const list = roster.filter((p) => (tab === 'F' ? ['C', 'LW', 'RW'].includes(p.pos) : p.pos === tab)).sort((a, b) => b.ovr - a.ovr);
  const avg = Math.round(roster.reduce((s, p) => s + shownOvr(game, p).value, 0) / Math.max(1, roster.length));
  const top = [...roster].filter((p) => p.pos !== 'G').sort((a, b) => b.stats.g + b.stats.a - (a.stats.g + a.stats.a))[0];
  const next = game.fixtures.filter((f) => !f.played && (f.home === club.id || f.away === club.id)).sort((a, b) => a.date.localeCompare(b.date))[0];
  const clubOf = (cid: string) => game.clubs.find((c) => c.id === cid)!;

  return (
    <div className="page">
      <BackLink href="/liga" label="Liga" />
      <section className="hero" style={{ background: heroBg(club.color) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Crest club={club} size={64} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="h" style={{ fontSize: 24, lineHeight: 1.1 }}>{club.name}</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{club.arena.name}, {club.city} · {club.arena.capacity} {t('mest')}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
          {[[`${pos}.`, 'mesto'], [row.pts, 'točk'], [avg, 'povp. ocena']].map(([v, l]) => (
            <div key={l as string} style={{ background: 'rgba(0,0,0,.22)', borderRadius: 14, padding: '8px 10px' }}>
              <div className="score" style={{ fontSize: 24, lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>{t(l)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ fontSize: 13 }}>
        <div className="row"><span className="muted">{t('Tekme')}</span><span>{row.gp} · {row.w + row.otw} {t('zmag ·')} {row.gf}:{row.ga}</span></div>
        {top && <div className="row"><span className="muted">{t('Najboljši strelec')}</span><span>{top.first} {top.last} · {top.stats.g + top.stats.a} {t('tč')}</span></div>}
        {next && <div className="row"><span className="muted">{t('Naslednja tekma')}</span><span>{fmtDate(next.date).replace(/ \d{4}$/, '')} · {next.home === club.id ? t('doma') : '@'} {clubOf(next.home === club.id ? next.away : next.home).name}</span></div>}
        <div className="row"><span className="muted">{t('Cilj uprave')}</span><span>{t(club.boardGoal)}</span></div>
      </section>

      <section className="card" style={{ fontSize: 13 }}>
        <div className="lbl" style={{ marginBottom: 6 }}>{t('Strokovni štab')}</div>
        {ROLES.map((r) => {
          const s = staffOf(game, club.id, r);
          return (
            <div key={r} className="row">
              <span className="muted">{t(ROLE_LABEL[r])}</span>
              <span>{s ? `${s.first} ${s.last} · ${s.rep}` : t('prosto mesto')}</span>
            </div>
          );
        })}
      </section>

      <div className="seg">
        {([['F', 'Napadalci'], ['D', 'Branilci'], ['G', 'Golmani']] as const).map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t(l)}</button>
        ))}
      </div>

      <div className="card" style={{ padding: '4px 14px' }}>
        {list.map((p) => (
          <Link key={p.id} href={`/igralec?id=${p.id}&from=ekipa&club=${club.id}`} className="list-row">
            <Portrait player={p} size={42} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.first} {p.last}{p.listed && <span style={{ color: 'var(--gold)', fontSize: 11 }}> {t('· naprodaj')}</span>}</span>
              <span className="muted" style={{ display: 'flex', gap: 6, fontSize: 12, marginTop: 2, alignItems: 'center' }}>
                <span className="pill" style={{ height: 18, fontSize: 10 }}>{POS_LABEL[p.pos]}</span>
                {ageOf(p, game.seasonYear)} {t('let ·')} {p.pos === 'G' ? `${p.stats.gp} ${t('T')}` : `${p.stats.g + p.stats.a} ${t('tč')}`} · ~{eur(transferValue(game, p))}
              </span>
            </span>
            <span className="badge" style={{ background: `color-mix(in srgb, ${ovrColor(shownOvr(game, p).value)} 16%, transparent)`, color: ovrColor(shownOvr(game, p).value) }}>{shownOvr(game, p).exact ? '' : '~'}{shownOvr(game, p).value}</span>
          </Link>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>{t('Klikni igralca, da mu pogledaš profil in klubu pošlješ ponudbo.')}</p>
    </div>
  );
}

export default function EkipaPage() {
  return (
    <Shell>
      <Suspense fallback={null}>
        <Ekipa />
      </Suspense>
    </Shell>
  );
}
