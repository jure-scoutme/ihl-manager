'use client';
import Link from 'next/link';
import { useState } from 'react';
import { POS_LABEL, Portrait, Shell, formColor, ovrColor } from '@/components/ui';
import { useGame } from '@/store/game';
import { useT } from '@/i18n';
import { ageOf } from '@/engine/players';
import { clubPlayers } from '@/engine/season';
import { expiring } from '@/engine/contracts';

type Tab = 'F' | 'D' | 'G' | 'pogodbe';

export default function Kader() {
  const game = useGame((s) => s.game)!;
  const t = useT();
  const [tab, setTab] = useState<Tab>(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'pogodbe' ? 'pogodbe' : 'F'));
  if (!game) return <Shell>{null}</Shell>;
  const roster = clubPlayers(game, game.userClubId);
  const list = roster
    .filter((p) => (tab === 'pogodbe' ? true : tab === 'F' ? ['C', 'LW', 'RW'].includes(p.pos) : p.pos === tab))
    .sort((a, b) => (tab === 'pogodbe' ? a.contractUntil - b.contractUntil || b.ovr - a.ovr : b.ovr - a.ovr));
  const avg = Math.round(roster.reduce((s, p) => s + p.ovr, 0) / roster.length);
  const wages = roster.reduce((s, p) => s + p.wage, 0);
  const exp = new Set(expiring(game).map((p) => p.id));
  const expSoon = (p: { id: string }) => exp.has(p.id);

  return (
    <Shell>
      <header style={{ padding: '18px 16px 0' }} className="row">
        <div>
          <h1 className="h title">{t('Kader')}</h1>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{roster.length} {t('igralcev')} · {t('povp. ocena')} {avg} · {t('plače')} {wages.toLocaleString('sl-SI')} {t('€/mes')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}><Link href="/mladinci" className="btn sec" style={{ display: 'flex', alignItems: 'center', padding: '0 12px' }}>{t('Mladinci')}</Link><Link href="/trening" className="btn sec" style={{ display: 'flex', alignItems: 'center', padding: '0 12px' }}>{t('Trening')}</Link><Link href="/postave" className="btn" style={{ display: 'flex', alignItems: 'center', padding: '0 14px' }}>{t('Postave')}</Link></div>
      </header>
      <div className="page">
        <div className="seg">
          {([['F', 'Napadalci'], ['D', 'Branilci'], ['G', 'Golmani'], ['pogodbe', 'Pogodbe']] as const).map(([k, l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t(l)}</button>
          ))}
        </div>
        {tab === 'pogodbe' && <p className="muted" style={{ fontSize: 12, margin: 0 }}>{t('Pogodbe potečejo 30. junija. Igralci, označeni z rumeno, odidejo brez odškodnine, če jim pogodbe ne podaljšaš (na strani igralca).')}</p>}
        <div className="card" style={{ padding: '4px 14px' }}>
          {list.map((p) => {
            const sv = p.stats.sa ? ((p.stats.sa - p.stats.ga) / p.stats.sa).toFixed(3).slice(1) : '—';
            return (
              <Link key={p.id} href={`/igralec?id=${p.id}`} className="list-row">
                <Portrait player={p} size={42} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 14 }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.first} {p.last}{p.homegrown === game.userClubId ? ' 🎓' : ''}</span>
                    {p.potential - p.ovr >= 6 && <span style={{ color: 'var(--good)', fontSize: 11 }}>▲</span>}
                  </span>
                  <span className="muted" style={{ display: 'flex', gap: 6, fontSize: 12, marginTop: 2, alignItems: 'center' }}>
                    <span className="pill" style={{ height: 18, fontSize: 10 }}>{POS_LABEL[p.pos]}</span>
                    #{p.number} · {ageOf(p, game.seasonYear)} {t('let ·')} {tab === 'G' ? `${sv} %` : `${p.stats.g + p.stats.a} ${t('tč')}`}
                    {p.injuryDays > 0 && <span style={{ color: 'var(--bad)' }}>{t('· poškodba')}</span>}
                    {tab === 'pogodbe' && <span style={{ color: expSoon(p) ? 'var(--gold)' : undefined, fontWeight: expSoon(p) ? 700 : 400 }}>· {t('do {y}', { y: p.contractUntil })} · {p.wage} €</span>}
                  </span>
                </span>
                <span className="dot" style={{ background: p.injuryDays > 0 ? '#4a5a78' : formColor(p.form) }} />
                <span className="badge" style={{ background: `color-mix(in srgb, ${ovrColor(p.ovr)} 16%, transparent)`, color: ovrColor(p.ovr) }}>{p.ovr}</span>
              </Link>
            );
          })}
        </div>
        <div className="muted" style={{ fontSize: 11, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <span><span className="dot" style={{ background: 'var(--good)' }} /> {t('dobra forma')}</span>
          <span><span className="dot" style={{ background: 'var(--gold)' }} /> {t('povprečna')}</span>
          <span><span className="dot" style={{ background: 'var(--orange)' }} /> {t('slaba')}</span>
          <span><span style={{ color: 'var(--good)' }}>▲</span> {t('velik potencial')}</span>
          <span>{t('T = točke')}</span>
        </div>
      </div>
    </Shell>
  );
}
