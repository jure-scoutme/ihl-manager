'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bar, Shell } from '@/components/ui';
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
          <section className="card" style={{ textAlign: 'center', padding: 20 }}>
            <div className="lbl">Danes · {fmtDate(game.date)}</div>
            <div className="h" style={{ fontSize: 30, margin: '12px 0' }}>{clubOf(fixture!.home).short} – {clubOf(fixture!.away).short}</div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>{clubOf(fixture!.home).arena.name}, {clubOf(fixture!.home).arena.city}</div>
            <button className="btn block" onClick={start}>Začni tekmo</button>
            <Link href="/postave" className="btn ghost block" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>Uredi postave pred tekmo</Link>
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
        <section className="card" style={{ padding: '14px 16px' }}>
          <div className="row">
            <div style={{ textAlign: 'center', width: 100 }}><div className="h" style={{ fontSize: 20, color: mySide === 'home' ? 'var(--accent)' : undefined }}>{sim.home.name}</div><div className="muted" style={{ fontSize: 11 }}>SOG {sim.home.shots}</div></div>
            <div style={{ textAlign: 'center' }}>
              <div className="h" style={{ fontSize: 46, lineHeight: 1 }}>{sim.home.score} : {sim.away.score}</div>
              <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600, marginTop: 2 }}>{period}</div>
            </div>
            <div style={{ textAlign: 'center', width: 100 }}><div className="h" style={{ fontSize: 20, color: mySide === 'away' ? 'var(--accent)' : undefined }}>{sim.away.name}</div><div className="muted" style={{ fontSize: 11 }}>SOG {sim.away.shots}</div></div>
          </div>
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '36px 1fr 36px', gap: 8, alignItems: 'center', fontSize: 12 }}>
            <span>{homePos} %</span>
            <div className="bar" style={{ display: 'flex' }}><div style={{ width: `${homePos}%` }} /><div style={{ flex: 1, background: '#4a5a78' }} /></div>
            <span style={{ textAlign: 'right' }}>{100 - homePos} %</span>
          </div>
          <div className="muted" style={{ fontSize: 10, textAlign: 'center' }}>Posest · kazni {sim.home.pim}:{sim.away.pim} min · PP {sim.home.ppGoals}/{sim.home.ppOpps} : {sim.away.ppGoals}/{sim.away.ppOpps}</div>
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
          <div className="h" style={{ fontSize: 24, margin: '8px 0 4px' }}>{clubOf(next.home).short} – {clubOf(next.away).short}</div>
          <div className="muted" style={{ fontSize: 12 }}>{fmtDate(next.date)} · {clubOf(next.home).arena.name}</div>
        </section>
      )}
      {last?.result && (
        <section className="card">
          <div className="lbl">Zadnja tekma · {fmtDate(last.date)}</div>
          <div className="h" style={{ fontSize: 28, margin: '8px 0' }}>{clubOf(last.home).short} {last.result.hg}:{last.result.ag} {clubOf(last.away).short}{last.result.so ? ' (KS)' : last.result.ot ? ' (POD)' : ''}</div>
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
