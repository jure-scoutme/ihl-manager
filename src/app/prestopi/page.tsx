'use client';
import Link from 'next/link';
import { useState } from 'react';
import { INTEREST_STYLE, POS_LABEL, Shell, eur, ovrColor } from '@/components/ui';
import { useGame } from '@/store/game';
import { fmtDate } from '@/engine/season';
import { abroadPlayers, importFee, importWage } from '@/engine/sales';
import { potentialKnown, shownOvr, shownPotential } from '@/engine/scouting';
import { transferWindow } from '@/engine/contracts';
import { useT } from '@/i18n';
import { ageOf } from '@/engine/players';
import { clubWages, freeAgents, interestIn } from '@/engine/finance';

type Filter = 'vsi' | 'F' | 'D' | 'G';

export default function Prestopi() {
  const game = useGame((s) => s.game)!;
  const t = useT();
  const [filter, setFilter] = useState<Filter>('vsi');
  const [sort, setSort] = useState<'ocena' | 'placa' | 'starost'>('ocena');
  const [market, setMarket] = useState<'prosti' | 'tujina'>('prosti');
  if (!game) return <Shell>{null}</Shell>;
  const fin = game.finance?.[game.userClubId];
  const wages = clubWages(game, game.userClubId);
  const roster = Object.values(game.players).filter((p) => p.clubId === game.userClubId).length;
  const list = (market === 'tujina' ? abroadPlayers(game) : freeAgents(game))
    .filter((p) => (filter === 'vsi' ? true : filter === 'F' ? ['C', 'LW', 'RW'].includes(p.pos) : p.pos === filter))
    .sort((a, b) => (sort === 'ocena' ? b.ovr - a.ovr : sort === 'placa' ? a.wage - b.wage : a.birthYear - b.birthYear) * (sort === 'starost' ? -1 : 1));

  return (
    <Shell>
      <header style={{ padding: '18px 16px 0' }}>
        <h1 className="h title">{t('Prestopi')}</h1>
        <div className="seg" style={{ marginTop: 10 }}>
          <button className={market === 'prosti' ? 'on' : ''} onClick={() => setMarket('prosti')}>{t('Prosti igralci')}</button>
          <button className={market === 'tujina' ? 'on' : ''} onClick={() => setMarket('tujina')}>{t('Tujina')}</button>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{market === 'prosti' ? t('Igralci brez kluba, ki jih lahko podpišeš takoj, brez odškodnine.') : t('Igralci v tujih ligah. Kupiš jih z odškodnino v prestopnem roku; pričakujejo višjo plačo.')}</div>
      </header>
      <div className="page">
        {(() => { const w = transferWindow(game); return (
          <div className="card row" style={{ fontSize: 13, padding: '10px 14px', borderColor: w.open ? 'var(--good)' : undefined }}>
            <span><b style={{ color: w.open ? 'var(--good)' : 'var(--gold)' }}>{t(w.label)}</b>{w.closes && <span className="muted"> · {t('do')} {fmtDate(w.closes)}</span>}<br /><span className="muted" style={{ fontSize: 11 }}>{t('Igralce drugih klubov kupiš na strani Liga → klub → igralec. Proste igralce lahko podpišeš kadarkoli.')}</span></span>
          </div>
        ); })()}
        {fin && (
          <section style={{ display: 'flex', gap: 8 }}>
            <div className="card" style={{ flex: 1, padding: '10px 12px' }}>
              <div className="lbl" style={{ fontSize: 10 }}>{t('Prostor za plače')}</div>
              <div className="h" style={{ fontSize: 22, color: fin.wageBudget - wages < 0 ? 'var(--bad)' : undefined }}>{eur(fin.wageBudget - wages)}<span className="muted" style={{ fontSize: 13 }}> {t('/mes')}</span></div>
            </div>
            <div className="card" style={{ flex: 1, padding: '10px 12px' }}>
              <div className="lbl" style={{ fontSize: 10 }}>{t('Kader')}</div>
              <div className="h" style={{ fontSize: 22 }}>{roster} / 30</div>
            </div>
          </section>
        )}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {([['vsi', 'Vsi'], ['F', 'Napadalci'], ['D', 'Branilci'], ['G', 'Golmani']] as const).map(([k, l]) => (
            <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{t(l)}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 12 }}>{t('Razvrsti:')}</span>
          {([['ocena', 'Ocena'], ['placa', 'Plača'], ['starost', 'Mlajši']] as const).map(([k, l]) => (
            <button key={k} className={`chip ${sort === k ? 'on' : ''}`} style={{ height: 30 }} onClick={() => setSort(k)}>{t(l)}</button>
          ))}
        </div>
        {list.map((p) => {
          const it = interestIn(game, p, game.userClubId);
          const st = INTEREST_STYLE[it];
          return (
            <Link key={p.id} href={`/igralec?id=${p.id}&from=prestopi`} className="card" style={{ display: 'grid', gridTemplateColumns: '44px 1fr auto', gap: 12, alignItems: 'center', padding: '10px 12px' }}>
              <span className="h" style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: ovrColor(shownOvr(game, p).value) }}>{shownOvr(game, p).exact ? '' : '~'}{shownOvr(game, p).value}</span>
              <span>
                <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{p.first} {p.last}{potentialKnown(game, p) && p.potential - p.ovr >= 6 && <span style={{ color: 'var(--good)', fontSize: 11 }}> {t('▲ POT')} {shownPotential(game, p)}</span>}</span>
                <span className="muted" style={{ display: 'block', fontSize: 12 }}>{POS_LABEL[p.pos]} · {ageOf(p, game.seasonYear)} {t('let ·')} {p.nat}{p.abroad ? ` · ${p.abroad.club}` : p.isAI ? ' · AI' : ''}</span>
              </span>
              <span style={{ textAlign: 'right' }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 13 }}>{eur(p.abroad ? importWage(game, p) : p.wage)}</span>
                {p.abroad ? <span className="muted" style={{ display: 'block', fontSize: 11, marginTop: 3 }}>{t('odškodnina')} {eur(importFee(game, p))}</span> : <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 9, background: st.bg, color: st.fg, marginTop: 3 }}>{t(st.label)}</span>}
              </span>
            </Link>
          );
        })}
        {list.length === 0 && <p className="muted">{t('Ni prostih igralcev za ta filter.')}</p>}

      </div>
    </Shell>
  );
}
