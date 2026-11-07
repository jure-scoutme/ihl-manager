'use client';
import { useState } from 'react';
import { BackLink, POS_LABEL, Shell, ovrColor } from '@/components/ui';
import { useGame } from '@/store/game';
import { autoLines } from '@/engine/players';
import { clubPlayers } from '@/engine/season';
import type { Lines, Player, Tactics } from '@/engine/types';

type Path = (string | number)[];
type Group = 'main' | 'pp' | 'pk';

const getAt = (l: Lines, p: Path): string => p.reduce<unknown>((o, k) => (o as Record<string | number, unknown>)[k], l) as string;
const setAt = (l: Lines, p: Path, v: string) => {
  const parent = p.slice(0, -1).reduce<unknown>((o, k) => (o as Record<string | number, unknown>)[k], l) as Record<string | number, unknown>;
  parent[p[p.length - 1]] = v;
};
const groupPaths = (l: Lines, g: Group): Path[] => {
  if (g === 'main') return [...l.f.flatMap((line, i) => line.map((_, j) => ['f', i, j])), ...l.d.flatMap((pr, i) => pr.map((_, j) => ['d', i, j])), ['g', 0], ['g', 1]];
  const units = l[g];
  return units.flatMap((u, i) => [...u.f.map((_, j) => [g, i, 'f', j]), ...u.d.map((_, j) => [g, i, 'd', j])]);
};

