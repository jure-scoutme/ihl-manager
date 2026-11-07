'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Crest, Shell } from '@/components/ui';
import { useGame } from '@/store/game';
import { LANGS, useT } from '@/i18n';
import { CLUBS } from '@/engine/data';
import type { Manager } from '@/engine/types';

const REP: Record<Manager['background'], number> = { reprezentant: 60, igralec: 45, brez: 30 };

export default function NovaIgra() {
  const router = useRouter();
  const newGame = useGame((s) => s.newGame);
  const existing = useGame((s) => s.game);
  const t = useT();
  const lang = useGame((s) => s.lang ?? 'sl');
  const setLang = useGame((s) => s.setLang);
  // ob prvem zagonu predlagaj jezik brskalnika
  useEffect(() => {
    try {
      if (localStorage.getItem('ihl-lang-auto')) return;
      localStorage.setItem('ihl-lang-auto', '1');
      const nl = (navigator.language || '').toLowerCase();
      const pick = nl.startsWith('sl') ? 'sl' : nl.startsWith('hr') || nl.startsWith('bs') ? 'hr' : nl.startsWith('sr') ? 'sr' : nl.startsWith('en') ? 'en' : null;
      if (pick && pick !== lang) setLang(pick);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [step, setStep] = useState(1);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [nat, setNat] = useState('Slovenija');
  const [age, setAge] = useState('40');
  const [bg, setBg] = useState<Manager['background']>('igralec');
  const [style, setStyle] = useState<Manager['style']>('uravnotezen');
  const [club, setClub] = useState('tri');

  const start = () => {
    newGame({ first: first || 'Manager', last, nat, age: Number(age) || 40, background: bg, style, reputation: REP[bg] }, club);
    router.replace('/domov');
  };

  return (
    <Shell nav={false}>
      <div className="page" style={{ paddingTop: 22 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--accent)' }} />
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: step === 2 ? 'var(--accent)' : '#22304b' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <a href="/kariere" className="chip" style={{ height: 30, marginLeft: 'auto', order: 2 }}>{t('Shranjene kariere')}</a>
          <span className="muted" style={{ fontSize: 12, fontWeight: 600, marginRight: 2 }}>🌐</span>
          {LANGS.map((l) => <button key={l.id} type="button" className={`chip ${lang === l.id ? 'on' : ''}`} style={{ height: 30 }} onClick={() => setLang(l.id)}>{l.label}</button>)}
        </div>
        <div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{step}/2</div>
          <h1 className="h title" style={{ fontSize: 30, marginTop: 4 }}>{step === 1 ? t('Ustvari managerja') : t('Izberi ekipo')}</h1>
        </div>

        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="grid2" style={{ gap: 10 }}>
              <div><label className="lbl" htmlFor="ime">{t('Ime')}</label><input className="in" id="ime" value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Ime" /></div>
              <div><label className="lbl" htmlFor="pri">{t('Priimek')}</label><input className="in" id="pri" value={last} onChange={(e) => setLast(e.target.value)} placeholder="Priimek" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 10 }}>
              <div><label className="lbl" htmlFor="drz">{t('Državljanstvo')}</label>
                <select className="in" id="drz" value={nat} onChange={(e) => setNat(e.target.value)}>
                  <option>{t('Slovenija')}</option><option>{t('Hrvaška')}</option><option>{t('Srbija')}</option><option>{t('Drugo')}</option>
                </select>
              </div>
              <div><label className="lbl" htmlFor="let">{t('Starost')}</label><input className="in" id="let" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} /></div>
            </div>
            <div>
              <span className="lbl" style={{ display: 'block', marginBottom: 6 }}>{t('Hokejska preteklost')}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {([['reprezentant', 'Bivši reprezentant', 'visok ugled'], ['igralec', 'Bivši igralec', 'srednji ugled'], ['brez', 'Brez kariere', 'začneš od nič']] as const).map(([k, l, s]) => (
                  <button type="button" key={k} className={`chip ${bg === k ? 'on' : ''}`} style={{ flex: 1, height: 58, borderRadius: 10, whiteSpace: 'normal', lineHeight: 1.3 }} onClick={() => setBg(k)}>
                    {t(l)}<br /><span className="muted" style={{ fontWeight: 500, fontSize: 11 }}>{t(s)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="lbl" style={{ display: 'block', marginBottom: 6 }}>{t('Tvoj stil igre')}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {([['napadalni', 'Napadalni'], ['uravnotezen', 'Uravnotežen'], ['obrambni', 'Obrambni']] as const).map(([k, l]) => (
                  <button type="button" key={k} className={`chip ${style === k ? 'on' : ''}`} style={{ flex: 1, height: 44, borderRadius: 10 }} onClick={() => setStyle(k)}>{t(l)}</button>
                ))}
              </div>
            </div>
            <div className="card muted" style={{ fontSize: 12, lineHeight: 1.5 }}>{t('Ugled vpliva na to, katere klube lahko vodiš in kateri igralci se ti želijo pridružiti. Z uspehi raste.')}</div>
            {existing && <div className="card" style={{ fontSize: 12, color: 'var(--gold)' }}>{t('Nova igra bo prepisala obstoječo kariero.')}</div>}
            <button className="btn block" type="submit">{t('Naprej: izberi ekipo')}</button>
          </form>
        )}

        {step === 2 && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {CLUBS.map((c) => (
                <button key={c.id} onClick={() => setClub(c.id)} className="card" style={{ display: 'grid', gridTemplateColumns: '42px 1fr auto', gap: 12, alignItems: 'center', textAlign: 'left', padding: '8px 12px', color: 'var(--text)', cursor: 'pointer', borderColor: club === c.id ? 'var(--accent)' : undefined, background: club === c.id ? '#15283d' : undefined }}>
                  <Crest club={c} />
                  <span>
                    <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{c.name}</span>
                    <span className="muted" style={{ display: 'block', fontSize: 11, marginTop: 2 }}>{c.city} · {c.country} · {c.arena.name} ({c.arena.capacity})</span>
                    <span className="muted" style={{ display: 'block', fontSize: 11 }}>{t('Cilj uprave:')} {t(c.boardGoal)}</span>
                  </span>
                  <span className="muted" style={{ fontSize: 11, textAlign: 'right' }}>{t('Proračun')}<br />
                    <span style={{ display: 'inline-flex', gap: 3 }}>{[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ width: 7, height: 7, borderRadius: 2, background: i <= c.budget ? 'var(--accent)' : '#2a3854' }} />)}</span>
                  </span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn ghost" style={{ width: 96, height: 52 }} onClick={() => setStep(1)}>{t('Nazaj')}</button>
              <button className="btn block" style={{ flex: 1 }} onClick={start}>{t('Začni kariero')}</button>
            </div>
            <p className="muted" style={{ fontSize: 11, textAlign: 'center', margin: 0 }}>{t('Igralci so zaenkrat izmišljeni, dokler ne vnesemo prave baze.')}</p>
          </>
        )}
      </div>
    </Shell>
  );
}
