'use client';
import { useState } from 'react';
import { Shell } from '@/components/ui';
import { useGame } from '@/store/game';

export default function Prestopi() {
  const reset = useGame((s) => s.reset);
  const [confirm, setConfirm] = useState(false);
  return (
    <Shell>
      <div className="page">
        <h1 className="h title">Prestopi</h1>
        <section className="card" style={{ fontSize: 13, lineHeight: 1.6 }}>
          <div className="lbl" style={{ marginBottom: 6 }}>Kmalu · faza 5</div>
          Prestopni trg z igralci IHL, prostimi igralci in AI igralci od zunaj, pogajanja, pogodbe in prestopni rok pridejo v naslednjih fazah.
        </section>
        <section className="card">
          <div className="lbl" style={{ marginBottom: 8 }}>Nastavitve</div>
          {!confirm ? (
            <button className="btn ghost block" onClick={() => setConfirm(true)}>Začni novo igro</button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 13, color: 'var(--gold)', margin: 0 }}>Trenutna kariera bo izbrisana. Res želiš začeti znova?</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn sec" style={{ flex: 1 }} onClick={() => setConfirm(false)}>Prekliči</button>
                <button className="btn" style={{ flex: 1 }} onClick={() => reset()}>Izbriši in začni znova</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
