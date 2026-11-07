'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Bar, Crest, Shell, eur } from '@/components/ui';
import { useGame } from '@/store/game';
import { LANGS, useT } from '@/i18n';
import { INFRA_INFO, infraCost, infraDays, infraOf, infraUpkeep, requestArena, requestUpgrade } from '@/engine/club';
import { fmtDate, standings } from '@/engine/season';
import type { InfraLevels } from '@/engine/types';

export default function Klub() {
  const game = useGame((s) => s.game)!;
  const t = useT();
  const lang = useGame((s) => s.lang ?? 'sl');
  const setLang = useGame((s) => s.setLang);
  const update = useGame((s) => s.update);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!game) return <Shell>{null}</Shell>;
  const club = game.clubs.find((c) => c.id === game.userClubId)!;
  const lv = infraOf(game, club.id);
  const fin = game.finance?.[club.id];
  const projects = (game.projects ?? []).filter((p) => p.clubId === club.id);
  const st = standings(game);
  const pos = st.findIndex((s) => s.clubId === club.id) + 1;
  const ms = game.managerStats ?? { gp: 0, w: 0, l: 0, titles: 0, seasons: 0 };
  const m = game.manager;

  return (
    <Shell>
      <header style={{ padding: '18px 16px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Crest club={club} size={48} />
        <div>
          <h1 className="h title" style={{ fontSize: 26 }}>{club.name}</h1>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{club.arena.name}, {club.city} · ugled {club.reputation}</div>
        </div>
      </header>
      <div className="page">
        {msg && <div className="card row" style={{ fontSize: 13, color: msg.ok ? 'var(--good)' : 'var(--gold)' }}><span>{msg.text}</span><button className="chip" onClick={() => setMsg(null)}>{t('OK')}</button></div>}

        <section className="card">
          <div className="lbl" style={{ marginBottom: 8 }}>{t('Uprava in navijači')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13 }}>
            <div><div className="row" style={{ marginBottom: 4 }}><span>{t('Zaupanje uprave')}</span><span>{Math.round(game.board ?? 55)} %</span></div><Bar value={game.board ?? 55} color={(game.board ?? 55) < 30 ? 'var(--bad)' : 'var(--gold)'} /></div>
            <div><div className="row" style={{ marginBottom: 4 }}><span>{t('Podpora navijačev')}</span><span>{Math.round(game.fans ?? 50)} %</span></div><Bar value={game.fans ?? 50} color="var(--good)" /></div>
          </div>
          <div className="row" style={{ fontSize: 13, marginTop: 10 }}><span className="muted">{t('Cilj sezone')}</span><span style={{ fontWeight: 600 }}>{club.boardGoal}</span></div>
          <div className="row" style={{ fontSize: 13 }}><span className="muted">{t('Trenutno mesto')}</span><span style={{ fontWeight: 600 }}>{pos}.</span></div>
          <p className="muted" style={{ fontSize: 12, margin: '8px 0 0', lineHeight: 1.5 }}>Uprava ocenjuje rezultate glede na cilj in finance. Od zaupanja je odvisno, ali odobri investicije. Navijači vplivajo na obisk in moralo.</p>
        </section>

        <section className="card">
          <div className="row" style={{ marginBottom: 6 }}><span className="lbl">{t('Infrastruktura')}</span><span className="muted" style={{ fontSize: 11 }}>vzdrževanje {eur(infraUpkeep(lv))}/mes</span></div>
          {(Object.keys(INFRA_INFO) as (keyof InfraLevels)[]).map((k) => {
            const cur = lv[k];
            const running = projects.find((p) => p.key === k);
            return (
              <div key={k} style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
                <div className="row">
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{INFRA_INFO[k].label}</span>
                  <span style={{ display: 'flex', gap: 3 }}>{[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ width: 14, height: 8, borderRadius: 2, background: i <= cur ? 'var(--accent)' : '#2a3854' }} />)}</span>
                </div>
                <div className="muted" style={{ fontSize: 12, margin: '3px 0 8px' }}>{INFRA_INFO[k].desc}</div>
                {running ? (
                  <div style={{ fontSize: 12, color: 'var(--gold)' }}>Nadgradnja v teku, konec {fmtDate(running.finish)}</div>
                ) : cur < 5 ? (
                  <button className="btn sec" style={{ width: '100%', height: 40, fontSize: 13 }} onClick={() => update((g) => setMsg(requestUpgrade(g, k)))}>
                    Nadgradi na {cur + 1} · {eur(infraCost(cur))} · {infraDays(cur)} dni
                  </button>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--good)' }}>{t('Najvišja stopnja')}</div>
                )}
              </div>
            );
          })}
        </section>

        <section className="card">
          <div className="lbl" style={{ marginBottom: 6 }}>{t('Dvorana')}</div>
          <div className="row" style={{ fontSize: 13 }}><span>{club.arena.name}, {club.arena.city}</span><span className="h" style={{ fontSize: 20 }}>{club.arena.capacity} mest</span></div>
          {projects.find((p) => p.key === 'arena') ? (
            <div style={{ fontSize: 12, color: 'var(--gold)', marginTop: 8 }}>Širitev v teku, konec {fmtDate(projects.find((p) => p.key === 'arena')!.finish)}</div>
          ) : (
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              {[100, 250].map((s) => (
                <button key={s} className="btn ghost" style={{ flex: 1, height: 44, fontSize: 13 }} onClick={() => update((g) => setMsg(requestArena(g, s)))}>+{s} mest · {eur(s * 450)}</button>
              ))}
            </div>
          )}
          <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>Širitev mora odobriti lastnik dvorane (občina). Potrebuješ vsaj 60 % zaupanja uprave.</p>
        </section>

        <section className="card" style={{ fontSize: 13 }}>
          <div className="lbl" style={{ marginBottom: 6 }}>{t('Manager')}</div>
          <div className="h" style={{ fontSize: 20 }}>{m.first} {m.last}</div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{m.nat} · {m.age} let · stil: {m.style} · ugled {m.reputation}</div>
          <div className="row"><span className="muted">{t('Tekme')}</span><span>{ms.gp}</span></div>
          <div className="row"><span className="muted">Zmage / porazi</span><span>{ms.w} / {ms.l}{ms.gp ? ` (${Math.round((ms.w / ms.gp) * 100)} %)` : ''}</span></div>
          <div className="row"><span className="muted">Naslovi</span><span>{ms.titles}</span></div>
          <div className="row"><span className="muted">Sezone</span><span>{ms.seasons}</span></div>
        </section>

        <section className="card">
          <div className="lbl" style={{ marginBottom: 8 }}>{t('Jezik')}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {LANGS.map((l) => <button key={l.id} className={`chip ${lang === l.id ? 'on' : ''}`} onClick={() => setLang(l.id)}>{l.label}</button>)}
          </div>
        </section>

        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/finance" className="btn sec" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Finance{fin ? ` · ${eur(fin.balance)}` : ''}</Link>
          <Link href="/zgodovina" className="btn sec" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t('Zgodovina')}</Link>
          <Link href="/mladinci" className="btn sec" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t('Mladinci')}</Link>
        </div>
      </div>
    </Shell>
  );
}
