'use client';
import Link from 'next/link';
import { BackLink, Bar, Shell } from '@/components/ui';
import { useGame } from '@/store/game';
import { useT } from '@/i18n';
import { ATTR_LABELS } from '@/engine/players';
import { staffOf } from '@/engine/staff';
import { FOCUS, INTENSITY, groupChem, planOf } from '@/engine/training';
import { fmtDate } from '@/engine/season';

const chemColor = (c: number) => (c >= 70 ? 'var(--good)' : c >= 50 ? 'var(--accent)' : c >= 40 ? 'var(--gold)' : 'var(--bad)');

export default function Trening() {
  const game = useGame((s) => s.game);
  const update = useGame((s) => s.update);
  const t = useT();
  if (!game) return <Shell>{null}</Shell>;
  const plan = game.training?.[game.userClubId] ?? { focus: 'taktika', intensity: 'normalna', delegated: false };
  const asst = staffOf(game, game.userClubId, 'pomocnik');
  const lines = game.lines[game.userClubId];
  const energy = Math.round(Object.values(game.players).filter((p) => p.clubId === game.userClubId).reduce((a, p, _, arr) => a + p.energy / arr.length, 0));
  const set = (fn: (p: ReturnType<typeof planOf>) => void) => update((g) => fn(planOf(g, g.userClubId)));
  const name = (id: string) => { const p = game.players[id]; return p ? p.last : '—'; };

  return (
    <Shell>
      <div className="page">
        <BackLink href="/kader" label="Kader" />
        <h1 className="h title">{t('Trening')}</h1>

        <section className="card">
          <div className="row">
            <span>
              <span style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>{t('Trening vodi pomočnik')}</span>
              <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>{asst ? `${asst.first} ${asst.last} · ${t('renome')} ${asst.rep}` : t('Nimaš pomočnika trenerja.')}</span>
            </span>
            <button className={`chip ${plan.delegated ? 'on' : ''}`} disabled={!asst} onClick={() => set((p) => { p.delegated = !p.delegated; })}>{plan.delegated ? t('Vklopljeno') : t('Izklopljeno')}</button>
          </div>
          <p className="muted" style={{ fontSize: 12, margin: '8px 0 0', lineHeight: 1.5 }}>{t('Pomočnik vsak ponedeljek sam izbere poudarek glede na svežino in rezultate. Boljši pomočnik se pogosteje odloči pravilno.')}</p>
        </section>

        <section className="card" style={{ opacity: plan.delegated ? 0.6 : 1 }}>
          <div className="row" style={{ marginBottom: 8 }}><span className="lbl">{t('Poudarek tedna')}</span><span className="muted" style={{ fontSize: 12 }}>{t('Svežina ekipe')} {energy} %</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {FOCUS.map((f) => (
              <button key={f.id} disabled={plan.delegated} onClick={() => set((p) => { p.focus = f.id; })} className="card" style={{ margin: 0, padding: 10, textAlign: 'left', borderColor: plan.focus === f.id ? 'var(--accent)' : undefined, background: plan.focus === f.id ? 'rgba(79,140,255,.12)' : undefined, cursor: plan.delegated ? 'default' : 'pointer', color: 'inherit' }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{t(f.label)}</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 3, lineHeight: 1.35 }}>{t(f.desc)}</div>
              </button>
            ))}
          </div>
          <div className="lbl" style={{ margin: '12px 0 6px' }}>{t('Intenzivnost')}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {INTENSITY.map((i) => <button key={i.id} disabled={plan.delegated} className={`chip ${plan.intensity === i.id ? 'on' : ''}`} onClick={() => set((p) => { p.intensity = i.id; })}>{t(i.label)}</button>)}
          </div>
          <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>{t(INTENSITY.find((i) => i.id === plan.intensity)!.desc)}</p>
        </section>

        {lines && (
          <section className="card">
            <div className="row" style={{ marginBottom: 8 }}><span className="lbl">{t('Kemija')}</span><Link href="/postave" className="muted" style={{ fontSize: 12 }}>{t('Postave')} ›</Link></div>
            {lines.f.map((l, i) => {
              const c = groupChem(game, l);
              return (
                <div key={'f' + i} style={{ marginBottom: 8 }}>
                  <div className="row" style={{ fontSize: 12, marginBottom: 4 }}><span>{i + 1}. {t('napad')} · <span className="muted">{l.map(name).join(' – ')}</span></span><b style={{ color: chemColor(c) }}>{c}</b></div>
                  <Bar value={c} color={chemColor(c)} />
                </div>
              );
            })}
            {lines.d.map((l, i) => {
              const c = groupChem(game, l);
              return (
                <div key={'d' + i} style={{ marginBottom: 8 }}>
                  <div className="row" style={{ fontSize: 12, marginBottom: 4 }}><span>{i + 1}. {t('obrambni par')} · <span className="muted">{l.map(name).join(' – ')}</span></span><b style={{ color: chemColor(c) }}>{c}</b></div>
                  <Bar value={c} color={chemColor(c)} />
                </div>
              );
            })}
            <p className="muted" style={{ fontSize: 12, margin: '6px 0 0', lineHeight: 1.5 }}>{t('Kemija raste, ko igralci skupaj igrajo tekme (hitreje s treningom taktike). Rojaki, vzgojenci istega kluba in mentorji se ujamejo hitreje. Pogoste menjave postav kemijo zmanjšajo.')}</p>
          </section>
        )}

        <section className="card">
          <div className="lbl" style={{ marginBottom: 8 }}>{t('Napredek na treningu')}</div>
          {!(plan.lastGains ?? []).length && <p className="muted" style={{ fontSize: 13, margin: 0 }}>{t('Napredek mladih igralcev se pokaže po prvem tednu treninga.')}</p>}
          {(plan.lastGains ?? []).slice(0, 12).map((g, i) => {
            const p = game.players[g.id];
            if (!p) return null;
            return (
              <Link key={i} href={`/igralec?id=${p.id}`} className="row" style={{ fontSize: 13, padding: '5px 0' }}>
                <span>{p.first} {p.last} <span className="muted">· {t(ATTR_LABELS[g.attr])}</span></span>
                <span style={{ color: 'var(--good)', fontWeight: 700 }}>+1 <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>{fmtDate(g.date).replace(/ \d{4}$/, '')}</span></span>
              </Link>
            );
          })}
        </section>
      </div>
    </Shell>
  );
}
