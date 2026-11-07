'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bar, Crest, Shell, eur } from '@/components/ui';
import { useGame } from '@/store/game';
import { LANGS, useT } from '@/i18n';
import { INFRA_INFO, infraCost, infraDays, infraOf, infraUpkeep, requestArena, requestUpgrade } from '@/engine/club';
import { fmtDate, standings } from '@/engine/season';
import { staffImpact, staffOf } from '@/engine/staff';
import { BOARD_ASKS, askBoard, boardCooldown } from '@/engine/board';
import type { InfraLevels } from '@/engine/types';

export default function Klub() {
  const game = useGame((s) => s.game)!;
  const t = useT();
  const lang = useGame((s) => s.lang ?? 'sl');
  const setLang = useGame((s) => s.setLang);
  const update = useGame((s) => s.update);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const reset = useGame((s) => s.reset);
  const sound = useGame((s) => s.sound ?? true);
  const setSound = useGame((s) => s.setSound);
  const router = useRouter();
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
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{club.arena.name}, {club.city} {t('· ugled')} {club.reputation}</div>
        </div>
      </header>
      <div className="page">
        {msg && <div className="card row" style={{ fontSize: 13, color: msg.ok ? 'var(--good)' : 'var(--gold)' }}><span>{t(msg.text)}</span><button className="chip" onClick={() => setMsg(null)}>{t('OK')}</button></div>}

        <section className="card">
          <div className="lbl" style={{ marginBottom: 8 }}>{t('Uprava in navijači')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13 }}>
            <div><div className="row" style={{ marginBottom: 4 }}><span>{t('Zaupanje uprave')}</span><span>{Math.round(game.board ?? 55)} %</span></div><Bar value={game.board ?? 55} color={(game.board ?? 55) < 30 ? 'var(--bad)' : 'var(--gold)'} /></div>
            <div><div className="row" style={{ marginBottom: 4 }}><span>{t('Podpora navijačev')}</span><span>{Math.round(game.fans ?? 50)} %</span></div><Bar value={game.fans ?? 50} color="var(--good)" /></div>
          </div>
          <div className="row" style={{ fontSize: 13, marginTop: 10 }}><span className="muted">{t('Cilj sezone')}</span><span style={{ fontWeight: 600 }}>{t(club.boardGoal)}</span></div>
          <div className="row" style={{ fontSize: 13 }}><span className="muted">{t('Trenutno mesto')}</span><span style={{ fontWeight: 600 }}>{pos}.</span></div>
          <p className="muted" style={{ fontSize: 12, margin: '8px 0 0', lineHeight: 1.5 }}>{t('Uprava ocenjuje rezultate glede na cilj in finance. Od zaupanja je odvisno, ali odobri investicije. Navijači vplivajo na obisk in moralo.')}</p>
        </section>

        <section className="card">
          <div className="row"><span className="lbl">{t('Pogovor z upravo')}</span>{boardCooldown(game) && <span className="muted" style={{ fontSize: 11 }}>{t('naslednji pogovor od {d}', { d: fmtDate(boardCooldown(game)!).replace(/ \d{4}$/, '') })}</span>}</div>
          {game.boardPromise?.season === game.seasonYear && <p style={{ fontSize: 12, color: 'var(--gold)', margin: '6px 0 0' }}>{t('Obljuba upravi: cilj {g} v tej sezoni.', { g: t(game.boardPromise.goal) })}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {BOARD_ASKS.map((a) => (
              <button key={a.id} className="btn sec" disabled={!!boardCooldown(game)} style={{ height: 'auto', padding: '10px 12px', textAlign: 'left', display: 'block' }} onClick={() => update((g) => setMsg(askBoard(g, a.id)))}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 13 }}>{t(a.label)}</span>
                <span className="muted" style={{ display: 'block', fontSize: 11, marginTop: 2, fontWeight: 400 }}>{t(a.desc)}</span>
              </button>
            ))}
          </div>
        </section>

        <Link href="/stab" className="card row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span>
            <span className="lbl" style={{ display: 'block' }}>{t('Strokovni štab')}</span>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 600, marginTop: 4 }}>{staffOf(game, club.id, 'glavni') ? `${staffOf(game, club.id, 'glavni')!.first} ${staffOf(game, club.id, 'glavni')!.last}` : t('Ni glavnega trenerja')}</span>
            <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>{t('Vpliv štaba na moč: {x} %', { x: (staffImpact(game, club.id) >= 0 ? '+' : '') + staffImpact(game, club.id).toFixed(1) })}</span>
          </span>
          <span style={{ fontSize: 22, opacity: 0.6 }}>›</span>
        </Link>

        <section className="card">
          <div className="row" style={{ marginBottom: 6 }}><span className="lbl">{t('Infrastruktura')}</span><span className="muted" style={{ fontSize: 11 }}>{t('vzdrževanje')} {eur(infraUpkeep(lv))}{t('/mes')}</span></div>
          {(Object.keys(INFRA_INFO) as (keyof InfraLevels)[]).map((k) => {
            const cur = lv[k];
            const running = projects.find((p) => p.key === k);
            return (
              <div key={k} style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
                <div className="row">
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{t(INFRA_INFO[k].label)}</span>
                  <span style={{ display: 'flex', gap: 3 }}>{[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ width: 14, height: 8, borderRadius: 2, background: i <= cur ? 'var(--accent)' : '#2a3854' }} />)}</span>
                </div>
                <div className="muted" style={{ fontSize: 12, margin: '3px 0 8px' }}>{t(INFRA_INFO[k].desc)}</div>
                {running ? (
                  <div style={{ fontSize: 12, color: 'var(--gold)' }}>{t('Nadgradnja v teku, konec')} {fmtDate(running.finish)}</div>
                ) : cur < 5 ? (
                  <button className="btn sec" style={{ width: '100%', height: 40, fontSize: 13 }} onClick={() => update((g) => setMsg(requestUpgrade(g, k)))}>
                    {t('Nadgradi na {n} · {c} · {d} dni', { n: cur + 1, c: eur(infraCost(cur)), d: infraDays(cur) })}
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
          <div className="row" style={{ fontSize: 13 }}><span>{club.arena.name}, {club.arena.city}</span><span className="h" style={{ fontSize: 20 }}>{club.arena.capacity} {t('mest')}</span></div>
          {projects.find((p) => p.key === 'arena') ? (
            <div style={{ fontSize: 12, color: 'var(--gold)', marginTop: 8 }}>{t('Širitev v teku, konec')} {fmtDate(projects.find((p) => p.key === 'arena')!.finish)}</div>
          ) : (
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              {[100, 250].map((s) => (
                <button key={s} className="btn ghost" style={{ flex: 1, height: 44, fontSize: 13 }} onClick={() => update((g) => setMsg(requestArena(g, s)))}>+{s} {t('mest ·')} {eur(s * 450)}</button>
              ))}
            </div>
          )}
          <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>{t('Širitev mora odobriti lastnik dvorane (občina). Potrebuješ vsaj 60 % zaupanja uprave.')}</p>
        </section>

        <section className="card" style={{ fontSize: 13 }}>
          <div className="lbl" style={{ marginBottom: 6 }}>{t('Manager')}</div>
          <div className="h" style={{ fontSize: 20 }}>{m.first} {m.last}</div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t(m.nat)} · {m.age} {t('let · stil:')} {t(m.style)} {t('· ugled')} {m.reputation}</div>
          <div className="row"><span className="muted">{t('Tekme')}</span><span>{ms.gp}</span></div>
          <div className="row"><span className="muted">{t('Zmage / porazi')}</span><span>{ms.w} / {ms.l}{ms.gp ? ` (${Math.round((ms.w / ms.gp) * 100)} %)` : ''}</span></div>
          <div className="row"><span className="muted">{t('Naslovi')}</span><span>{ms.titles}</span></div>
          <div className="row"><span className="muted">{t('Sezone')}</span><span>{ms.seasons}</span></div>
          {(game.career ?? []).length > 0 && (
            <>
              <div className="lbl" style={{ margin: '10px 0 4px' }}>{t('Kariera')}</div>
              {[...(game.career ?? [])].reverse().map((e, i) => {
                const c = game.clubs.find((x) => x.id === e.clubId);
                const gp = e.gp ?? ms.gp - e.gp0;
                const w = e.w ?? ms.w - e.w0;
                return (
                  <div key={i} className="row" style={{ fontSize: 12, padding: '3px 0' }}>
                    <span>{c?.short} <span className="muted">· {e.from.slice(0, 4)}–{e.to ? e.to.slice(0, 4) : t('danes')}{e.reason ? ` · ${t(e.reason)}` : ''}</span></span>
                    <span className="muted">{gp} {t('tekem')} · {w} {t('zmag')}{(e.titles ?? 0) > 0 ? ` · 🏆${e.titles}` : ''}</span>
                  </div>
                );
              })}
            </>
          )}
        </section>

        <section className="card" id="nastavitve">
          <div className="lbl" style={{ marginBottom: 10 }}>{t('Nastavitve')}</div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t('Jezik')}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {LANGS.map((l) => <button key={l.id} className={`chip ${lang === l.id ? 'on' : ''}`} onClick={() => setLang(l.id)}>{l.label}</button>)}
          </div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600, margin: '14px 0 6px' }}>{t('Zvoki na tekmi')}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={`chip ${sound ? 'on' : ''}`} onClick={() => setSound(true)}>{t('Vklopljeni')}</button>
            <button className={`chip ${!sound ? 'on' : ''}`} onClick={() => setSound(false)}>{t('Izklopljeni')}</button>
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '14px 0' }} />
          <Link href="/kariere" className="btn sec block" style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>{t('Kariere in shranjevanje')}</Link>
          {!confirmReset ? (
            <button className="btn ghost block" style={{ height: 44 }} onClick={() => setConfirmReset(true)}>{t('Začni novo igro')}</button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 13, color: 'var(--gold)', margin: 0 }}>{t('Trenutna kariera bo izbrisana. Res želiš začeti znova?')}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn sec" style={{ flex: 1 }} onClick={() => setConfirmReset(false)}>{t('Prekliči')}</button>
                <button className="btn" style={{ flex: 1, background: 'var(--bad)' }} onClick={() => { reset(); router.replace('/nova'); }}>{t('Izbriši in začni znova')}</button>
              </div>
            </div>
          )}
        </section>

        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/finance" className="btn sec" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t('Finance')}{fin ? ` · ${eur(fin.balance)}` : ''}</Link>
          <Link href="/zgodovina" className="btn sec" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t('Zgodovina')}</Link>
          <Link href="/mladinci" className="btn sec" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t('Mladinci')}</Link>
        </div>
      </div>
    </Shell>
  );
}
