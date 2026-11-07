'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useGame } from '@/store/game';
import { useT } from '@/i18n';
import type { Player } from '@/engine/types';

export function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => {
    const done = () => setH(true);
    if (useGame.persist.hasHydrated()) done();
    const unsub = useGame.persist.onFinishHydration(done);
    return unsub;
  }, []);
  return h;
}

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.9.8 3.1 2.5 3.5 5.2" />
    </>
  ),
  play: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5l6 3.5-6 3.5z" />
    </>
  ),
  swap: <path d="M4 8h14l-3-3M20 16H6l3 3" />,
  trophy: <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8" />,
  back: <path d="M15 5l-7 7 7 7" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  euro: <path d="M17.5 6.5A7 7 0 1 0 17.5 17.5M4 10.5h9M4 13.5h9" />,
  building: <path d="M4 20V9l8-5 8 5v11M9 20v-6h6v6M3 20h18" />,
  news: <path d="M5 5h11v14H6a1 1 0 0 1-1-1zM16 9h3v9a1 1 0 0 1-1 1h-2M8 9h5M8 12h5M8 15h3" />,
  shirt: <path d="M8 4l-4 3 2 4 2-1v10h8V10l2 1 2-4-4-3c-.5 1.5-2 2.5-4 2.5S8.5 5.5 8 4z" />,
};

export function Icon({ name, size = 22 }: { name: keyof typeof ICONS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const TABS = [
  { href: '/domov', label: 'Domov', icon: 'home' },
  { href: '/kader', label: 'Kader', icon: 'users' },
  { href: '/tekma', label: 'Tekma', icon: 'play' },
  { href: '/liga', label: 'Liga', icon: 'trophy' },
  { href: '/prestopi', label: 'Prestopi', icon: 'swap' },
  { href: '/klub', label: 'Klub', icon: 'building' },
];

export function Shell({ children, nav = true }: { children: React.ReactNode; nav?: boolean }) {
  const hydrated = useHydrated();
  const game = useGame((s) => s.game);
  const tr = useT();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (hydrated && !game && path !== '/nova') router.replace('/nova');
  }, [hydrated, game, path, router]);
  const clubColor = game ? game.clubs.find((c) => c.id === game.userClubId)?.color : undefined;
  useEffect(() => {
    if (clubColor) document.documentElement.style.setProperty('--club', clubColor);
  }, [clubColor]);
  if (!hydrated) return <div className="app" />;
  if (!game && path !== '/nova') return <div className="app" />;
  return (
    <div className="app">
      {children}
      {nav && game && (
        <nav className="nav">
          <div className="nav-in">
            {TABS.map((t) => (
              <Link key={t.href} href={t.href} className={`tab ${path.startsWith(t.href) ? 'on' : ''}`}>
                <Icon name={t.icon} />
                {tr(t.label)}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="muted" style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 13, height: 32 }}>
      <Icon name="back" size={18} />
      {label}
    </Link>
  );
}

export const ovrColor = (o: number) => (o >= 68 ? '#3ddc97' : o >= 62 ? '#7cc4ff' : o >= 55 ? '#f5c451' : '#ff9f5a');
export const attrColor = (v: number) => (v >= 16 ? '#3ddc97' : v >= 13 ? '#7cc4ff' : v >= 10 ? '#f5c451' : '#ff9f5a');
export const formColor = (f: number) => (f >= 0.6 ? 'var(--good)' : f <= -0.6 ? 'var(--orange)' : 'var(--gold)');

export const POS_LABEL: Record<Player['pos'], string> = { C: 'C', LW: 'LK', RW: 'DK', D: 'B', G: 'G' };
export const POS_FULL: Record<Player['pos'], string> = { C: 'Center', LW: 'Levo krilo', RW: 'Desno krilo', D: 'Branilec', G: 'Golman' };

export function Bar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="bar">
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

// Grb kluba: /public/logos/<id>.png (npr. tri.png). Če datoteke ni, pokaže kratico.
export function Crest({ club, size = 42 }: { club: { id: string; short: string; color: string }; size?: number }) {
  const [failed, setFailed] = useState(false);
  const box: React.CSSProperties = { width: size, height: size, borderRadius: size * 0.28, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', overflow: 'hidden' };
  if (!failed)
    return (
      <span style={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/logos/${club.id}.png`} alt={club.short} width={size - 6} height={size - 6} style={{ objectFit: 'contain' }} onError={() => setFailed(true)} />
      </span>
    );
  return (
    <span className="h" style={{ ...box, fontSize: size * 0.36, color: club.color }}>
      {club.id.toUpperCase()}
    </span>
  );
}

// Portret igralca: player.photo ali /public/igralci/<ime-priimek>.jpg. Če ga ni, pokaže številko.
export const photoSlug = (p: { first: string; last: string }) =>
  `${p.first}-${p.last}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-');

export function Portrait({ player, size = 64 }: { player: { first: string; last: string; number: number; photo?: string }; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = player.photo ?? `/igralci/${photoSlug(player)}.jpg`;
  const box: React.CSSProperties = { width: size, height: size, borderRadius: size * 0.25, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', overflow: 'hidden' };
  if (!failed)
    return (
      <span style={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`${player.first} ${player.last}`} width={size} height={size} style={{ objectFit: 'cover', width: '100%', height: '100%' }} onError={() => setFailed(true)} />
      </span>
    );
  return (
    <span className="h" style={{ ...box, fontSize: size * 0.36, color: '#fff', background: 'linear-gradient(135deg, color-mix(in srgb, var(--club) 70%, #1a2335), #1a2335)' }}>
      {player.first[0]}
      {player.last[0]}
    </span>
  );
}

export const eur = (n: number) => `${Math.round(n).toLocaleString('sl-SI')} €`;

export const INTEREST_STYLE: Record<'visok' | 'srednji' | 'nizek' | 'ne pride', { bg: string; fg: string; label: string }> = {
  visok: { bg: '#1f4d3a', fg: '#8fe3b5', label: 'Interes visok' },
  srednji: { bg: '#3d3517', fg: '#f2d88a', label: 'Interes srednji' },
  nizek: { bg: '#3d2a17', fg: '#f5c18f', label: 'Interes nizek' },
  'ne pride': { bg: '#4d2a1f', fg: '#f5a98f', label: 'Ne pride' },
};

// gradient iz barv dveh klubov za "hero" kartice
export const heroBg = (a: string, b?: string) =>
  `linear-gradient(135deg, color-mix(in srgb, ${a} 85%, #000) 0%, color-mix(in srgb, ${a} 45%, #0b1220) 48%, color-mix(in srgb, ${b ?? a} 55%, #0b1220) 100%)`;

export function SectionTitle({ title, href, link }: { title: string; href?: string; link?: string }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {href && <Link href={href}>{link ?? 'Vse'}</Link>}
    </div>
  );
}
