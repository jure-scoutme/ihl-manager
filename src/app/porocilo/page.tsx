'use client';
import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BackLink, Crest, POS_LABEL, Shell, heroBg } from '@/components/ui';
import { useGame } from '@/store/game';
import { fmtDate } from '@/engine/season';
import type { Fixture, GameState } from '@/engine/types';

const clock = (t: number) => {
  const p = Math.min(4, Math.floor(t / 1200) + 1);
  const inP = t - (p - 1) * 1200;
  return { p, txt: `${Math.floor(inP / 60)}:${String(Math.floor(inP % 60)).padStart(2, '0')}` };
};
const PERIOD_NAME = ['', '1. tretjina', '2. tretjina', '3. tretjina', 'Podaljšek'];
const STRENGTH: Record<string, string> = { PP: 'PP', SH: 'SH', EN: 'PM' };

function Report() {
  const game = useGame((s) => s.game)!;
  const id = useSearchParams().get('id') ?? '';
  if (!game) return null;
  const f = game.fixtures.find((x) => x.id === id);
  if (!f?.result) return <div className="page"><BackLink href="/liga" label="Liga" /><p>Poročilo ni na voljo.</p></div>;
  return <ReportBody game={game} f={f} />;
}

function ReportBody({ game, f }: { game: GameState; f: Fixture }) {
  const r = f.result!;
  const clubOf = (cid: string) => game.clubs.find((c) => c.id === cid)!;
  const P = (pid: string) => game.players[pid];
  const nm = (pid: string) => {
    const p = P(pid);
    return p ? `${p.first[0]}. ${p.last}` : 'bivši igralec';
  };
  const home = clubOf(f.home);
  const away = clubOf(f.away);
  const hasOT = r.ot || r.so || r.goals.some((g) => g.t >= 3600);
  const nP = hasOT ? 4 : 3;
  const goalsBy = (side: 'home' | 'away', p: number) => r.goals.filter((g) => g.team === side && clock(g.t).p === p).length;
  const box = r.box ?? [];
  const goalieRow = (side: 0 | 1) => {
    const gid = r.goalies?.[side === 0 ? 'home' : 'away'];
    const row = box.find((b) => b[0] === gid);
    if (!gid || !row) return null;
    const sa = row[7];
    const ga = row[8];
    return { id: gid, sa, ga, sv: sa - ga, pct: sa ? ((sa - ga) / sa) * 100 : 0 };
  };
  const skaters = (side: 0 | 1) =>
    box
      .filter((b) => b[1] === side && P(b[0])?.pos !== 'G')
      .sort((a, b) => b[2] + b[3] - (a[2] + a[3]) || b[2] - a[2] || b[6] - a[6]);

  // dogodki po tretjinah
  type Ev = { t: number; kind: 'gol' | 'kazen'; side: 'home' | 'away'; text: string; sub?: string; score?: string };
  const evs: Ev[] = [];
  let hs = 0;
  let as = 0;
  for (const g of [...r.goals].sort((a, b) => a.t - b.t)) {
    if (g.team === 'home') hs++;
    else as++;
    evs.push({ t: g.t, kind: 'gol', side: g.team, text: nm(g.scorer) + (STRENGTH[g.strength] ? ` (${STRENGTH[g.strength]})` : ''), sub: g.assists.length ? g.assists.map(nm).join(', ') : 'brez podaje', score: `${hs}:${as}` });
  }
  for (const pn of r.penalties ?? []) evs.push({ t: pn.t, kind: 'kazen', side: pn.team, text: `${nm(pn.playerId)} · ${pn.min} min`, sub: pn.reason });
  evs.sort((a, b) => a.t - b.t);

  const stat = (label: string, h: string | number, a: string | number) => (
    <div className="row" style={{ fontSize: 13, padding: '6px 0', borderTop: '1px solid var(--line)' }}>
      <span style={{ width: 60, fontWeight: 700 }}>{h}</span>
      <span className="muted" style={{ flex: 1, textAlign: 'center' }}>{label}</span>
      <span style={{ width: 60, textAlign: 'right', fontWeight: 700 }}>{a}</span>
    </div>
  );
  const pim = (side: 'home' | 'away') => (r.penalties ?? []).filter((x) => x.team === side).reduce((s, x) => s + x.min, 0);
  const ppGoals = (side: 'home' | 'away') => r.goals.filter((g) => g.team === side && g.strength === 'PP').length;
  const ppOpps = (side: 'home' | 'away') => (r.penalties ?? []).filter((x) => x.team !== side).length;
  const gH = goalieRow(0);
  const gA = goalieRow(1);
  const stageName: Record<string, string> = { redni: `Redni del · ${f.round}. krog`, cetrtfinale: 'Četrtfinale', polfinale: 'Polfinale', finale: 'Finale' };

  return (
    <div className="page">
      <BackLink href="/liga" label="Liga" />
      <section className="hero" style={{ background: heroBg(home.color, away.color) }}>
        <div style={{ textAlign: 'center' }}><span className="pill" style={{ background: 'rgba(255,255,255,.18)' }}>{stageName[f.stage]} · {fmtDate(f.date)}</span></div>
        <div className="row" style={{ margin: '12px 0 6px' }}>
          <div style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }} className="h"><Crest club={home} size={48} /><span style={{ fontSize: 20,  }}>{home.short}</span></div>
          <div className="score" style={{ fontSize: 56, lineHeight: 1 }}>{r.hg}<span style={{ opacity: 0.5, margin: '0 6px' }}>:</span>{r.ag}</div>
          <div style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }} className="h"><Crest club={away} size={48} /><span style={{ fontSize: 20,  }}>{away.short}</span></div>
        </div>
        <div style={{ fontSize: 12, textAlign: 'center', opacity: 0.85 }}>
          {r.so ? 'po kazenskih strelih · ' : r.ot ? 'po podaljšku · ' : ''}
          ({Array.from({ length: nP }, (_, i) => `${goalsBy('home', i + 1)}:${goalsBy('away', i + 1)}`).join(', ')})
        </div>
        <div style={{ fontSize: 12, textAlign: 'center', marginTop: 4, opacity: 0.75 }}>{home.arena.name}, {home.arena.city} · {r.attendance} gledalcev</div>
      </section>

      <section className="card" style={{ padding: '8px 14px' }}>
        <div className="row" style={{ padding: '4px 0 6px' }}>
          <span className="lbl" style={{ width: 60 }}>{home.short}</span>
          <span className="lbl">Statistika</span>
          <span className="lbl" style={{ width: 60, textAlign: 'right' }}>{away.short}</span>
        </div>
        {stat('Streli na gol', r.hShots, r.aShots)}
        {r.shotsByPeriod && stat('Streli po tretjinah', r.shotsByPeriod.home.slice(0, nP).join('-'), r.shotsByPeriod.away.slice(0, nP).join('-'))}
        {r.penalties && stat('Igralec več', `${ppGoals('home')}/${ppOpps('home')}`, `${ppGoals('away')}/${ppOpps('away')}`)}
        {r.penalties && stat('Kazenske minute', pim('home'), pim('away'))}
        {gH && gA && stat('Obrambe golmana', `${gH.sv}/${gH.sa}`, `${gA.sv}/${gA.sa}`)}
      </section>

      <section className="card" style={{ padding: '6px 14px' }}>
        <div className="lbl" style={{ padding: '8px 0' }}>Potek tekme</div>
        {Array.from({ length: nP }, (_, i) => i + 1).map((p) => {
          const list = evs.filter((e) => clock(e.t).p === p);
          return (
            <div key={p} style={{ marginBottom: 6 }}>
              <div className="muted" style={{ fontSize: 11, fontWeight: 700, padding: '6px 0', borderTop: '1px solid var(--line)' }}>{PERIOD_NAME[p]}</div>
              {list.length === 0 && <div className="muted" style={{ fontSize: 12, paddingBottom: 6 }}>Brez golov in kazni</div>}
              {list.map((e, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '42px 1fr 40px', gap: 8, padding: '6px 0', fontSize: 13, alignItems: 'start' }}>
                  <span className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{clock(e.t).txt}</span>
                  <span style={{ textAlign: e.side === 'away' ? 'right' : 'left' }}>
                    <span style={{ fontWeight: e.kind === 'gol' ? 700 : 500, color: e.kind === 'kazen' ? 'var(--gold)' : undefined }}>{e.kind === 'gol' ? '● ' : ''}{e.text}</span>
                    <span className="muted" style={{ display: 'block', fontSize: 11 }}>{(e.side === 'home' ? home : away).short} · {e.sub}</span>
                  </span>
                  <span className="h" style={{ fontSize: 16, textAlign: 'right' }}>{e.score ?? ''}</span>
                </div>
              ))}
            </div>
          );
        })}
        {r.shootout && r.shootout.length > 0 && (
          <div>
            <div className="muted" style={{ fontSize: 11, fontWeight: 700, padding: '6px 0', borderTop: '1px solid var(--line)' }}>Kazenski streli</div>
            {r.shootout.map((x, i) => (
              <div key={i} className="row" style={{ fontSize: 13, padding: '4px 0' }}>
                <span>{nm(x.playerId)} <span className="muted">({(x.team === 'home' ? home : away).short})</span></span>
                <span style={{ color: x.scored ? 'var(--good)' : 'var(--muted)', fontWeight: 600 }}>{x.scored ? 'zadetek' : 'zgreši'}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {([0, 1] as const).map((side) => {
        const g = side === 0 ? gH : gA;
        const club = side === 0 ? home : away;
        const rows = skaters(side);
        if (!rows.length) return null;
        return (
          <section key={side} className="card" style={{ padding: '0 6px' }}>
            <div className="lbl" style={{ padding: '10px 6px 0' }}>{club.name}</div>
            {g && (
              <table className="t">
                <thead><tr><th>Golman</th><th className="num">Streli</th><th className="num">Obr.</th><th className="num">Prej.</th><th className="num">%</th></tr></thead>
                <tbody>
                  <tr>
                    <td><Link href={`/igralec?id=${g.id}`} style={{ fontWeight: 600 }}>{nm(g.id)}</Link></td>
                    <td className="num">{g.sa}</td><td className="num">{g.sv}</td><td className="num">{g.ga}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{g.pct.toFixed(1)}</td>
                  </tr>
                </tbody>
              </table>
            )}
            <table className="t">
              <thead><tr><th>Igralec</th><th>Poz</th><th className="num">G</th><th className="num">P</th><th className="num">Tč</th><th className="num">+/-</th><th className="num">S</th><th className="num">KM</th></tr></thead>
              <tbody>
                {rows.map((b) => {
                  const p = P(b[0]);
                  const pts = b[2] + b[3];
                  return (
                    <tr key={b[0]}>
                      <td>{p ? <Link href={`/igralec?id=${b[0]}`} style={{ fontWeight: pts ? 700 : 500 }}>{nm(b[0])}</Link> : nm(b[0])}</td>
                      <td className="muted">{p ? POS_LABEL[p.pos] : ''}</td>
                      <td className="num">{b[2] || ''}</td>
                      <td className="num">{b[3] || ''}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{pts || ''}</td>
                      <td className="num" style={{ color: b[4] > 0 ? 'var(--good)' : b[4] < 0 ? 'var(--bad)' : undefined }}>{b[4] > 0 ? `+${b[4]}` : b[4] || ''}</td>
                      <td className="num muted">{b[6] || ''}</td>
                      <td className="num muted">{b[5] || ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
      {!r.box && <p className="muted" style={{ fontSize: 12 }}>Podrobna statistika igralcev je na voljo za tekme, odigrane po tej posodobitvi.</p>}
      <p className="muted" style={{ fontSize: 11, margin: 0 }}>G goli · P podaje · Tč točke · S streli na gol · KM kazenske minute · PP igralec več · SH igralec manj · PM prazna mreža</p>
    </div>
  );
}

export default function PorociloPage() {
  return (
    <Shell>
      <Suspense fallback={null}>
        <Report />
      </Suspense>
    </Shell>
  );
}
