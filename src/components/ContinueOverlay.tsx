'use client';
import { useEffect, useRef, useState } from 'react';
import { useGame, type DayStep } from '@/store/game';
import { addDays, fmtDate } from '@/engine/season';
import { useT } from '@/i18n';

const STOP_TEXT: Record<string, string> = {
  tekma: 'Danes igra tvoja ekipa.',
  novica: 'Prispela je pomembna novica.',
  odlocitev: 'Čaka te odločitev.',
  konec: 'Sezona je končana.',
};

export function ContinueOverlay({ onClose }: { onClose: () => void }) {
  const stepDay = useGame((s) => s.stepDay);
  const game = useGame((s) => s.game)!;
  const t = useT();
  const [days, setDays] = useState<DayStep[]>([]);
  const [current, setCurrent] = useState(game.date);
  const [done, setDone] = useState<string | null>(null);
  const stopReq = useRef(false);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const r = stepDay();
      if (r.date && r.date !== r.newDate) setDays((d) => [r, ...d].slice(0, 40));
      setCurrent(r.newDate || useGame.getState().game!.date);
      if (r.stop || stopReq.current) {
        setDone(r.stoppedFor ?? 'ustavljeno');
        return;
      }
      setTimeout(tick, 420);
    };
    const first = setTimeout(tick, 250);
    return () => {
      alive = false;
      clearTimeout(first);
    };
  }, [stepDay]);

  useEffect(() => {
    if (!done) return;
    const tm = setTimeout(onClose, done === 'tekma' ? 1300 : 1800);
    return () => clearTimeout(tm);
  }, [done, onClose]);

  // teden okoli trenutnega dne (pon–ned)
  const dow = (new Date(current + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const monday = addDays(current, -dow);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const clubOf = (id: string) => game.clubs.find((c) => c.id === id)!;
  const userDays = new Set(game.fixtures.filter((f) => f.home === game.userClubId || f.away === game.userClubId).map((f) => f.date));
  const leagueDays = new Set(game.fixtures.map((f) => f.date));
  const WD = [t('pon'), t('tor'), t('sre'), t('čet'), t('pet'), t('sob'), t('ned')];

  return (
    <div className="sheet" style={{ alignItems: 'center' }}>
      <div className="sheet-in" style={{ borderRadius: 24, margin: 16, maxWidth: 480, width: 'calc(100% - 32px)', maxHeight: '78dvh', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="row">
          <div>
            <div className="lbl">{done ? t('Ustavljeno') : t('Nadaljujem…')}</div>
            <div className="h" style={{ fontSize: 24, marginTop: 4 }}>{fmtDate(current)}</div>
          </div>
          {!done ? (
            <button className="btn sec" style={{ height: 40 }} onClick={() => (stopReq.current = true)}>{t('Ustavi')}</button>
          ) : (
            <button className="btn" style={{ height: 40 }} onClick={onClose}>{t('Naprej')}</button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {week.map((d, i) => {
            const isCur = d === current;
            const past = d < current;
            const mine = userDays.has(d);
            return (
              <div key={d} style={{ textAlign: 'center', padding: '8px 0', borderRadius: 14, background: isCur ? 'linear-gradient(180deg,#5e97ff,#3f78f0)' : past ? 'rgba(255,255,255,0.04)' : 'var(--surface2)', border: mine && !isCur ? '1px solid color-mix(in srgb, var(--accent) 60%, transparent)' : '1px solid transparent', transform: isCur ? 'scale(1.06)' : 'none', transition: 'all .3s ease', opacity: past ? 0.55 : 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.8 }}>{WD[i]}</div>
                <div className="score" style={{ fontSize: 20 }}>{Number(d.slice(8))}</div>
                <div style={{ height: 6, display: 'flex', justifyContent: 'center' }}>
                  {mine ? <span className="dot" style={{ width: 6, height: 6, background: isCur ? '#fff' : 'var(--accent2)' }} /> : leagueDays.has(d) ? <span className="dot" style={{ width: 4, height: 4, background: 'var(--muted)' }} /> : null}
                </div>
              </div>
            );
          })}
        </div>

        {done && <div className="card" style={{ padding: '10px 14px', fontSize: 13, borderColor: 'var(--accent)' }}>{t(STOP_TEXT[done] ?? 'Ustavljeno.')}</div>}

        <div style={{ overflow: 'auto', flex: 1, minHeight: 120 }}>
          {days.length === 0 && <p className="muted" style={{ fontSize: 13 }}>…</p>}
          {days.map((d) => (
            <div key={d.date} style={{ padding: '8px 0', borderTop: '1px solid var(--line)', animation: 'rise .3s ease both' }}>
              <div className="muted" style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{fmtDate(d.date).toUpperCase()}</div>
              {d.results.length === 0 && d.news.length === 0 && <div className="muted" style={{ fontSize: 12 }}>{t('Trening in priprave')}</div>}
              {d.results.map((r, i) => (
                <div key={i} className="row" style={{ fontSize: 13, padding: '2px 0', fontWeight: r.mine ? 800 : 500, color: r.mine ? 'var(--accent2)' : undefined }}>
                  <span>{clubOf(r.home).short} – {clubOf(r.away).short}</span>
                  <span className="score" style={{ fontSize: 16 }}>{r.hg}:{r.ag}{r.so ? ' KS' : r.ot ? ' POD' : ''}</span>
                </div>
              ))}
              {d.news.filter((n) => !n.startsWith('Zmaga') && !n.startsWith('Poraz')).slice(0, 3).map((n, i) => (
                <div key={'n' + i} style={{ fontSize: 12, color: '#c9d4e8', padding: '2px 0' }}>• {n}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
