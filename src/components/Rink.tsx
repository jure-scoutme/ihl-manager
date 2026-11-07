'use client';
import type { MatchSim } from '@/engine/sim';

// 2D prikaz tekme: plošček in igralci se premikajo glede na dogajanje v simulaciji.
const W = 340;
const H = 160;
const GOAL_X = { left: 22, right: W - 22 };

function hash(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function Rink({ sim, homeColor, awayColor, goalLabel = 'GOL!' }: { sim: MatchSim; homeColor: string; awayColor: string; goalLabel?: string }) {
  const t = sim.t;
  const last = sim.events[sim.events.length - 1];
  const recent = last && t - last.t <= 10 ? last : undefined;
  // domači napadajo desno
  const attackSide = sim.possession;
  const dir = attackSide === 'home' ? 1 : -1;
  let px: number;
  let py: number;
  let flash: 'gol' | 'obramba' | null = null;
  if (sim.faceoffPending || recent?.kind === 'bulij' || recent?.kind === 'tretjina') {
    px = W / 2;
    py = H / 2;
  } else if (recent?.kind === 'gol' && recent.side) {
    px = recent.side === 'home' ? GOAL_X.right + 4 : GOAL_X.left - 4;
    py = H / 2;
    flash = 'gol';
  } else if ((recent?.kind === 'strel' || recent?.kind === 'obramba' || recent?.kind === 'blok') && recent.side) {
    const s = recent.side === 'home' ? 1 : -1;
    px = W / 2 + s * (W / 2 - 40 - hash(t) * 30);
    py = H / 2 + (hash(t + 3) - 0.5) * 50;
    if (recent.kind === 'obramba') flash = 'obramba';
  } else {
    // posest: plošček kroži v napadalni tretjini
    px = W / 2 + dir * (35 + hash(Math.floor(t / 5)) * 110);
    py = 25 + hash(Math.floor(t / 5) + 7) * (H - 50);
  }
  const n = (side: 'home' | 'away') => {
    const team = side === 'home' ? sim.home : sim.away;
    return Math.max(3, 5 - Math.min(2, team.penalties.length)) + (team.goaliePulled ? 1 : 0);
  };
  const skaters = (side: 'home' | 'away') => {
    const s = side === 'home' ? 1 : -1; // smer napada
    const attacking = attackSide === side;
    const shift = (px - W / 2) * 0.55;
    const base: [number, number][] = attacking
      ? [[60, -45], [75, 0], [60, 45], [10, -30], [10, 30], [95, 15]]
      : [[-20, -40], [-5, 0], [-20, 40], [-70, -28], [-70, 28], [-40, 0]];
    return base.slice(0, n(side)).map(([x, y], i) => {
      const jx = (hash(Math.floor(t / 5) * 7 + i + (side === 'home' ? 0 : 50)) - 0.5) * 18;
      const jy = (hash(Math.floor(t / 5) * 11 + i + (side === 'home' ? 3 : 77)) - 0.5) * 18;
      const cx = Math.max(14, Math.min(W - 14, W / 2 + s * x + shift + jx));
      const cy = Math.max(12, Math.min(H - 12, H / 2 + y + (py - H / 2) * 0.35 + jy));
      return [cx, cy] as [number, number];
    });
  };
  const dot = (x: number, y: number, color: string, key: string, r = 6) => (
    <g key={key} style={{ transform: `translate(${x}px, ${y}px)`, transition: 'transform .9s cubic-bezier(.4,.1,.3,1)' }}>
      <circle r={r} fill={color} stroke="#fff" strokeWidth={1.4} />
    </g>
  );
  return (
    <section className="card" style={{ padding: 8 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        <defs>
          <clipPath id="rinkclip"><rect x={2} y={2} width={W - 4} height={H - 4} rx={36} /></clipPath>
        </defs>
        <rect x={2} y={2} width={W - 4} height={H - 4} rx={36} fill="#e9f1f8" stroke="#b9c7d6" strokeWidth={2} />
        <g clipPath="url(#rinkclip)">
          <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="#e0424f" strokeWidth={2.5} />
          <line x1={W * 0.33} y1={0} x2={W * 0.33} y2={H} stroke="#3a6fd8" strokeWidth={3} />
          <line x1={W * 0.67} y1={0} x2={W * 0.67} y2={H} stroke="#3a6fd8" strokeWidth={3} />
          <line x1={GOAL_X.left} y1={0} x2={GOAL_X.left} y2={H} stroke="#e0424f" strokeWidth={1} />
          <line x1={GOAL_X.right} y1={0} x2={GOAL_X.right} y2={H} stroke="#e0424f" strokeWidth={1} />
          <circle cx={W / 2} cy={H / 2} r={20} fill="none" stroke="#3a6fd8" strokeWidth={1.2} />
          {[[70, 42], [70, H - 42], [W - 70, 42], [W - 70, H - 42]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={14} fill="none" stroke="#e0424f" strokeWidth={1} />)}
          <path d={`M ${GOAL_X.left} ${H / 2 - 12} a 12 12 0 0 1 0 24`} fill="#bfe0ff" stroke="#e0424f" strokeWidth={1} />
          <path d={`M ${GOAL_X.right} ${H / 2 - 12} a 12 12 0 0 0 0 24`} fill="#bfe0ff" stroke="#e0424f" strokeWidth={1} />
          <rect x={GOAL_X.left - 7} y={H / 2 - 8} width={7} height={16} fill="none" stroke="#c0392b" strokeWidth={2} />
          <rect x={GOAL_X.right} y={H / 2 - 8} width={7} height={16} fill="none" stroke="#c0392b" strokeWidth={2} />
        </g>
        {/* golmana */}
        {!sim.home.goaliePulled && dot(GOAL_X.left + 6, H / 2 + (py - H / 2) * 0.15, homeColor, 'hg', 7)}
        {!sim.away.goaliePulled && dot(GOAL_X.right - 6, H / 2 + (py - H / 2) * 0.15, awayColor, 'ag', 7)}
        {skaters('home').map(([x, y], i) => dot(x, y, homeColor, 'h' + i))}
        {skaters('away').map(([x, y], i) => dot(x, y, awayColor, 'a' + i))}
        <g style={{ transform: `translate(${px}px, ${py}px)`, transition: 'transform .7s cubic-bezier(.4,.1,.3,1)' }}>
          <circle r={3.2} fill="#111" />
        </g>
        {flash === 'gol' && <text x={W / 2} y={H / 2 - 30} textAnchor="middle" fontSize={22} fontWeight={900} fill="#e0424f">{goalLabel}</text>}
      </svg>
    </section>
  );
}
