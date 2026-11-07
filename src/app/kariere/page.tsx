'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackLink, Shell } from '@/components/ui';
import { useGame } from '@/store/game';
import { useT } from '@/i18n';
import { fmtDate } from '@/engine/season';
import { deleteSlot, exportGame, listSlots, loadSlot, readGameFile, saveSlot, type SlotMeta } from '@/store/slots';

export default function Kariere() {
  const game = useGame((s) => s.game);
  const loadGame = useGame((s) => s.loadGame);
  const reset = useGame((s) => s.reset);
  const update = useGame((s) => s.update);
  const t = useT();
  const router = useRouter();
  const [slots, setSlots] = useState<SlotMeta[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const refresh = () => listSlots().then(setSlots);
  useEffect(() => { refresh(); }, []);

  // pred menjavo shrani trenutno kariero v njeno mesto
  const saveCurrent = async () => {
    if (!game) return;
    const g = useGame.getState().game!;
    const m = await saveSlot(g);
    update((x) => { x.slotId = m.id; });
  };

  const open = async (id: string) => {
    await saveCurrent();
    const g = await loadSlot(id);
    if (!g) { setMsg({ ok: false, text: 'Shranjene igre ni bilo mogoče naložiti.' }); return; }
    loadGame(g);
    router.replace('/domov');
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const g = await readGameFile(f);
      await saveCurrent();
      g.slotId = undefined;
      loadGame(g);
      await saveSlot(useGame.getState().game!);
      router.replace('/domov');
    } catch {
      setMsg({ ok: false, text: 'Datoteka ni veljavna shranjena igra.' });
    }
  };

  return (
    <Shell>
      <div className="page">
        <BackLink href="/klub" label="Klub" />
        <h1 className="h title">{t('Kariere in shranjevanje')}</h1>
        <p className="muted" style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>{t('Trenutna kariera se shranjuje samodejno. Tu lahko imaš več karier hkrati in naredi varnostno kopijo v datoteko.')}</p>
        {msg && <div className="card" style={{ fontSize: 13, color: msg.ok ? 'var(--good)' : 'var(--gold)' }}>{t(msg.text)}</div>}

        {game && (
          <section className="card" style={{ borderColor: 'var(--accent)' }}>
            <div className="lbl">{t('Trenutna kariera')}</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 4 }}>{game.manager.first} {game.manager.last} · {game.clubs.find((c) => c.id === game.userClubId)?.short}</div>
            <div className="muted" style={{ fontSize: 12 }}>{fmtDate(game.date)}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn sec" style={{ flex: 1, height: 40, fontSize: 13 }} onClick={async () => { await saveCurrent(); await refresh(); setMsg({ ok: true, text: 'Kariera je shranjena.' }); }}>{t('Shrani')}</button>
              <button className="btn sec" style={{ flex: 1, height: 40, fontSize: 13 }} onClick={() => exportGame(useGame.getState().game!)}>{t('Izvozi datoteko')}</button>
            </div>
            <button className="btn ghost block" style={{ marginTop: 8, height: 40, fontSize: 13 }} onClick={async () => { await saveCurrent(); reset(); router.replace('/nova'); }}>{t('Začni dodatno kariero')}</button>
          </section>
        )}

        <section className="card">
          <div className="lbl" style={{ marginBottom: 6 }}>{t('Shranjene kariere')}</div>
          {slots.length === 0 && <p className="muted" style={{ fontSize: 13, margin: 0 }}>{t('Še ni shranjenih karier.')}</p>}
          {slots.map((m) => (
            <div key={m.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
              <div className="row" style={{ fontSize: 13 }}>
                <span><b>{m.club}</b>{game?.slotId === m.id && <span style={{ color: 'var(--accent)', fontSize: 11 }}> · {t('trenutna')}</span>}<br /><span className="muted" style={{ fontSize: 11 }}>{m.name} · {t('sezona')} {m.season} · {fmtDate(m.date)}</span></span>
                <span style={{ display: 'flex', gap: 6 }}>
                  {game?.slotId !== m.id && <button className="btn sec" style={{ height: 34, padding: '0 12px', fontSize: 12 }} onClick={() => open(m.id)}>{t('Naloži')}</button>}
                  {confirmDel === m.id ? (
                    <button className="btn" style={{ height: 34, padding: '0 10px', fontSize: 12, background: 'var(--bad)' }} onClick={async () => { await deleteSlot(m.id); setConfirmDel(null); refresh(); }}>{t('Izbriši')}</button>
                  ) : (
                    <button className="btn ghost" style={{ height: 34, width: 34, fontSize: 12 }} onClick={() => setConfirmDel(m.id)}>✕</button>
                  )}
                </span>
              </div>
            </div>
          ))}
        </section>

        <section className="card">
          <div className="lbl" style={{ marginBottom: 6 }}>{t('Uvoz')}</div>
          <p className="muted" style={{ fontSize: 12, margin: '0 0 8px' }}>{t('Naloži kariero iz datoteke, ki si jo prej izvozil (npr. z drugega telefona).')}</p>
          <input ref={file} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />
          <button className="btn sec block" style={{ height: 40, fontSize: 13 }} onClick={() => file.current?.click()}>{t('Uvozi datoteko')}</button>
        </section>
      </div>
    </Shell>
  );
}
