'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bar, Crest, Shell, heroBg } from '@/components/ui';
import { useGame } from '@/store/game';
import { applyResult, fmtDate, makeSim, nextUserFixture, userFixtureToday } from '@/engine/season';
import { shortName } from '@/engine/players';
import type { MatchSim, Side } from '@/engine/sim';
import type { Fixture, Tactics } from '@/engine/types';

const SPEEDS = [1, 3, 10];

export default function Tekma() {
  const game = useGame((s) => s.game)!;
  const update = useGame((s) => s.update);
  const router = useRouter();
  const simRef = useRef<MatchSim | null>(null);
  const [, setTick] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [running, setRunning] = useState(false);
  const [timeoutUsed, setTimeoutUsed] = useState(false);
  const fixture = game ? userFixtureToday(game) : undefined;

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      const sim = simRef.current;
      if (!sim) return;
      for (let i = 0; i < speed && !sim.over; i++) sim.step();
      if (sim.over) setRunning(false);
      setTick((t) => t + 1);
    }, 110);
    return () => clearInterval(iv);
  }, [running, speed]);

  if (!game) return <Shell>{null}</Shell>;
  const clubOf = (id: string) => game.clubs.find((c) => c.id === id)!;

  if (!fixture && !simRef.current) return <Shell><LastMatch /></Shell>;

  const start = () => {
    const g = useGame.getState().game!;
    const f = g.fixtures.find((x) => x.id === fixture!.id)!;
    simRef.current = makeSim(g, f);
    setRunning(true);
    setTick((t) => t + 1);
  };

  const sim = simRef.current;
  const mySide: Side = fixture ? (fixture.home === game.userClubId ? 'home' : 'away') : 'home';

  if (!sim) {
    return (
      <Shell>
        <div className="page">
          <h1 className="h title">Tekma</h1>
          <section className="hero" style={{ textAlign: 'center', background: heroBg(clubOf(fixture!.home).color, clubOf(fixture!.away).color) }}>
            <div className="pill" style={{ background: 'rgba(255,255,255,.18)' }}>DANES · {fmtDate(game.date).toUpperCase()}</div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18, margin: '18px 0 10px' }}>
              <Crest club={clubOf(fixture!.home)} size={64} /><span className="score" style={{ fontSize: 24, opacity: 0.7 }}>VS</span><Crest club={clubOf(fixture!.away)} size={64} />
            </div>
            <div className="h" style={{ fontSize: 22, marginBottom: 4 }}>{clubOf(fixture!.home).short} – {clubOf(fixture!.away).short}</div>
            <div style={{ fontSize: 13, marginBottom: 16, opacity: 0.8 }}>{clubOf(fixture!.home).arena.name}, {clubOf(fixture!.home).arena.city}</div>
            <button className="btn white block" onClick={start}>▶ Začni tekmo</button>
            <Link href="/postave" className="btn glass block" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>Uredi postave pred tekmo</Link>
          </section>
        </div>
      </Shell>
    );
  }

  const me = sim.team(mySide);
  const setTac = (t: Partial<Tactics>) => {
    sim.setTactics(mySide, t);
    update((g) => { g.tactics[g.userClubId] = { ...g.tactics[g.userClubId], ...t }; });
  };
  const onIce = sim.skatersOnIce(mySide);
  const onIceIds = [...onIce.f, ...onIce.d];
  const lineEnergy = Math.round(onIceIds.reduce((s, id) => s + (sim.energy[id] ?? 80), 0) / Math.max(1, onIceIds.length));
  const totalPos = sim.home.possession + sim.away.possession || 1;
  const homePos = Math.round((sim.home.possession / totalPos) * 100);
  const ppText = (() => {
    const myPen = me.penalties.length;
    const opPen = sim.team(sim.other(mySide)).penalties.length;
    if (opPen > myPen) return 'Igralec več';
    if (myPen > opPen) return 'Igralec manj';
    return '';
  })();
  const period = sim.over ? 'Konec' : sim.shootout ? 'Kazenski streli' : sim.inOT ? `Podaljšek · ${sim.clock()}` : `${sim.period}. tretjina · ${sim.clock()}`;
  const feed = sim.events.filter((e) => e.kind !== 'bulij').slice(-40).reverse();

  const finish = () => {
    update((g) => {
      const f = g.fixtures.find((x) => x.id === fixture!.id) as Fixture;
      if (!f.played) applyResult(g, f, sim);
    });
    const fid = fixture!.id;
    simRef.current = null;
    router.push(`/porocilo?id=${fid}`);
  };

  return (
    <Shell>
      <div className="page">
        <section className="hero" style={{ background: heroBg(clubOf(sim.home.clubId).color, clubOf(sim.away.clubId).color) }}>
          <div style={{ textAlign: 'center' }}><span className="pill" style={{ background: sim.over ? 'rgba(255,255,255,.18)' : 'rgba(255,90,90,.9)' }}>{sim.over ? 'KONEC' : '● V ŽIVO'}</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}><Crest club={clubOf(sim.home.clubId)} size={52} /><div className="h" style={{ fontSize: 15 }}>{sim.home.name}</div></div>
            <div style={{ textAlign: 'center' }}>
              <div className="score" style={{ fontSize: 56, lineHeight: 1 }}>{sim.home.score}<span style={{ opacity: 0.5, margin: '0 6px' }}>:</span>{sim.away.score}</div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, opacity: 0.9 }}>{period}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}><Crest club={clubOf(sim.away.clubId)} size={52} /><div className="h" style={{ fontSize: 15 }}>{sim.away.name}</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, marginTop: 14, fontSize: 12, rowGap: 6 }}>
            {[
              [sim.home.shots, 'Streli na gol', sim.away.shots],
              [`${homePos}%`, 'Posest', `${100 - homePos}%`],
              [`${sim.home.ppGoals}/${sim.home.ppOpps}`, 'Igralec več', `${sim.away.ppGoals}/${sim.away.ppOpps}`],
              [sim.home.pim, 'Kazenske min', sim.away.pim],
            ].map(([a, l, b]) => (
              <div key={l as string} style={{ display: 'contents' }}>
                <span style={{ fontWeight: 800, textAlign: 'left' }}>{a}</span>
                <span style={{ opacity: 0.75, textAlign: 'center' }}>{l}</span>
                <span style={{ fontWeight: 800, textAlign: 'right' }}>{b}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card" style={{ padding: '10px 14px' }}>
          <div className="row"><span className="lbl">Na ledu</span>{ppText && <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600 }}>{ppText}</span>}</div>
          <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
            <b>Napad:</b> {onIce.f.map((id) => shortName(game.players[id])).join(' – ')}<br />
            <b>Obramba:</b> {onIce.d.map((id) => shortName(game.players[id])).join(' – ')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 11 }} className="muted">Svežina <div style={{ flex: 1 }}><Bar value={lineEnergy} color={lineEnergy < 60 ? 'var(--gold)' : undefined} /></div>{lineEnergy} %</div>
        </section>

        <section className="card" style={{ padding: '4px 14px', maxHeight: 300, overflow: 'auto' }}>
          <div className="lbl" style={{ padding: '8px 0' }}>Prenos</div>
          <div className="feed">
            {feed.map((e, i) => (
              <div key={i} className={`ev ${e.kind === 'gol' && !sim.shootout ? 'gol' : ''}`}>
                <span className="t" style={{ color: e.kind === 'gol' ? 'var(--accent)' : undefined }}>{e.kind === 'tretjina' || e.kind === 'konec' ? '' : sim.clock(e.t)}</span>
                <span style={{ fontWeight: e.kind === 'gol' || e.kind === 'konec' ? 700 : 400, color: e.kind === 'kazen' ? 'var(--gold)' : e.kind === 'gol' ? 'var(--accent)' : undefined }}>{e.text}</span>
              </div>
            ))}
          </div>
        </section>

        {!sim.over ? (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="lbl">Forček</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {([['agresiven', 'Agresiven'], ['uravnotezen', 'Uravnotežen'], ['pasiven', 'Pasiven']] as const).map(([k, l]) => (
                <button key={k} className={`chip ${me.tactics.forecheck === k ? 'on' : ''}`} style={{ flex: 1 }} onClick={() => setTac({ forecheck: k })}>{l}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn sec" style={{ flex: 1 }} disabled={timeoutUsed} onClick={() => { onIceIds.forEach((id) => (sim.energy[id] = Math.min(100, (sim.energy[id] ?? 80) + 15))); setTimeoutUsed(true); sim.events.push({ t: sim.t, side: mySide, kind: 'info', text: `${me.name} vzame time-out.` }); }}>Time-out</button>
              <button className="btn sec" style={{ flex: 1 }} onClick={() => setRunning(!running)}>{running ? 'Pavza' : 'Nadaljuj'}</button>
              <button className="btn" style={{ flex: 1 }} onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}>Hitrost {speed}×</button>
            </div>
            <button className="btn ghost" onClick={() => { sim.runToEnd(); setRunning(false); setTick((t) => t + 1); }}>Simuliraj do konca</button>
          </section>
        ) : (
          <button className="btn block" onClick={finish}>Zaključi tekmo</button>
        )}
      </div>
    </Shell>
  );
}