export default function Postave() {
  const game = useGame((s) => s.game)!;
  const update = useGame((s) => s.update);
  const [edit, setEdit] = useState<{ path: Path; group: Group; goalie: boolean } | null>(null);
  const [tab, setTab] = useState<Group>('main');
  if (!game) return <Shell>{null}</Shell>;
  const lines = game.lines[game.userClubId];
  const tac = game.tactics[game.userClubId];
  const roster = clubPlayers(game, game.userClubId);
  const P = (id: string) => game.players[id] as Player | undefined;

  const choose = (pid: string) => {
    if (!edit) return;
    update((g) => {
      const l = g.lines[g.userClubId];
      const current = getAt(l, edit.path);
      const other = groupPaths(l, edit.group).find((p) => getAt(l, p) === pid);
      if (other) setAt(l, other, current);
      setAt(l, edit.path, pid);
    });
    setEdit(null);
  };

  const setTac = (t: Partial<Tactics>) => update((g) => { g.tactics[g.userClubId] = { ...g.tactics[g.userClubId], ...t }; });

  const Slot = ({ path, group, label, goalie = false }: { path: Path; group: Group; label: string; goalie?: boolean }) => {
    const p = P(getAt(lines, path));
    return (
      <button className="slot" onClick={() => setEdit({ path, group, goalie })}>
        <small>{label}</small>
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: p?.injuryDays ? 'var(--bad)' : undefined }}>{p ? `${p.first[0]}. ${p.last}` : 'prazno'}</span>
          {p && <span className="ovr" style={{ fontSize: 15, color: ovrColor(p.ovr) }}>{p.ovr}</span>}
        </span>
      </button>
    );
  };

  const candidates = edit
    ? roster.filter((p) => (edit.goalie ? p.pos === 'G' : p.pos !== 'G')).sort((a, b) => b.ovr - a.ovr)
    : [];
  const inUse = edit ? new Set(groupPaths(lines, edit.group).map((p) => getAt(lines, p))) : new Set<string>();

  return (
    <Shell>
      <div className="page">
        <BackLink href="/kader" label="Kader" />
        <div className="row">
          <h1 className="h title">Postave in taktika</h1>
          <button className="btn sec" onClick={() => update((g) => { g.lines[g.userClubId] = autoLines(clubPlayers(g, g.userClubId)); })}>Samodejno</button>
        </div>

        <div className="seg">
          {([['main', 'Napadi'], ['pp', 'Igralec več'], ['pk', 'Igralec manj']] as const).map(([k, l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {tab === 'main' && (
          <>
            {lines.f.map((_, i) => (
              <section key={i}>
                <div className="lbl" style={{ marginBottom: 6 }}>{i + 1}. napad · {Math.round(tac.lineUsage[i] * 100)} % minutaže</div>
                <div className="grid3">
                  <Slot path={['f', i, 0]} group="main" label="LK" />
                  <Slot path={['f', i, 1]} group="main" label="C" />
                  <Slot path={['f', i, 2]} group="main" label="DK" />
                </div>
              </section>
            ))}
            {lines.d.map((_, i) => (
              <section key={i}>
                <div className="lbl" style={{ marginBottom: 6 }}>{i + 1}. obrambni par</div>
                <div className="grid2">
                  <Slot path={['d', i, 0]} group="main" label="LB" />
                  <Slot path={['d', i, 1]} group="main" label="DB" />
                </div>
              </section>
            ))}
            <section>
              <div className="lbl" style={{ marginBottom: 6 }}>Golmana</div>
              <div className="grid2">
                <Slot path={['g', 0]} group="main" label="Začetni" goalie />
                <Slot path={['g', 1]} group="main" label="Rezerva" goalie />
              </div>
            </section>
          </>
        )}

        {tab !== 'main' &&
          lines[tab].map((u, i) => (
            <section key={i}>
              <div className="lbl" style={{ marginBottom: 6 }}>{i + 1}. enota</div>
              <div className={u.f.length === 3 ? 'grid3' : 'grid2'} style={{ marginBottom: 6 }}>
                {u.f.map((_, j) => <Slot key={j} path={[tab, i, 'f', j]} group={tab} label="Napadalec" />)}
              </div>
              <div className="grid2">
                {u.d.map((_, j) => <Slot key={j} path={[tab, i, 'd', j]} group={tab} label="Branilec" />)}
              </div>
            </section>
          ))}

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="lbl">Forček</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {([['agresiven', 'Agresiven'], ['uravnotezen', 'Uravnotežen'], ['pasiven', 'Pasiven']] as const).map(([k, l]) => (
              <button key={k} className={`chip ${tac.forecheck === k ? 'on' : ''}`} style={{ flex: 1 }} onClick={() => setTac({ forecheck: k })}>{l}</button>
            ))}
          </div>
          <div className="lbl">Tempo</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {([['hiter', 'Hiter'], ['normalen', 'Normalen'], ['pocasen', 'Počasen']] as const).map(([k, l]) => (
              <button key={k} className={`chip ${tac.tempo === k ? 'on' : ''}`} style={{ flex: 1 }} onClick={() => setTac({ tempo: k })}>{l}</button>
            ))}
          </div>
          <div className="lbl">Minutaža napadov</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {([['Prvi napad', [0.4, 0.3, 0.2, 0.1]], ['Normalno', [0.34, 0.28, 0.22, 0.16]], ['Enakomerno', [0.27, 0.26, 0.25, 0.22]]] as const).map(([l, v]) => (
              <button key={l} className={`chip ${tac.lineUsage[0] === v[0] ? 'on' : ''}`} style={{ flex: 1 }} onClick={() => setTac({ lineUsage: [...v] as Tactics['lineUsage'] })}>{l}</button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12, margin: 0, lineHeight: 1.5 }}>Agresiven forček prinese več posesti in strelov, a tudi več kazni. Hiter tempo pomeni več priložnosti na obeh straneh in hitrejšo utrujenost.</p>
        </section>
      </div>

      {edit && (
        <div className="sheet" onClick={() => setEdit(null)}>
          <div className="sheet-in" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ marginBottom: 8 }}><span className="lbl">Izberi igralca</span><button className="chip" onClick={() => setEdit(null)}>Zapri</button></div>
            {candidates.map((p) => (
              <button key={p.id} className="pick" onClick={() => choose(p.id)} disabled={p.injuryDays > 0} style={{ opacity: p.injuryDays > 0 ? 0.45 : 1 }}>
                <span className="muted">{POS_LABEL[p.pos]}</span>
                <span>{p.first} {p.last}{inUse.has(p.id) ? <span className="muted" style={{ fontSize: 11 }}> · v postavi</span> : ''}{p.injuryDays > 0 ? <span style={{ color: 'var(--bad)', fontSize: 11 }}> · poškodba</span> : ''}</span>
                <span className="muted" style={{ fontSize: 12, textAlign: 'right' }}>{Math.round(p.energy)}%</span>
                <span className="ovr" style={{ textAlign: 'right', color: ovrColor(p.ovr) }}>{p.ovr}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}
