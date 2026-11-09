'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BackLink, Icon, Shell } from '@/components/ui';
import { useGame } from '@/store/game';
import { useT } from '@/i18n';
import { fmtDate } from '@/engine/season';
import type { NewsItem } from '@/engine/types';

const NEWS_ICON: Record<string, string> = { tekma: 'play', garderoba: 'users', uprava: 'building', liga: 'trophy', prestopi: 'swap', mediji: 'news', klub: 'shirt' };
const NEWS_COLOR: Record<string, string> = { tekma: 'var(--accent)', garderoba: 'var(--gold)', uprava: '#c08cff', liga: 'var(--good)', prestopi: 'var(--accent2)', mediji: 'var(--orange)', klub: '#8fa3c0' };
const NEWS_LABEL: Record<string, string> = { tekma: 'Tekma', garderoba: 'Slačilnica', uprava: 'Uprava', liga: 'Liga', prestopi: 'Prestopi', mediji: 'Mediji', klub: 'Klub' };
const FROM: Record<string, string> = { tekma: 'Pomočnik trenerja', garderoba: 'Pomočnik trenerja', uprava: 'Uprava kluba', liga: 'Liga IHL', prestopi: 'Športni direktor', mediji: 'Mediji', klub: 'Klub' };
const FILTERS: [string, string][] = [['vse', 'Vse'], ['pomembno', 'Pomembno'], ['tekma', 'Tekme'], ['liga', 'Liga'], ['prestopi', 'Prestopi'], ['garderoba', 'Slačilnica'], ['klub', 'Klub'], ['uprava', 'Uprava'], ['mediji', 'Mediji']];

const paras = (b: string) => b.split(/\n\n+/).filter(Boolean);

function Badge({ kind, size = 40 }: { kind: string; size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.32, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: NEWS_COLOR[kind], background: `color-mix(in srgb, ${NEWS_COLOR[kind]} 16%, transparent)` }} aria-hidden="true">
      <Icon name={NEWS_ICON[kind] ?? 'news'} size={size * 0.48} />
    </span>
  );
}

function Detail({ n, list }: { n: NewsItem; list: NewsItem[] }) {
  const t = useT();
  const i = list.findIndex((x) => x.id === n.id);
  const prev = list[i - 1];
  const next = list[i + 1];
  return (
    <div className="page">
      <BackLink href="/novice" label="Pošta" />
      <article className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, borderColor: n.important ? 'var(--orange)' : undefined }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Badge kind={n.kind} size={48} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{t(n.from ?? FROM[n.kind])}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{t(NEWS_LABEL[n.kind])} · {fmtDate(n.date)}</div>
          </div>
          {n.important && <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 8, background: 'color-mix(in srgb, var(--orange) 20%, transparent)', color: 'var(--orange)' }}>{t('ZAHTEVA ODZIV')}</span>}
        </div>
        <h1 className="h" style={{ fontSize: 24, lineHeight: 1.2, margin: 0 }}>{t(n.title)}</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {paras(n.body).map((p, k) => (
            <p key={k} style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: k === 0 ? 'var(--text)' : '#cfd8e8' }}>{t(p)}</p>
          ))}
        </div>
        {n.action && <Link href={n.action.href} className="btn block" style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t(n.action.label)} →</Link>}
        {!n.action && n.fixtureId && <Link href={`/porocilo?id=${n.fixtureId}`} className="btn block sec" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t('Poročilo s tekme')} →</Link>}
      </article>
      <div className="row">
        {prev ? <Link href={`/novice?id=${prev.id}`} className="chip">‹ {t('Novejša')}</Link> : <span />}
        {next ? <Link href={`/novice?id=${next.id}`} className="chip">{t('Starejša')} ›</Link> : <span />}
      </div>
    </div>
  );
}

function Inbox() {
  const game = useGame((s) => s.game)!;
  const update = useGame((s) => s.update);
  const t = useT();
  const sp = useSearchParams();
  const router = useRouter();
  const [filter, setFilter] = useState('vse');
  if (!game) return null;
  const id = sp.get('id');
  const open = id ? game.news.find((n) => n.id === id) : undefined;
  if (open) {
    if (!open.read) setTimeout(() => update((g) => { const x = g.news.find((y) => y.id === open.id); if (x) x.read = true; }), 0);
    return <Detail n={open} list={game.news} />;
  }
  const list = game.news.filter((n) => filter === 'vse' || (filter === 'pomembno' ? n.important : n.kind === filter));
  const unread = game.news.filter((n) => !n.read).length;
  const groups: [string, NewsItem[]][] = [];
  for (const n of list) {
    const g = groups[groups.length - 1];
    if (g && g[0] === n.date) g[1].push(n);
    else groups.push([n.date, [n]]);
  }
  return (
    <div className="page">
      <BackLink href="/domov" label="Domov" />
      <div className="row">
        <h1 className="h title">{t('Pošta')}</h1>
        {unread > 0 && <button className="chip" onClick={() => update((g) => g.news.forEach((n) => (n.read = true)))}>{t('Označi vse kot prebrano')}</button>}
      </div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        {FILTERS.map(([k, l]) => {
          const c = k === 'vse' ? unread : game.news.filter((n) => !n.read && (k === 'pomembno' ? n.important : n.kind === k)).length;
          return (
            <button key={k} className={`chip ${filter === k ? 'on' : ''}`} style={{ flex: 'none' }} onClick={() => setFilter(k)}>
              {t(l)}{c > 0 && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, color: k === 'pomembno' ? 'var(--orange)' : 'var(--accent2)' }}>{c}</span>}
            </button>
          );
        })}
      </div>
      {groups.length === 0 && <p className="muted">{t('Ni novic za ta filter.')}</p>}
      {groups.map(([date, items]) => (
        <section key={date}>
          <div className="lbl" style={{ margin: '6px 4px 6px' }}>{date === game.date ? t('Danes') : fmtDate(date)}</div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {items.map((n, i) => (
              <button
                key={n.id}
                onClick={() => router.push(`/novice?id=${n.id}`)}
                style={{ display: 'flex', gap: 12, padding: '12px 14px', width: '100%', textAlign: 'left', background: n.read ? 'none' : 'rgba(94,151,255,0.06)', border: 0, borderTop: i ? '1px solid var(--line)' : 0, borderLeft: `3px solid ${n.important && !n.read ? 'var(--orange)' : n.read ? 'transparent' : 'var(--accent)'}`, color: 'var(--text)', cursor: 'pointer', alignItems: 'flex-start' }}
              >
                <Badge kind={n.kind} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: n.read ? 500 : 750, lineHeight: 1.3 }}>{t(n.title)}</span>
                    {n.important && <span style={{ color: 'var(--orange)', fontWeight: 900, fontSize: 14, flex: 'none' }}>!</span>}
                  </span>
                  <span className="muted" style={{ display: 'block', fontSize: 11, marginTop: 2, fontWeight: 600 }}>{t(n.from ?? FROM[n.kind])}</span>
                  <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 12.5, marginTop: 4, color: '#aebbd2', lineHeight: 1.45 }}>{t(paras(n.body)[0] ?? '')}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function Novice() {
  return (
    <Shell>
      <Suspense fallback={null}>
        <Inbox />
      </Suspense>
    </Shell>
  );
}