function LastMatch() {
  const game = useGame((s) => s.game)!;
  const clubOf = (id: string) => game.clubs.find((c) => c.id === id)!;
  const last = game.fixtures
    .filter((f) => f.played && (f.home === game.userClubId || f.away === game.userClubId))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const next = nextUserFixture(game);
  return (
    <div className="page">
      <h1 className="h title">Tekma</h1>
      {next && (
        <section className="card">
          <div className="lbl">Naslednja tekma</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 6px' }}><Crest club={clubOf(next.home)} size={32} /><span className="h" style={{ fontSize: 20 }}>{clubOf(next.home).short} – {clubOf(next.away).short}</span><Crest club={clubOf(next.away)} size={32} /></div>
          <div className="muted" style={{ fontSize: 12 }}>{fmtDate(next.date)} · {clubOf(next.home).arena.name}</div>
        </section>
      )}
      {last?.result && (
        <section className="card">
          <div className="lbl">Zadnja tekma · {fmtDate(last.date)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', margin: '12px 0' }}>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}><Crest club={clubOf(last.home)} size={44} /><b style={{ fontSize: 14 }}>{clubOf(last.home).short}</b></span>
            <span className="score" style={{ fontSize: 40 }}>{last.result.hg}:{last.result.ag}<span style={{ fontSize: 14, opacity: 0.6 }}>{last.result.so ? ' KS' : last.result.ot ? ' POD' : ''}</span></span>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}><Crest club={clubOf(last.away)} size={44} /><b style={{ fontSize: 14 }}>{clubOf(last.away).short}</b></span>
          </div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Streli {last.result.hShots}:{last.result.aShots} · {last.result.attendance} gledalcev</div>
          <Link href={`/porocilo?id=${last.id}`} className="btn sec block" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '6px 0 8px' }}>Celotno poročilo s tekme</Link>
          {last.result.goals.map((g, i) => {
            const p = game.players[g.scorer];
            const m = Math.floor(g.t / 60);
            return (
              <div key={i} className="list-item" style={{ fontSize: 13 }}>
                <span className="muted" style={{ width: 36 }}>{m}'</span>
                <span>{p ? `${p.first[0]}. ${p.last}` : '—'} ({clubOf(g.team === 'home' ? last.home : last.away).short}){g.strength !== 'EV' ? ` · ${g.strength}` : ''}{g.assists.length ? <span className="muted"> · {g.assists.map((a) => game.players[a]?.last ?? '').join(', ')}</span> : null}</span>
              </div>
            );
          })}
        </section>
      )}
      {!last && !next && <p className="muted">Ni tekem.</p>}
    </div>
  );
}
