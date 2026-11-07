'use client';
import { useState } from 'react';
import { BackLink, Bar, Shell, eur, heroBg } from '@/components/ui';
import { useGame } from '@/store/game';
import { useT } from '@/i18n';
import { ROLES, ROLE_LABEL, SPEC_LABEL, type Staff, type StaffRole, extendStaff, fireStaff, freeStaff, hireStaff, severance, staffImpact, staffOf } from '@/engine/staff';

const repColor = (r: number) => (r >= 75 ? 'var(--gold)' : r >= 60 ? 'var(--good)' : r >= 45 ? 'var(--accent)' : 'var(--muted)');

function Stars({ rep }: { rep: number }) {
  const n = Math.max(1, Math.round(rep / 20));
  return <span style={{ color: repColor(rep), letterSpacing: 1 }}>{'★'.repeat(n)}<span style={{ opacity: 0.25 }}>{'★'.repeat(5 - n)}</span></span>;
}

export default function Stab() {
  const game = useGame((s) => s.game);
  const update = useGame((s) => s.update);
  const t = useT();
  const [tab, setTab] = useState<'moj' | 'trg'>('moj');
  const [role, setRole] = useState<StaffRole | 'vsi'>('vsi');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [years, setYears] = useState(2);
  if (!game || !game.staff) return <Shell>{null}</Shell>;
  const club = game.clubs.find((c) => c.id === game.userClubId)!;
  const impact = staffImpact(game, club.id);
  const market = freeStaff(game).filter((s) => role === 'vsi' || s.role === role).sort((a, b) => b.rep - a.rep);

  const card = (s: Staff, mine: boolean) => (
    <div key={s.id} className="card" style={{ padding: 14 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="lbl">{t(ROLE_LABEL[s.role])}</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{s.first} {s.last}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{s.nat} · {s.age} {t('let')} · {t(SPEC_LABEL[s.spec])}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="score" style={{ fontSize: 22, color: repColor(s.rep) }}>{s.rep}</div>
          <Stars rep={s.rep} />
        </div>
      </div>
      <div style={{ marginTop: 8 }}><Bar value={s.rep} color={repColor(s.rep)} /></div>
      <div className="row muted" style={{ fontSize: 12, marginTop: 8 }}>
        <span>{eur(s.wage)} / {t('mes')}</span>
        <span>{mine ? t('Pogodba do {y}', { y: s.contractUntil }) : t('Prost')}</span>
      </div>
      {mine ? (
        confirm === s.id ? (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 13, margin: '0 0 8px' }}>{t('Odpravnina: {x}. Uprava tega ne bo vesela.', { x: eur(severance(game, s)) })}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn ghost" style={{ flex: 1, height: 40 }} onClick={() => setConfirm(null)}>{t('Prekliči')}</button>
              <button className="btn" style={{ flex: 1, height: 40, background: 'var(--bad)' }} onClick={() => { update((g) => setMsg(fireStaff(g, s.id))); setConfirm(null); }}>{t('Odpusti')}</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn sec" style={{ flex: 1, height: 40, fontSize: 13 }} onClick={() => update((g) => setMsg(extendStaff(g, s.id, 1)))}>{t('Podaljšaj +1 leto')}</button>
            <button className="btn ghost" style={{ flex: 1, height: 40, fontSize: 13 }} onClick={() => setConfirm(s.id)}>{t('Odpusti')}</button>
          </div>
        )
      ) : (
        <button className="btn block" style={{ marginTop: 10, height: 42 }} onClick={() => update((g) => setMsg(hireStaff(g, s.id, years)))}>
          {t('Zaposli za {n} sez.', { n: years })}
        </button>
      )}
    </div>
  );

  return (
    <Shell>
      <div className="page">
        <BackLink href="/klub" label="Klub" />
        <section className="hero" style={{ background: heroBg(club.color, '#0b1220') }}>
          <div className="lbl" style={{ opacity: 0.8 }}>{t('Strokovni štab')}</div>
          <h1 className="h title" style={{ marginTop: 4 }}>{club.short}</h1>
          <div style={{ display: 'flex', gap: 18, marginTop: 12 }}>
            <div><div className="score" style={{ fontSize: 26, color: impact >= 0 ? '#8fe3b5' : '#f5a98f' }}>{impact >= 0 ? '+' : ''}{impact.toFixed(1)} %</div><div style={{ fontSize: 11, opacity: 0.8 }}>{t('vpliv na moč ekipe')}</div></div>
            <div><div className="score" style={{ fontSize: 26 }}>{eur(ROLES.reduce((a, r) => a + (staffOf(game, club.id, r)?.wage ?? 0), 0))}</div><div style={{ fontSize: 11, opacity: 0.8 }}>{t('plače štaba / mes')}</div></div>
          </div>
        </section>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`chip ${tab === 'moj' ? 'on' : ''}`} onClick={() => setTab('moj')}>{t('Moj štab')}</button>
          <button className={`chip ${tab === 'trg' ? 'on' : ''}`} onClick={() => setTab('trg')}>{t('Trg trenerjev')} ({freeStaff(game).length})</button>
        </div>

        {msg && <div className="card row" style={{ fontSize: 13, color: msg.ok ? 'var(--good)' : 'var(--gold)' }}><span>{t(msg.text)}</span><button className="chip" onClick={() => setMsg(null)}>{t('OK')}</button></div>}

        {tab === 'moj' && (
          <>
            {ROLES.map((r) => {
              const s = staffOf(game, club.id, r);
              if (s) return card(s, true);
              return (
                <div key={r} className="card" style={{ padding: 14, borderStyle: 'dashed' }}>
                  <div className="lbl">{t(ROLE_LABEL[r])}</div>
                  <p style={{ fontSize: 13, margin: '6px 0 10px' }}>{t('Mesto je prazno. Ekipa brez trenerja igra slabše.')}</p>
                  <button className="btn sec block" style={{ height: 40 }} onClick={() => { setRole(r); setTab('trg'); }}>{t('Poišči na trgu')}</button>
                </div>
              );
            })}
            <p className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>{t('Glavni trener vpliva na moč celotne ekipe, pomočnik na igro z igralcem več/manj in razvoj mladih, trener vratarjev na obrambe in razvoj golmanov. Višji renome pomeni močnejšo ekipo, a tudi višjo plačo.')}</p>
          </>
        )}

        {tab === 'trg' && (
          <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['vsi', ...ROLES] as const).map((r) => (
                <button key={r} className={`chip ${role === r ? 'on' : ''}`} onClick={() => setRole(r)}>{r === 'vsi' ? t('Vsi') : t(ROLE_LABEL[r])}</button>
              ))}
            </div>
            <div className="row" style={{ fontSize: 13 }}>
              <span className="muted">{t('Dolžina pogodbe')}</span>
              <span style={{ display: 'flex', gap: 6 }}>{[1, 2, 3].map((y) => <button key={y} className={`chip ${years === y ? 'on' : ''}`} onClick={() => setYears(y)}>{y}</button>)}</span>
            </div>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>{t('Trenerji z visokim renomejem pridejo le v klube z dovolj velikim ugledom. Če je mesto zasedeno, moraš trenutnega trenerja najprej odpustiti.')}</p>
            {market.length === 0 && <p className="muted">{t('Trenutno ni prostih trenerjev za to vlogo.')}</p>}
            {market.map((s) => card(s, false))}
          </>
        )}
      </div>
    </Shell>
  );
}
